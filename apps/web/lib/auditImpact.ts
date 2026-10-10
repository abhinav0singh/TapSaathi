import type { AuditEvent } from "@taapsaathi/contracts";
const elapsed = (start?: AuditEvent, end?: AuditEvent) => start && end ? Math.max(0, new Date(end.occurredAt).getTime() - new Date(start.occurredAt).getTime()) : null;
export function auditImpact(events: AuditEvent[], generation: number) {
  const current = events.filter((event) => event.demoGeneration === generation);
  const first = (name: string) => current.filter((event) => event.eventType === name).toSorted((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0];
  return { interventionCount: current.filter((event) => event.eventType === "INTERVENTION_CREATED").length, escalationCount: current.filter((event) => event.eventType === "SUPERVISOR_ESCALATED").length, triggerToReassignmentMs: elapsed(first("INTERVENTION_CREATED"), first("DELIVERY_REASSIGNED")), triggerToResponseMs: elapsed(first("INTERVENTION_CREATED"), first("RESPONSE_ACCEPTED")) };
}
