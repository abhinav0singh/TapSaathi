import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { AppError } from "@taapsaathi/shared";

const mocks = vi.hoisted(() => ({
  loadRuntimeIdentityMapping: vi.fn(),
  resetDemo: vi.fn(),
}));

vi.mock("@taapsaathi/shared", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@taapsaathi/shared")
  >();

  return {
    ...actual,
    loadRuntimeIdentityMapping: mocks.loadRuntimeIdentityMapping,
    DynamoRepository: class {
      resetDemo = mocks.resetDemo;
    },
  };
});

import { handler } from "../src/reset.js";

const operatorSub = "11111111-1111-4111-8111-111111111111";
const workerSub = "22222222-2222-4222-8222-222222222222";

const mapping = {
  [operatorSub]: { role: "OPERATOR" },
  [workerSub]: { role: "WORKER", actorId: "ravi-001" },
};

function event(
  sub?: string,
  groups: string[] = []
): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    headers: {},
    requestContext: {
      requestId: "req-test",
      ...(sub
        ? {
            authorizer: {
              jwt: {
                claims: {
                  sub,
                  "cognito:groups": groups,
                },
                scopes: null,
              },
            },
          }
        : {}),
    },
    body: "{}",
  } as unknown as APIGatewayProxyEventV2;
}

async function invoke(request: APIGatewayProxyEventV2) {
  const result = await handler(request, {} as never, () => undefined);

  if (!result || typeof result === "string") {
    throw new Error("Unexpected Lambda response");
  }

  return result;
}

describe("Reset API authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env["TABLE_NAME"] = "TestTable";
    mocks.loadRuntimeIdentityMapping.mockResolvedValue(mapping);

    mocks.resetDemo.mockResolvedValue({
      generation: 5,
    });
  });

  it("rejects missing JWT context before touching DynamoDB", async () => {
    const result = await invoke(event());

    expect(result.statusCode).toBe(401);
    expect(mocks.resetDemo).not.toHaveBeenCalled();
  });

  it("rejects worker access before touching DynamoDB", async () => {
    const result = await invoke(
      event(workerSub, ["WORKER"])
    );

    expect(result.statusCode).toBe(403);
    expect(mocks.resetDemo).not.toHaveBeenCalled();
  });

  it("allows an authorized operator to reset the demo", async () => {
    const result = await invoke(
      event(operatorSub, ["OPERATOR"])
    );

    expect(result.statusCode).toBe(200);
    expect(mocks.resetDemo).toHaveBeenCalledTimes(1);

    const body = JSON.parse(String(result.body));

    expect(body).toMatchObject({
      status: "RESET_COMPLETE",
      demoGeneration: 5,
      simulated: true,
    });
  });

  it("rejects unmapped operator identities", async () => {
    const result = await invoke(
      event("33333333-3333-4333-8333-333333333333", ["OPERATOR"])
    );

    expect(result.statusCode).toBe(403);
    expect(mocks.resetDemo).not.toHaveBeenCalled();
  });

  it("fails closed when identity configuration is missing", async () => {
        mocks.loadRuntimeIdentityMapping.mockRejectedValue(
      new AppError(
        "IDENTITY_MAPPING_UNAVAILABLE",
        "Demo identity configuration is unavailable.",
        500
      )
    );

    const result = await invoke(
      event(operatorSub, ["OPERATOR"])
    );

    expect(result.statusCode).toBe(500);
    expect(mocks.resetDemo).not.toHaveBeenCalled();
  });
});
