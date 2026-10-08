import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { ZodError, type ZodType } from "zod";
import { AppError } from "./errors.js";
import { log } from "./logger.js";

export interface RequestContext {
  requestId: string;
  correlationId: string;
}

export function requestContext(event: APIGatewayProxyEventV2): RequestContext {
  return {
    requestId: event.requestContext.requestId,
    correlationId: event.headers["x-correlation-id"] ?? event.requestContext.requestId,
  };
}

export function parseJson<T>(event: APIGatewayProxyEventV2, schema: ZodType<T>): T {
  let value: unknown = {};
  if (event.body) {
    try {
      value = JSON.parse(event.body);
    } catch {
      throw new AppError("INVALID_JSON", "Request body must be valid JSON.", 400);
    }
  }
  return schema.parse(value);
}

export function json(
  statusCode: number,
  body: unknown,
  correlationId?: string,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(correlationId ? { "x-correlation-id": correlationId } : {}),
    },
    body: JSON.stringify(body),
  };
}

export function errorResponse(error: unknown, requestId: string): APIGatewayProxyStructuredResultV2 {
  if (error instanceof ZodError) {
    return json(400, { error: { code: "VALIDATION_ERROR", message: "Request validation failed.", requestId } });
  }
  if (error instanceof AppError) {
    return json(error.statusCode, { error: { code: error.code, message: error.message, requestId } });
  }
  log("ERROR", "UnhandledApiError", { requestId, errorName: error instanceof Error ? error.name : "Unknown" });
  return json(500, { error: { code: "INTERNAL_ERROR", message: "The request could not be completed.", requestId } });
}
