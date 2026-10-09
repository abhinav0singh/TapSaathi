import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { AppError } from "@taapsaathi/shared";
import { SendTaskSuccessCommand } from "@aws-sdk/client-sfn";

const mocks = vi.hoisted(() => ({
  loadRuntimeIdentityMapping: vi.fn(),
  getIntervention: vi.fn(),
  consumeCallback: vi.fn(),
  releaseCallback: vi.fn(),
  finalizeCallback: vi.fn(),
  sendTask: vi.fn(),
}));

vi.mock("@taapsaathi/shared", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@taapsaathi/shared")
  >();

  return {
    ...actual,
    loadRuntimeIdentityMapping: mocks.loadRuntimeIdentityMapping,
    DynamoRepository: class {
      getIntervention = mocks.getIntervention;
      consumeCallback = mocks.consumeCallback;
      releaseCallback = mocks.releaseCallback;
      finalizeCallback = mocks.finalizeCallback;
    },
  };
});

vi.mock("@aws-sdk/client-sfn", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@aws-sdk/client-sfn")
  >();

  return {
    ...actual,
    SFNClient: class {
      send = mocks.sendTask;
    },
  };
});

import { handler } from "../src/respond.js";

const operatorSub = "11111111-1111-4111-8111-111111111111";
const raviSub = "22222222-2222-4222-8222-222222222222";
const ashaSub = "33333333-3333-4333-8333-333333333333";
const nehaSub = "44444444-4444-4444-8444-444444444444";

const mapping = {
  [operatorSub]: { role: "OPERATOR" },
  [raviSub]: { role: "WORKER", actorId: "ravi-001" },
  [ashaSub]: { role: "WORKER", actorId: "asha-001" },
  [nehaSub]: {
    role: "SUPERVISOR",
    actorId: "supervisor-neha-001",
  },
};

type ActorType = "WORKER" | "SUPERVISOR";
type Action = "TAKE_BREAK" | "FEEL_UNWELL" | "SUPERVISOR_ACK";

function event(
  sub: string | undefined,
  groups: string[],
  actorId: string,
  actorType: ActorType,
  action: Action
): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    headers: {},
    pathParameters: {
      interventionId: "int-test-001",
    },
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
    body: JSON.stringify({
      actorId,
      actorType,
      action,
      clientRequestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
  } as unknown as APIGatewayProxyEventV2;
}

async function invoke(request: APIGatewayProxyEventV2) {
  const result = await handler(request, {} as never, () => undefined);

  if (!result || typeof result === "string") {
    throw new Error("Unexpected Lambda response");
  }

  return result;
}

describe("Respond API authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env["TABLE_NAME"] = "TestTable";
    mocks.loadRuntimeIdentityMapping.mockResolvedValue(mapping);

    mocks.getIntervention.mockResolvedValue({
      interventionId: "int-test-001",
    });

    mocks.consumeCallback.mockResolvedValue({
      duplicate: false,
      taskToken: "test-task-token",
      acceptedAction: "TAKE_BREAK",
      acceptedAt: "2026-10-09T10:00:00.000Z",
    });

    mocks.sendTask.mockResolvedValue({});
    mocks.finalizeCallback.mockResolvedValue(undefined);
    mocks.releaseCallback.mockResolvedValue(undefined);
  });

  it("rejects missing JWT before reading DynamoDB", async () => {
    const result = await invoke(
      event(undefined, [], "ravi-001", "WORKER", "TAKE_BREAK")
    );

    expect(result.statusCode).toBe(401);
    expect(mocks.getIntervention).not.toHaveBeenCalled();
    expect(mocks.consumeCallback).not.toHaveBeenCalled();
    expect(mocks.sendTask).not.toHaveBeenCalled();
  });

  it("rejects Ravi impersonating Asha", async () => {
    const result = await invoke(
      event(raviSub, ["WORKER"], "asha-001", "WORKER", "TAKE_BREAK")
    );

    expect(result.statusCode).toBe(403);
    expect(mocks.getIntervention).not.toHaveBeenCalled();
    expect(mocks.consumeCallback).not.toHaveBeenCalled();
    expect(mocks.sendTask).not.toHaveBeenCalled();
  });

  it("rejects worker impersonation of supervisor", async () => {
    const result = await invoke(
      event(
        raviSub,
        ["WORKER"],
        "supervisor-neha-001",
        "SUPERVISOR",
        "SUPERVISOR_ACK"
      )
    );

    expect(result.statusCode).toBe(403);
    expect(mocks.consumeCallback).not.toHaveBeenCalled();
    expect(mocks.sendTask).not.toHaveBeenCalled();
  });

  it("allows Ravi to submit TAKE_BREAK", async () => {
    const result = await invoke(
      event(raviSub, ["WORKER"], "ravi-001", "WORKER", "TAKE_BREAK")
    );

    expect(result.statusCode).toBe(202);
    expect(mocks.consumeCallback).toHaveBeenCalledTimes(1);
    expect(mocks.sendTask).toHaveBeenCalledTimes(1);

    const command = mocks.sendTask.mock.calls[0]?.[0];

    expect(command).toBeInstanceOf(SendTaskSuccessCommand);

    const body = JSON.parse(String(result.body));

    expect(body).toMatchObject({
      interventionId: "int-test-001",
      action: "TAKE_BREAK",
      status: "ACCEPTED",
    });
  });

  it("allows Neha to acknowledge supervisor escalation", async () => {
    mocks.consumeCallback.mockResolvedValue({
      duplicate: false,
      taskToken: "supervisor-task-token",
      acceptedAction: "SUPERVISOR_ACK",
      acceptedAt: "2026-10-09T10:00:00.000Z",
    });

    const result = await invoke(
      event(
        nehaSub,
        ["SUPERVISOR"],
        "supervisor-neha-001",
        "SUPERVISOR",
        "SUPERVISOR_ACK"
      )
    );

    expect(result.statusCode).toBe(202);
    expect(mocks.consumeCallback).toHaveBeenCalledTimes(1);
    expect(mocks.sendTask).toHaveBeenCalledTimes(1);
  });

  it("rejects unmapped identities", async () => {
    const result = await invoke(
      event(
        "55555555-5555-4555-8555-555555555555",
        ["WORKER"],
        "ravi-001",
        "WORKER",
        "TAKE_BREAK"
      )
    );

    expect(result.statusCode).toBe(403);
    expect(mocks.consumeCallback).not.toHaveBeenCalled();
  });

  it("fails closed when identity mapping is missing", async () => {
        mocks.loadRuntimeIdentityMapping.mockRejectedValue(
      new AppError(
        "IDENTITY_MAPPING_UNAVAILABLE",
        "Demo identity configuration is unavailable.",
        500
      )
    );

    const result = await invoke(
      event(raviSub, ["WORKER"], "ravi-001", "WORKER", "TAKE_BREAK")
    );

    expect(result.statusCode).toBe(500);
    expect(mocks.consumeCallback).not.toHaveBeenCalled();
    expect(mocks.sendTask).not.toHaveBeenCalled();
  });
});
