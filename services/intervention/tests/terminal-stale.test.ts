import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowState } from "../src/workflow-input.js";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  escalate: vi.fn(),
}));

vi.mock("@taapsaathi/shared", async () => {
  const actual = await vi.importActual<typeof import("@taapsaathi/shared")>(
    "@taapsaathi/shared"
  );
  return {
    ...actual,
    DynamoRepository: class {
      complete = mocks.complete;
      escalate = mocks.escalate;
    },
    loadEnvironment: () => ({ TABLE_NAME: "TaapSaathiTest" }),
  };
});

import { StaleGenerationError } from "@taapsaathi/shared";
import { handler as completeHandler } from "../src/complete.js";
import { handler as escalateHandler } from "../src/escalate.js";

const input: WorkflowState = {
  interventionId: "int-removed",
  duplicate: false,
  envelope: {
    schemaVersion: 1,
    eventId: "evt-stale",
    eventType: "HeatRiskRaised",
    source: "DEMO_SIMULATOR",
    occurredAt: "2026-10-11T10:00:00.000Z",
    correlationId: "corr-stale",
    demoGeneration: 4,
    payload: {
      hubId: "hub-delhi-001",
      workerId: "ravi-001",
      shiftId: "shift-demo-001",
      riskLevel: "HIGH",
      matchedRule: "HEAT_ALERT_WITH_ACTIVE_EXPOSURE",
      temperatureC: 45,
      apparentTemperatureC: 49,
      activeMinutes: 75,
      idempotencyKey: "stale-g4",
      policyVersion: "heat-policy-v2",
    },
  },
};

describe("terminal workflow handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.complete.mockRejectedValue(new StaleGenerationError());
    mocks.escalate.mockRejectedValue(new StaleGenerationError());
  });

  it("passes stale completion to the state-machine catch path with its generation", async () => {
    await expect(completeHandler({ ...input, terminalStatus: "SUPERVISOR_UNACKNOWLEDGED" }, {} as never, () => undefined)).rejects.toBeInstanceOf(StaleGenerationError);
    expect(mocks.complete).toHaveBeenCalledWith(expect.objectContaining({ generation: 4 }));
  });

  it("passes stale escalation to the state-machine catch path with its generation", async () => {
    await expect(escalateHandler({ ...input, timeout: true }, {} as never, () => undefined)).rejects.toBeInstanceOf(StaleGenerationError);
    expect(mocks.escalate).toHaveBeenCalledWith(expect.objectContaining({ generation: 4 }));
  });
});
