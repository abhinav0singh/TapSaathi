import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowState } from "../src/workflow-input.js";

const mocks = vi.hoisted(() => ({
  createIntervention: vi.fn(),
  log: vi.fn(),
  metric: vi.fn(),
}));

vi.mock("@taapsaathi/shared", async () => {
  const actual = await vi.importActual<typeof import("@taapsaathi/shared")>(
    "@taapsaathi/shared"
  );

  return {
    ...actual,
    DynamoRepository: class {
      createIntervention = mocks.createIntervention;
    },
    loadEnvironment: () => ({
      TABLE_NAME: "TaapSaathiTest",
    }),
    log: mocks.log,
    metric: mocks.metric,
  };
});

import { AppError, StaleGenerationError } from "@taapsaathi/shared";
import { handler } from "../src/create.js";

const input: WorkflowState = {
  interventionId: "int-test-001",
  duplicate: false,
  envelope: {
    schemaVersion: 1,
    eventId: "evt-test-001",
    eventType: "HeatRiskRaised",
    source: "DEMO_SIMULATOR",
    occurredAt: "2026-10-09T08:00:00.000Z",
    correlationId: "corr-test-001",
    demoGeneration: 4,
    payload: {
      hubId: "hub-delhi-001",
      workerId: "ravi-001",
      shiftId: "shift-demo-001",
      riskLevel: "HIGH",
      matchedRule: "HEAT_ALERT_WITH_ACTIVE_EXPOSURE",
      temperatureC: 45.2,
      apparentTemperatureC: 49.1,
      activeMinutes: 75,
      idempotencyKey: "shift-demo-001#ravi-001#g4#window-01",
      policyVersion: "heat-policy-v1",
    },
  },
};

async function invoke() {
  return handler(input, {} as never, () => undefined);
}

describe("CreateIntervention Lambda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createIntervention.mockResolvedValue(undefined);
  });

  it("returns CREATED after successful persistence", async () => {
    const result = await invoke();

    expect(result).toMatchObject({
      creationOutcome: "CREATED",
    });

    expect(mocks.createIntervention).toHaveBeenCalledTimes(1);
    expect(mocks.metric).toHaveBeenCalledWith(
      "InterventionsCreated",
      1,
      { operation: "CreateIntervention" }
    );
  });

  it("suppresses a classified worker conflict", async () => {
    mocks.createIntervention.mockRejectedValue(
      new AppError(
        "WORKER_INTERVENTION_ACTIVE",
        "Worker unavailable",
        409
      )
    );

    const result = await invoke();

    expect(result).toMatchObject({
      creationOutcome: "WORKER_UNAVAILABLE",
    });

    expect(mocks.metric).toHaveBeenCalledWith(
      "WorkerInterventionsSuppressed",
      1,
      { operation: "CreateIntervention" }
    );

    expect(mocks.metric).not.toHaveBeenCalledWith(
      "InterventionsCreated",
      1,
      expect.anything()
    );
  });

  it("propagates stale-generation errors", async () => {
    mocks.createIntervention.mockRejectedValue(
      new StaleGenerationError()
    );

    await expect(invoke()).rejects.toMatchObject({
      code: "STALE_DEMO_GENERATION",
    });
  });

  it("propagates unexpected infrastructure failures", async () => {
    const failure = new Error("DynamoDB unavailable");

    mocks.createIntervention.mockRejectedValue(failure);

    await expect(invoke()).rejects.toBe(failure);
  });
});
