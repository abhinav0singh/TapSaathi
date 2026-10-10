import { describe, expect, it } from "vitest";
import type { AuditEvent } from "@taapsaathi/contracts";
import { auditImpact } from "./auditImpact";

const event = (eventType: string, occurredAt: string): AuditEvent => ({ auditEventId: eventType, interventionId: "int-1", eventType, actorType: "SYSTEM", correlationId: "corr-1", workerId: "ravi-001", hubId: "hub-delhi-001", demoGeneration: 7, details: {}, occurredAt });

describe("auditImpact", () => {
  it("uses only the selected generation and measured audit timestamps", () => {
    const result = auditImpact([event("INTERVENTION_CREATED", "2024-05-29T07:30:00.000Z"), event("DELIVERY_REASSIGNED", "2024-05-29T07:30:15.000Z"), event("RESPONSE_ACCEPTED", "2024-05-29T07:30:45.000Z"), event("SUPERVISOR_ESCALATED", "2024-05-29T07:31:00.000Z"), { ...event("INTERVENTION_CREATED", "2024-05-29T07:00:00.000Z"), demoGeneration: 6 }], 7);
    expect(result).toEqual({ interventionCount: 1, escalationCount: 1, triggerToReassignmentMs: 15000, triggerToResponseMs: 45000 });
  });
});
