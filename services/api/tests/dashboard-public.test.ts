import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

const mocks = vi.hoisted(() => ({
  getDemoGeneration: vi.fn(),
  getWorkers: vi.fn(),
  getTasks: vi.fn(),
  listInterventions: vi.fn(),
  listAuditEvents: vi.fn(),
}));

vi.mock("@taapsaathi/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@taapsaathi/shared")>();

  return {
    ...actual,
    DynamoRepository: class {
      getDemoGeneration = mocks.getDemoGeneration;
      getWorkers = mocks.getWorkers;
      getTasks = mocks.getTasks;
      listInterventions = mocks.listInterventions;
      listAuditEvents = mocks.listAuditEvents;
    },
  };
});

import { handler } from "../src/dashboard.js";

const now = "2026-10-10T10:00:00.000Z";

function event(): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    headers: {},
    requestContext: { requestId: "req-test" },
  } as unknown as APIGatewayProxyEventV2;
}

async function invoke(request: APIGatewayProxyEventV2) {
  const result = await handler(request, {} as never, () => undefined);
  if (!result || typeof result === "string") throw new Error("Unexpected Lambda response");
  return result;
}

describe("Public dashboard API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["TABLE_NAME"] = "TestTable";
    mocks.getDemoGeneration.mockResolvedValue(1);
    mocks.getWorkers.mockResolvedValue([]);
    mocks.getTasks.mockResolvedValue([]);
    mocks.listInterventions.mockResolvedValue([{
      interventionId: "int-test-001",
      eventId: "evt-test-001",
      correlationId: "corr-test-001",
      idempotencyKey: "idempotency-test-001",
      workerId: "ravi-001",
      hubId: "hub-delhi-001",
      riskLevel: "HIGH",
      matchedRule: "HEAT_ALERT_WITH_ACTIVE_EXPOSURE",
      status: "AWAITING_WORKER",
      audioKey: "audio/hi/SECRET.mp3",
      audioLanguage: "hi",
      demoGeneration: 1,
      createdAt: now,
      updatedAt: now,
    }]);
    mocks.listAuditEvents.mockResolvedValue({ events: [], nextCursor: null });
  });

  it("does not expose audio keys from active interventions", async () => {
    const result = await invoke(event());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(String(result.body));
    expect(body.activeInterventions[0]).not.toHaveProperty("audioKey");
    expect(JSON.stringify(body)).not.toContain("audio/hi/SECRET.mp3");
  });
});
