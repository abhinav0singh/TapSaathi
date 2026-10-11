import type { AuditEvent, Worker } from "@taapsaathi/contracts";
import { latestSupervisorOutcome } from "./supervisorOutcome";

export type SupervisorFollowUp = {
  workerId: string;
  completedAt: string;
  status: "ACKNOWLEDGED" | "UNACKNOWLEDGED";
};

/**
 * A terminal supervisor outcome is meaningful only after the active intervention reference has
 * been cleared. Keeping this distinction explicit prevents a completed timeout from being shown
 * as a currently active heat alert.
 */
export function supervisorFollowUpForWorker(
  worker: Pick<Worker, "workerId" | "state" | "activeInterventionId" | "demoGeneration">,
  events: AuditEvent[],
  demoGeneration: number,
): SupervisorFollowUp | null {
  if (
    worker.demoGeneration !== demoGeneration ||
    worker.state !== "AWAITING_SUPERVISOR" ||
    worker.activeInterventionId
  ) {
    return null;
  }

  const outcome = latestSupervisorOutcome(events, worker.workerId, demoGeneration);
  return outcome
    ? {
        workerId: worker.workerId,
        completedAt: outcome.completedAt,
        status: outcome.status,
      }
    : null;
}
