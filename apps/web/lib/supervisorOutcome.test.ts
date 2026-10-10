import { describe, expect, it } from "vitest";
import type { AuditEvent } from "@taapsaathi/contracts";
import {
  latestAcknowledgmentBySupervisor,
  latestSupervisorOutcome,
} from "./supervisorOutcome";

function event(
  eventType: string,
  occurredAt: string,
  overrides: Partial<AuditEvent> = {}
): AuditEvent {
  return {
    auditEventId: `audit-${eventType}-${occurredAt}`,
    interventionId: "int-current",
    eventType,
    actorType: "SYSTEM",
    correlationId: "corr-1",
    workerId: "ravi-001",
    hubId: "hub-delhi-001",
    demoGeneration: 5,
    details: {},
    occurredAt,
    ...overrides,
  };
}

describe("supervisor outcome from live audit events", () => {
  const accepted = event("RESPONSE_ACCEPTED", "2026-10-10T06:10:36.999Z", {
    actorType: "SUPERVISOR",
    actorId: "supervisor-neha-001",
    details: { action: "SUPERVISOR_ACK" },
  });
  const completed = event("INTERVENTION_COMPLETED", "2026-10-10T06:10:37.690Z", {
    details: { terminalStatus: "SUPERVISOR_RESPONDING" },
  });

  it("confirms an acknowledgment only when acceptance and completion match", () => {
    expect(latestSupervisorOutcome([completed, accepted], "ravi-001", 5)).toEqual({
      interventionId: "int-current",
      completedAt: completed.occurredAt,
      status: "ACKNOWLEDGED",
    });
    expect(latestSupervisorOutcome([completed], "ravi-001", 5)).toBeNull();
    expect(
      latestSupervisorOutcome(
        [completed, { ...accepted, interventionId: "int-other" }],
        "ravi-001",
        5
      )
    ).toBeNull();
  });

  it("distinguishes a supervisor timeout from an accepted acknowledgment", () => {
    const timeout = event("INTERVENTION_COMPLETED", "2026-10-10T06:01:06.642Z", {
      details: { terminalStatus: "SUPERVISOR_UNACKNOWLEDGED" },
    });
    expect(latestSupervisorOutcome([timeout], "ravi-001", 5)?.status).toBe(
      "UNACKNOWLEDGED"
    );
  });

  it("does not carry an old demo generation into a reset", () => {
    expect(latestSupervisorOutcome([accepted, completed], "ravi-001", 6)).toBeNull();
    expect(latestAcknowledgmentBySupervisor([accepted], "supervisor-neha-001", 6)).toBeNull();
  });

  it("does not show an older acknowledgment over a newer completion", () => {
    const newer = event("INTERVENTION_COMPLETED", "2026-10-10T07:00:00.000Z", {
      interventionId: "int-newer",
      details: { terminalStatus: "COMPLETED" },
    });
    expect(latestSupervisorOutcome([accepted, completed, newer], "ravi-001", 5)).toBeNull();
  });

  it("shows only acknowledgments made by the signed-in supervisor", () => {
    expect(
      latestAcknowledgmentBySupervisor([accepted], "supervisor-neha-001", 5)
    ).toEqual(accepted);
    expect(
      latestAcknowledgmentBySupervisor([accepted], "supervisor-other-001", 5)
    ).toBeNull();
  });
});
