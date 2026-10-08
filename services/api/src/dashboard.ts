import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DashboardResponseSchema } from "@taapsaathi/contracts";
import { DEMO_HUB_ID, DynamoRepository, errorResponse, json, loadEnvironment, requestContext } from "@taapsaathi/shared";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const context = requestContext(event);
  try {
    const repository = new DynamoRepository(loadEnvironment().TABLE_NAME);
    const [generation, workers, tasks, interventions, audit] = await Promise.all([
      repository.getDemoGeneration(),
      repository.getWorkers(DEMO_HUB_ID),
      repository.getTasks(DEMO_HUB_ID),
      repository.listInterventions(DEMO_HUB_ID),
      repository.listAuditEvents(undefined, DEMO_HUB_ID),
    ]);
    const activeInterventions = interventions.filter((item) => !["COMPLETED", "SUPERVISOR_RESPONDING", "SUPERVISOR_UNACKNOWLEDGED"].includes(item.status));
    return json(200, DashboardResponseSchema.parse({
      hub: { hubId: DEMO_HUB_ID, name: "Delhi North Demo Hub", timeZone: "Asia/Kolkata", simulated: true },
      demoGeneration: generation,
      summary: {
        safe: workers.filter((worker) => worker.state === "SAFE").length,
        caution: workers.filter((worker) => worker.state === "CAUTION").length,
        intervention: activeInterventions.length,
        awaitingSupervisor: workers.filter((worker) => worker.state === "AWAITING_SUPERVISOR").length,
      },
      workers,
      tasks,
      activeInterventions,
      recentEvents: audit.events.slice(-50),
      nextCursor: audit.nextCursor,
      updatedAt: new Date().toISOString(),
    }), context.correlationId);
  } catch (error) { return errorResponse(error, context.requestId); }
};
