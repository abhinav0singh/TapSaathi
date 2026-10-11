import { describe, expect, it } from "vitest";
import type { AuditEvent, Worker } from "@taapsaathi/contracts";
import { supervisorFollowUpForWorker } from "./supervisorFollowUp";

const worker = (overrides: Partial<Worker> = {}): Worker => ({
  workerId: "ravi-001",
  hubId: "hub-delhi-001",
  name: "Ravi",
  language: "hi",
  state: "AWAITING_SUPERVISOR",
  activeMinutes: 75,
  activeTaskIds: [],
  position: [77.209, 28.6139],
  shiftId: "shift-demo-001",
  shiftActive: true,
  demoGeneration: 38,
  updatedAt: "2026-10-11T13:15:48.571Z",
  ...overrides,
});

const unacknowledgedCompletion = (overrides: Partial<AuditEvent> = {}): AuditEvent => ({
  auditEventId: "audit-complete",
  interventionId: "int-08a25c3d204ce9edebab",
  eventType: "INTERVENTION_COMPLETED",
  actorType: "SYSTEM",
  correlationId: "correlation-001",
  workerId: "ravi-001",
  hubId: "hub-delhi-001",
  demoGeneration: 38,
  details: { terminalStatus: "SUPERVISOR_UNACKNOWLEDGED" },
  occurredAt: "2026-10-11T13:15:48.571Z",
  ...overrides,
});

describe("supervisorFollowUpForWorker", () => {
  it("identifies the deployed combination: no active alert, an unacknowledged terminal outcome, and a waiting rider", () => {
    expect(supervisorFollowUpForWorker(worker(), [unacknowledgedCompletion()], 38)).toEqual({
      workerId: "ravi-001",
      completedAt: "2026-10-11T13:15:48.571Z",
      status: "UNACKNOWLEDGED",
    });
  });

  it("does not treat a currently active intervention as a terminal follow-up", () => {
    expect(
      supervisorFollowUpForWorker(
        worker({ activeInterventionId: "int-08a25c3d204ce9edebab" }),
        [unacknowledgedCompletion()],
        38,
      ),
    ).toBeNull();
  });

  it("does not carry a terminal outcome across demo generations", () => {
    expect(
      supervisorFollowUpForWorker(worker(), [unacknowledgedCompletion({ demoGeneration: 37 })], 38),
    ).toBeNull();
  });
});
