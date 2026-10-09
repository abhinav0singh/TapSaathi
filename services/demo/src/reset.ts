import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DemoResetRequestSchema, DemoResetResponseSchema } from "@taapsaathi/contracts";
import { DynamoRepository, errorResponse, json, loadEnvironment, loadRuntimeIdentityMapping, parseJson, requestContext, requireOperator } from "@taapsaathi/shared";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const context = requestContext(event);
  try {
    requireOperator(event, await loadRuntimeIdentityMapping());
    parseJson(event, DemoResetRequestSchema);
    const now = new Date().toISOString();
    const repository = new DynamoRepository(loadEnvironment().TABLE_NAME);
    const { generation } = await repository.resetDemo(now);
    return json(200, DemoResetResponseSchema.parse({
      status: "RESET_COMPLETE",
      demoGeneration: generation,
      counts: { workers: 3, tasks: 1, restPoints: 3, activeInterventions: 0 },
      resetAt: now,
      simulated: true,
    }), context.correlationId);
  } catch (error) {
    return errorResponse(error, context.requestId);
  }
};
