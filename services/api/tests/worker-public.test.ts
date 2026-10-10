import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

const mocks = vi.hoisted(() => ({
  getWorker: vi.fn(),
  getIntervention: vi.fn(),
}));

vi.mock("@taapsaathi/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@taapsaathi/shared")>();

  return {
    ...actual,
    DynamoRepository: class {
      getWorker = mocks.getWorker;
      getIntervention = mocks.getIntervention;
    },
  };
});

import { handler } from "../src/worker.js";

const now = "2026-10-10T10:00:00.000Z";

function event(): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    headers: {},
    pathParameters: { workerId: "ravi-001" },
    requestContext: { requestId: "req-test" },
  } as unknown as APIGatewayProxyEventV2;
}

async function invoke(request: APIGatewayProxyEventV2) {
  const result = await handler(request, {} as never, () => undefined);
  if (!result || typeof result === "string") throw new Error("Unexpected Lambda response");
  return result;
}

describe("Public worker API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["TABLE_NAME"] = "TestTable";
    mocks.getWorker.mockResolvedValue({
      workerId: "ravi-001",
      hubId: "hub-delhi-001",
      name: "Ravi",
      language: "hi",
      state: "RESTING",
      activeMinutes: 75,
      activeTaskIds: ["delivery-001"],
      activeInterventionId: "int-test-001",
      position: [77.2, 28.6],
      shiftId: "shift-demo-001",
      shiftActive: true,
      demoGeneration: 1,
      updatedAt: now,
    });
    mocks.getIntervention.mockResolvedValue({
      interventionId: "int-test-001",
      eventId: "evt-test-001",
      correlationId: "corr-test-001",
      idempotencyKey: "idempotency-test-001",
      workerId: "ravi-001",
      hubId: "hub-delhi-001",
      riskLevel: "HIGH",
      matchedRule: "HEAT_ALERT_WITH_ACTIVE_EXPOSURE",
      status: "RESTING",
      audioKey: "audio/hi/ravi-001.mp3",
      audioLanguage: "hi",
      demoGeneration: 1,
      createdAt: now,
      updatedAt: now,
    });
  });

  it("does not expose audio keys or signed URLs from the public worker route", async () => {
    const result = await invoke(event());

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(String(result.body));
    expect(body.intervention).not.toHaveProperty("audioKey");
    expect(body).not.toHaveProperty("audioUrl");
    expect(JSON.stringify(body)).not.toContain("audio/hi/ravi-001.mp3");
  });
});
