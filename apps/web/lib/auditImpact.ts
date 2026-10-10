import type { AuditEvent } from "@taapsaathi/contracts";
const elapsed = (start?: AuditEvent, end?: AuditEvent) => start && end ? Math.max(0, new Date(end.occurredAt).getTime() - new Date(start.occurredAt).getTime()) : null;
export function auditImpact(events: AuditEvent[], generation: number) {
  const current = events.filter((event) => event.demoGeneration === generation);
  const first = (items: AuditEvent[], name: string) => items.filter((event) => event.eventType === name).toSorted((a, b) => a.occurredAt.localeCompare(b.occurredAt))[0];
  const created = first(current, "INTERVENTION_CREATED");
  const related = created ? current.filter((event) => event.interventionId === created.interventionId) : [];
  return { interventionCount: current.filter((event) => event.eventType === "INTERVENTION_CREATED").length, escalationCount: current.filter((event) => event.eventType === "SUPERVISOR_ESCALATED").length, triggerToReassignmentMs: elapsed(created, first(related, "DELIVERY_REASSIGNED")), triggerToResponseMs: elapsed(created, first(related, "RESPONSE_ACCEPTED")) };
}
