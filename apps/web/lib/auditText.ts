import type { AuditEvent } from "@taapsaathi/contracts";
import { humanize } from "./humanize";

const TERMINAL: Record<string, string> = {
  COMPLETED: "Alert resolved",
  SUPERVISOR_RESPONDING: "Supervisor acknowledged; alert closed",
  SUPERVISOR_UNACKNOWLEDGED: "No supervisor acknowledged in time",
  REASSIGNMENT_REQUIRED: "Delivery needs a supervisor to reassign it",
  FAILED: "Alert failed",
};

/** A plain sentence for an audit event. Unknown event types fall back to readable words. */
export function eventText(event: Pick<AuditEvent, "eventType" | "actorType" | "details">, riderName: string): string {
  const action = typeof event.details.action === "string" ? event.details.action : null;

  if (event.eventType === "RESPONSE_ACCEPTED") {
    if (event.actorType === "SUPERVISOR") return "Supervisor acknowledged";
    if (action === "TAKE_BREAK") return `${riderName} chose to take a break`;
    if (action === "FEEL_UNWELL") return `${riderName} reported feeling unwell`;
  }

  if (event.eventType === "INTERVENTION_COMPLETED") {
    const terminal = typeof event.details.terminalStatus === "string" ? event.details.terminalStatus : null;
    if (terminal && TERMINAL[terminal]) return TERMINAL[terminal];
  }

  return humanize(event.eventType);
}
