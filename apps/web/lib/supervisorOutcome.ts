import type { AuditEvent } from "@taapsaathi/contracts";

export type SupervisorOutcome = {
  interventionId: string;
  completedAt: string;
  status: "ACKNOWLEDGED" | "UNACKNOWLEDGED";
};

export function latestSupervisorOutcome(
  events: AuditEvent[],
  workerId: string,
  demoGeneration: number
): SupervisorOutcome | null {
  const completions = events
    .filter(
      (event) =>
        event.workerId === workerId &&
        event.demoGeneration === demoGeneration &&
        event.eventType === "INTERVENTION_COMPLETED"
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const event = completions[0];
  if (!event) return null;

  if (event.details.terminalStatus === "SUPERVISOR_UNACKNOWLEDGED") {
    return {
      interventionId: event.interventionId,
      completedAt: event.occurredAt,
      status: "UNACKNOWLEDGED",
    };
  }

  if (event.details.terminalStatus === "SUPERVISOR_RESPONDING") {
    const accepted = events.some(
      (candidate) =>
        candidate.interventionId === event.interventionId &&
        candidate.demoGeneration === demoGeneration &&
        candidate.eventType === "RESPONSE_ACCEPTED" &&
        candidate.actorType === "SUPERVISOR" &&
        candidate.details.action === "SUPERVISOR_ACK"
    );

    if (accepted) {
      return {
        interventionId: event.interventionId,
        completedAt: event.occurredAt,
        status: "ACKNOWLEDGED",
      };
    }
  }

  return null;
}

export function latestAcknowledgmentBySupervisor(
  events: AuditEvent[],
  supervisorId: string,
  demoGeneration: number
): AuditEvent | null {
  return (
    events
      .filter(
        (event) =>
          event.demoGeneration === demoGeneration &&
          event.eventType === "RESPONSE_ACCEPTED" &&
          event.actorType === "SUPERVISOR" &&
          event.actorId === supervisorId &&
          event.details.action === "SUPERVISOR_ACK"
      )
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0] ?? null
  );
}
