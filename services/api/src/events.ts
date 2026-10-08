import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { EventsQuerySchema, EventsResponseSchema } from "@taapsaathi/contracts";
import { DEMO_HUB_ID, DynamoRepository, errorResponse, json, loadEnvironment, requestContext } from "@taapsaathi/shared";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const context = requestContext(event);
  try {
    const query = EventsQuerySchema.parse(event.queryStringParameters ?? {});
    const result = await new DynamoRepository(loadEnvironment().TABLE_NAME).listAuditEvents(query.after, DEMO_HUB_ID);
    return json(200, EventsResponseSchema.parse(result), context.correlationId);
  } catch (error) { return errorResponse(error, context.requestId); }
};
