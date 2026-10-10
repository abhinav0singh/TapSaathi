import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { WorkerAudioResponseSchema } from "@taapsaathi/contracts";
import {
  AppError,
  DynamoRepository,
  errorResponse,
  json,
  loadEnvironment,
  loadRuntimeIdentityMapping,
  NotFoundError,
  requestContext,
  requireActor,
} from "@taapsaathi/shared";

const AUDIO_URL_LIFETIME_SECONDS = 300;

/** Returns guidance audio only to the signed-in rider named in the route. */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const context = requestContext(event);
  try {
    const workerId = event.pathParameters?.["workerId"];
    if (!workerId) throw new NotFoundError("Worker not found.");
    requireActor(event, await loadRuntimeIdentityMapping(), "WORKER", workerId);

    const environment = loadEnvironment();
    if (!environment.AUDIO_BUCKET_NAME) {
      throw new AppError(
        "AUDIO_CONFIGURATION_MISSING",
        "Guidance audio is temporarily unavailable.",
        500
      );
    }
    const repository = new DynamoRepository(environment.TABLE_NAME);
    const worker = await repository.getWorker(workerId);
    if (!worker) throw new NotFoundError("Worker not found.");
    const intervention = worker.activeInterventionId
      ? await repository.getIntervention(worker.activeInterventionId)
      : undefined;
    if (!intervention?.audioKey) throw new NotFoundError("Guidance audio is unavailable.");

    const audioUrl = await getSignedUrl(
      new S3Client({}),
      new GetObjectCommand({ Bucket: environment.AUDIO_BUCKET_NAME, Key: intervention.audioKey }),
      { expiresIn: AUDIO_URL_LIFETIME_SECONDS },
    );
    const audioExpiresAt = new Date(Date.now() + AUDIO_URL_LIFETIME_SECONDS * 1_000).toISOString();
    return json(200, WorkerAudioResponseSchema.parse({ audioUrl, audioExpiresAt }), context.correlationId);
  } catch (error) {
    return errorResponse(error, context.requestId);
  }
};
