import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

const mocks = vi.hoisted(() => ({
  loadRuntimeIdentityMapping: vi.fn(),
  getWorker: vi.fn(),
  listInterventions: vi.fn(),
  resumeWorker: vi.fn(),
}));

vi.mock("@taapsaathi/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@taapsaathi/shared")>();
  return {
    ...actual,
    loadRuntimeIdentityMapping: mocks.loadRuntimeIdentityMapping,
    DynamoRepository: class {
      getWorker = mocks.getWorker;
      listInterventions = mocks.listInterventions;
      resumeWorker = mocks.resumeWorker;
    },
  };
});

import { handler } from "../src/resume-worker.js";

const raviSub = "22222222-2222-4222-8222-222222222222";
const ashaSub = "33333333-3333-4333-8333-333333333333";
const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const completedAt = "2026-10-10T10:25:02.460Z";

function event(
  sub: string | undefined,
  actorId = "ravi-001",
  workerId = "ravi-001",
  extra: Record<string, unknown> = {}
): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    headers: {},
    pathParameters: { workerId },
    requestContext: {
      requestId: "req-resume",
      ...(sub ? {
        authorizer: {
          jwt: {
            claims: { sub, "cognito:groups": ["WORKER"] },
            scopes: null,
          },
        },
      } : {}),
    },
    body: JSON.stringify({ actorId, clientRequestId: requestId, ...extra }),
  } as unknown as APIGatewayProxyEventV2;
}

async function invoke(request: APIGatewayProxyEventV2) {
  const result = await handler(request, {} as never, () => undefined);
  if (!result || typeof result === "string") throw new Error("Unexpected Lambda response");
  return result;
}

describe("Resume worker API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["TABLE_NAME"] = "TestTable";
    mocks.loadRuntimeIdentityMapping.mockResolvedValue({
      [raviSub]: { role: "WORKER", actorId: "ravi-001" },
      [ashaSub]: { role: "WORKER", actorId: "asha-001" },
    });
    mocks.getWorker.mockResolvedValue({
      workerId: "ravi-001",
      hubId: "hub-delhi-001",
      state: "RESTING",
      demoGeneration: 16,
    });
    mocks.listInterventions.mockResolvedValue([{
      interventionId: "int-break",
      correlationId: "corr-break",
      workerId: "ravi-001",
      hubId: "hub-delhi-001",
      status: "COMPLETED",
      replacementWorkerId: "asha-001",
      demoGeneration: 16,
      updatedAt: completedAt,
      completedAt,
    }]);
    mocks.resumeWorker.mockResolvedValue({ duplicate: false, resumedAt: completedAt });
  });

  it("rejects a missing JWT before reading worker state", async () => {
    const result = await invoke(event(undefined));
    expect(result.statusCode).toBe(401);
    expect(mocks.getWorker).not.toHaveBeenCalled();
    expect(mocks.resumeWorker).not.toHaveBeenCalled();
  });

  it("rejects a rider trying to resume another rider", async () => {
    const result = await invoke(event(ashaSub, "asha-001", "ravi-001"));
    expect(result.statusCode).toBe(403);
    expect(mocks.getWorker).not.toHaveBeenCalled();
    expect(mocks.resumeWorker).not.toHaveBeenCalled();
  });

  it("resumes Ravi from a verified completed break", async () => {
    const result = await invoke(event(raviSub));
    expect(result.statusCode).toBe(200);
    expect(mocks.resumeWorker).toHaveBeenCalledWith(expect.objectContaining({
      workerId: "ravi-001",
      generation: 16,
      interventionId: "int-break",
      clientRequestId: requestId,
      fromState: "RESTING",
      audit: expect.objectContaining({
        eventType: "RIDER_RESUMED_WORK",
        actorId: "ravi-001",
        details: expect.objectContaining({
          previousState: "RESTING",
          newState: "SAFE",
          activeMinutesResetTo: 0,
          deliveryRemainsWith: "asha-001",
        }),
      }),
    }));
    expect(JSON.parse(String(result.body))).toMatchObject({
      workerId: "ravi-001",
      status: "RESUMED",
      resumedAt: completedAt,
      clientRequestId: requestId,
    });
  });

  describe("after a supervisor-acknowledged symptom report", () => {
    beforeEach(() => {
      mocks.getWorker.mockResolvedValue({
        workerId: "ravi-001",
        hubId: "hub-delhi-001",
        state: "AWAITING_SUPERVISOR",
        demoGeneration: 16,
      });
      mocks.listInterventions.mockResolvedValue([{
        interventionId: "int-unwell",
        correlationId: "corr-unwell",
        workerId: "ravi-001",
        hubId: "hub-delhi-001",
        status: "SUPERVISOR_RESPONDING",
        replacementWorkerId: "asha-001",
        demoGeneration: 16,
        updatedAt: completedAt,
        completedAt,
      }]);
    });

    it("requires the rider to confirm they feel well enough", async () => {
      const result = await invoke(event(raviSub));
      expect(result.statusCode).toBe(400);
      expect(JSON.parse(String(result.body)).error.code).toBe("FITNESS_CONFIRMATION_REQUIRED");
      expect(mocks.resumeWorker).not.toHaveBeenCalled();
    });

    it("resumes Ravi and records the self-declaration", async () => {
      const result = await invoke(event(raviSub, "ravi-001", "ravi-001", { selfDeclaredFit: true }));
      expect(result.statusCode).toBe(200);
      expect(mocks.resumeWorker).toHaveBeenCalledWith(expect.objectContaining({
        interventionId: "int-unwell",
        fromState: "AWAITING_SUPERVISOR",
        audit: expect.objectContaining({
          eventType: "RIDER_RESUMED_WORK",
          details: expect.objectContaining({
            previousState: "AWAITING_SUPERVISOR",
            newState: "SAFE",
            afterSymptomReport: true,
            selfDeclaredFit: true,
            deliveryRemainsWith: "asha-001",
          }),
        }),
      }));
    });

    it("does not resume when the supervisor has not acknowledged", async () => {
      mocks.listInterventions.mockResolvedValue([{
        interventionId: "int-unwell",
        correlationId: "corr-unwell",
        workerId: "ravi-001",
        hubId: "hub-delhi-001",
        status: "SUPERVISOR_UNACKNOWLEDGED",
        replacementWorkerId: "asha-001",
        demoGeneration: 16,
        updatedAt: completedAt,
      }]);
      const result = await invoke(event(raviSub, "ravi-001", "ravi-001", { selfDeclaredFit: true }));
      expect(result.statusCode).toBe(409);
      expect(mocks.resumeWorker).not.toHaveBeenCalled();
    });
  });
});
