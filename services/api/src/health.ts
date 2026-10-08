import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { HealthResponseSchema } from "@taapsaathi/contracts";
import { errorResponse, json, requestContext } from "@taapsaathi/shared";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const context = requestContext(event);
  try {
    return json(200, HealthResponseSchema.parse({ status: "ok", service: "taapsaathi-api", time: new Date().toISOString() }), context.correlationId);
  } catch (error) {
    return errorResponse(error, context.requestId);
  }
};
