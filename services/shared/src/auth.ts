import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { AppError } from "./errors.js";

type Role = "OPERATOR" | "WORKER" | "SUPERVISOR";

interface Identity {
  role: Role;
  actorId?: string;
}

type IdentityMapping = Record<string, Identity>;

function claimsFrom(event: APIGatewayProxyEventV2): Record<string, unknown> {
  const context = event.requestContext as {
    authorizer?: {
      jwt?: {
        claims?: Record<string, unknown>;
      };
    };
  };

  const claims = context.authorizer?.jwt?.claims;

  if (!claims || typeof claims !== "object") {
    throw new AppError(
      "UNAUTHENTICATED",
      "Authentication is required.",
      401
    );
  }

  return claims;
}

function groupsFrom(claims: Record<string, unknown>): string[] {
  const raw = claims["cognito:groups"];

  if (Array.isArray(raw)) {
    return raw.filter((value): value is string =>
      typeof value === "string"
    );
  }

  if (typeof raw !== "string") {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      Array.isArray(parsed) &&
      parsed.every((value) => typeof value === "string")
    ) {
      return parsed;
    }

    return [];
  } catch {
    const normalized = raw.trim();

    const groupText =
      normalized.startsWith("[") && normalized.endsWith("]")
        ? normalized.slice(1, -1)
        : normalized;

    return groupText
      .split(",")
      .map((group) => group.trim())
      .filter((group) => group.length > 0);
  }
}

function identityFrom(
  event: APIGatewayProxyEventV2,
  mapping: IdentityMapping
): Identity {
  const claims = claimsFrom(event);
  const subject = claims["sub"];

  if (typeof subject !== "string" || !subject) {
    throw new AppError(
      "UNAUTHENTICATED",
      "Authenticated subject is missing.",
      401
    );
  }

  const identity = Object.prototype.hasOwnProperty.call(mapping, subject)
    ? mapping[subject]
    : undefined;

  if (!identity) {
    throw new AppError(
      "FORBIDDEN",
      "This identity is not authorized.",
      403
    );
  }

  if (!groupsFrom(claims).includes(identity.role)) {

    throw new AppError(
      "FORBIDDEN",
      "Required role is missing.",
      403
    );
  }

  return identity;
}

export function requireOperator(
  event: APIGatewayProxyEventV2,
  mapping: IdentityMapping
): void {
  const identity = identityFrom(event, mapping);

  if (identity.role !== "OPERATOR") {
    throw new AppError("FORBIDDEN", "Operator access required.", 403);
  }
}

export function requireActor(
  event: APIGatewayProxyEventV2,
  mapping: IdentityMapping,
  actorType: "WORKER" | "SUPERVISOR",
  actorId: string
): void {
  const identity = identityFrom(event, mapping);

  if (
    identity.role !== actorType ||
    identity.actorId !== actorId
  ) {
    throw new AppError(
      "FORBIDDEN",
      "Actor is not authorized for this response.",
      403
    );
  }
}
