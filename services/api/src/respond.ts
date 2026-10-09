import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { SFNClient, SendTaskSuccessCommand } from "@aws-sdk/client-sfn";
import { RespondAcceptedSchema, RespondRequestSchema } from "@taapsaathi/contracts";
import { AppError, ConflictError, DynamoRepository, errorResponse, json, loadEnvironment, log, metric, NotFoundError, loadRuntimeIdentityMapping, parseJson, requestContext, requireActor } from "@taapsaathi/shared";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const context = requestContext(event);
  try {
    const interventionId = event.pathParameters?.["interventionId"];
    if (!interventionId) throw new NotFoundError("Intervention not found.");
    const body = parseJson(event, RespondRequestSchema);

    requireActor(
      event,
      await loadRuntimeIdentityMapping(),
      body.actorType,
      body.actorId
    );

    const repository = new DynamoRepository(loadEnvironment().TABLE_NAME);
    const intervention = await repository.getIntervention(interventionId);
    if (!intervention) throw new NotFoundError("Intervention not found.");
    const acceptedAt = new Date().toISOString();
    const result = await repository.consumeCallback({ interventionId, actorType: body.actorType, actorId: body.actorId, clientRequestId: body.clientRequestId, action: body.action, consumedAt: acceptedAt });
    if (!result.duplicate) {
      if (!result.taskToken) throw new AppError("CALLBACK_TOKEN_MISSING", "The workflow callback could not be completed.", 500);
      try {
        await new SFNClient({}).send(new SendTaskSuccessCommand({
          taskToken: result.taskToken,
          output: JSON.stringify({ action: body.action, actorId: body.actorId, actorType: body.actorType, clientRequestId: body.clientRequestId, acceptedAt }),
        }));
      } catch (error) {
        if (error instanceof Error && ["TaskTimedOut", "TaskDoesNotExist"].includes(error.name)) {
          await repository.releaseCallback({ interventionId, actorType: body.actorType, clientRequestId: body.clientRequestId }).catch(() => undefined);
          throw new ConflictError("CALLBACK_EXPIRED", "The response window has expired.");
        }
        await repository.releaseCallback({ interventionId, actorType: body.actorType, clientRequestId: body.clientRequestId });
        throw new AppError("CALLBACK_FAILED", "The workflow callback could not be completed.", 500);
      }
      try {
        await repository.finalizeCallback({ interventionId, actorType: body.actorType, clientRequestId: body.clientRequestId });
      } catch (error) {
        log("WARN", "FinalizeCallbackCleanupFailed", { interventionId, actorType: body.actorType, errorName: error instanceof Error ? error.name : "Unknown" });
      }
      metric("WorkerResponsesAccepted", 1, { actorType: body.actorType });
    }
    return json(202, RespondAcceptedSchema.parse({ interventionId, action: result.acceptedAction, status: "ACCEPTED", acceptedAt: result.acceptedAt, clientRequestId: body.clientRequestId }), context.correlationId);
  } catch (error) { return errorResponse(error, context.requestId); }
};
