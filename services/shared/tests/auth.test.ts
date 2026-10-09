import { describe, expect, it } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { requireActor, requireOperator } from "../src/auth.js";

const identities = {
  "sub-operator": { role: "OPERATOR" as const },
  "sub-ravi": { role: "WORKER" as const, actorId: "ravi-001" },
  "sub-asha": { role: "WORKER" as const, actorId: "asha-001" },
  "sub-neha": {
    role: "SUPERVISOR" as const,
    actorId: "supervisor-neha-001",
  },
};

function event(
  sub?: string,
  groups?: string[]
): APIGatewayProxyEventV2 {
  return {
    requestContext: {
      requestId: "test-request",
      ...(sub
        ? {
            authorizer: {
              jwt: {
                claims: {
                  sub,
                  "cognito:groups": groups ?? [],
                },
                scopes: null,
              },
            },
          }
        : {}),
    },
  } as unknown as APIGatewayProxyEventV2;
}

describe("Cognito demo authorization", () => {
  it("rejects missing JWT context", () => {
    expect(() =>
      requireOperator(event(), identities)
    ).toThrowError(
      expect.objectContaining({ statusCode: 401 })
    );
  });

  it("rejects unmapped identities", () => {
    expect(() =>
      requireOperator(event("unknown-sub", ["OPERATOR"]), identities)
    ).toThrowError(
      expect.objectContaining({ statusCode: 403 })
    );
  });

  it("allows an authenticated operator", () => {
    expect(() =>
      requireOperator(event("sub-operator", ["OPERATOR"]), identities)
    ).not.toThrow();
  });

  it("rejects a worker attempting operator actions", () => {
    expect(() =>
      requireOperator(event("sub-ravi", ["WORKER"]), identities)
    ).toThrowError(
      expect.objectContaining({ statusCode: 403 })
    );
  });

  it("rejects an operator without the required group", () => {
    expect(() =>
      requireOperator(event("sub-operator", ["WORKER"]), identities)
    ).toThrowError(
      expect.objectContaining({ statusCode: 403 })
    );
  });

  it("allows Ravi to respond as Ravi", () => {
    expect(() =>
      requireActor(event("sub-ravi", ["WORKER"]), identities, "WORKER", "ravi-001")
    ).not.toThrow();
  });

  it("rejects Ravi impersonating Asha", () => {
    expect(() =>
      requireActor(event("sub-ravi", ["WORKER"]), identities, "WORKER", "asha-001")
    ).toThrowError(
      expect.objectContaining({ statusCode: 403 })
    );
  });

  it("rejects workers acknowledging supervisor callbacks", () => {
    expect(() =>
      requireActor(
        event("sub-ravi", ["WORKER"]),
        identities,
        "SUPERVISOR",
        "supervisor-neha-001"
      )
    ).toThrowError(
      expect.objectContaining({ statusCode: 403 })
    );
  });

  it("allows Neha to acknowledge supervisor callbacks", () => {
    expect(() =>
      requireActor(
        event("sub-neha", ["SUPERVISOR"]),
        identities,
        "SUPERVISOR",
        "supervisor-neha-001"
      )
    ).not.toThrow();
  });

  it("rejects missing actor mappings", () => {
    expect(() =>
      requireActor(
        event("sub-operator", ["OPERATOR"]),
        identities,
        "WORKER",
        "ravi-001"
      )
    ).toThrowError(
      expect.objectContaining({ statusCode: 403 })
    );
  });

  it("accepts a plain-string Cognito operator group", () => {
    const request = event("sub-operator", ["OPERATOR"]);
    const context = request.requestContext as unknown as {
      authorizer: {
        jwt: { claims: Record<string, unknown> };
      };
    };

    context.authorizer.jwt.claims["cognito:groups"] = "OPERATOR";

    expect(() =>
      requireOperator(request, identities)
    ).not.toThrow();
  });

  it("accepts comma-separated Cognito groups", () => {
    const request = event("sub-operator", ["OPERATOR"]);
    const context = request.requestContext as unknown as {
      authorizer: {
        jwt: { claims: Record<string, unknown> };
      };
    };

    context.authorizer.jwt.claims["cognito:groups"] =
      "WORKER,OPERATOR";

    expect(() =>
      requireOperator(request, identities)
    ).not.toThrow();
  });

  it("rejects plain-string groups without the required role", () => {
    const request = event("sub-operator", ["OPERATOR"]);
    const context = request.requestContext as unknown as {
      authorizer: {
        jwt: { claims: Record<string, unknown> };
      };
    };

    context.authorizer.jwt.claims["cognito:groups"] = "WORKER";

    expect(() =>
      requireOperator(request, identities)
    ).toThrowError(
      expect.objectContaining({ statusCode: 403 })
    );
  });

  it("rejects partial operator group matches", () => {
    const request = event("sub-operator", ["OPERATOR"]);
    const context = request.requestContext as unknown as {
      authorizer: {
        jwt: { claims: Record<string, unknown> };
      };
    };

    context.authorizer.jwt.claims["cognito:groups"] =
      "SUPER_OPERATOR";

    expect(() =>
      requireOperator(request, identities)
    ).toThrowError(
      expect.objectContaining({ statusCode: 403 })
    );
  });
  it("accepts API Gateway bracketed Cognito groups", () => {
    const request = event("sub-operator", ["OPERATOR"]);
    const context = request.requestContext as unknown as {
      authorizer: {
        jwt: { claims: Record<string, unknown> };
      };
    };

    context.authorizer.jwt.claims["cognito:groups"] = "[OPERATOR]";

    expect(() =>
      requireOperator(request, identities)
    ).not.toThrow();
  });

  it("rejects bracketed partial role matches", () => {
    const request = event("sub-operator", ["OPERATOR"]);
    const context = request.requestContext as unknown as {
      authorizer: {
        jwt: { claims: Record<string, unknown> };
      };
    };

    context.authorizer.jwt.claims["cognito:groups"] = "[SUPER_OPERATOR]";

    expect(() =>
      requireOperator(request, identities)
    ).toThrowError(
      expect.objectContaining({ statusCode: 403 })
    );
  });
  it("accepts Cognito groups encoded as JSON strings", () => {
    const request = event("sub-ravi", ["WORKER"]);
    const context = request.requestContext as unknown as {
      authorizer: {
        jwt: { claims: Record<string, unknown> };
      };
    };

    context.authorizer.jwt.claims["cognito:groups"] =
      '["WORKER"]';

    expect(() =>
      requireActor(request, identities, "WORKER", "ravi-001")
    ).not.toThrow();
  });
});
