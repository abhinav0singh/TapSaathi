import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { WorkerViewResponseSchema } from "@taapsaathi/contracts";
import { DynamoRepository, errorResponse, json, loadEnvironment, NotFoundError, requestContext } from "@taapsaathi/shared";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const context = requestContext(event);
  try {
    const workerId = event.pathParameters?.["workerId"];
    if (!workerId) throw new NotFoundError("Worker not found.");
    const environment = loadEnvironment();
    const repository = new DynamoRepository(environment.TABLE_NAME);
    const worker = await repository.getWorker(workerId);
    if (!worker) throw new NotFoundError("Worker not found.");
    const intervention = worker.activeInterventionId ? await repository.getIntervention(worker.activeInterventionId) : undefined;
    const instruction = worker.state === "SAFE" ? "Continue your shift and take regular breaks."
      : worker.state === "CAUTION" ? "Heat alert active. Prepare for a break."
      : worker.state === "AWAITING_SUPERVISOR" ? "A supervisor has been notified. Stay in a safe place."
      : worker.state === "RESTING" ? "Your break is active. Rest and hydrate."
      : "Stop work and go to the shown demonstration rest point.";
    return json(200, WorkerViewResponseSchema.parse({ worker, instruction, ...(intervention ? { intervention, route: intervention.route } : {}), simulated: true, updatedAt: new Date().toISOString() }), context.correlationId);
  } catch (error) { return errorResponse(error, context.requestId); }
};
