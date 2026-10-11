import type { Intervention, InterventionStatus } from "@taapsaathi/contracts";

/**
 * Turns an intervention's workflow status into the stages a viewer can follow.
 * The route a run takes changes when it escalates, so the list of stages does too.
 */

export type StageState = "done" | "current" | "todo" | "alert";

export type Stage = { id: string; label: string; state: StageState };

export type StageView = {
  stages: Stage[];
  /** One plain sentence about what is happening right now. */
  summary: string;
  /** True once a supervisor is involved. */
  escalated: boolean;
  /** True when the run has ended without a clean resolution. */
  failed: boolean;
};

const ESCALATED_STATUSES: InterventionStatus[] = [
  "AWAITING_SUPERVISOR",
  "SUPERVISOR_RESPONDING",
  "SUPERVISOR_UNACKNOWLEDGED",
  "REASSIGNMENT_REQUIRED",
];

export const ESCALATION_REASONS: Record<NonNullable<Intervention["escalationReason"]>, string> = {
  FEEL_UNWELL: "reported feeling unwell",
  WORKER_TIMEOUT: "did not reply in time",
  NO_ELIGIBLE_WORKER: "could not be replaced: no rider was free to take the delivery",
};

type Id = "detected" | "guided" | "replies" | "covered" | "supervisor" | "resolved";

const LABELS: Record<Id, string> = {
  detected: "Heat risk detected",
  guided: "Rider guided",
  replies: "Rider replies",
  covered: "Delivery covered",
  supervisor: "Supervisor acknowledges",
  resolved: "Resolved",
};

function build(ids: Id[], states: Partial<Record<Id, StageState>>, fallback: StageState): Stage[] {
  return ids.map((id) => ({ id, label: LABELS[id], state: states[id] ?? fallback }));
}

/** Everything before `index` is done, `index` is `state`, everything after is todo. */
function upTo(ids: Id[], current: Id, state: StageState = "current"): Stage[] {
  const at = ids.indexOf(current);
  return ids.map((id, position) => ({
    id,
    label: LABELS[id],
    state: position < at ? "done" : position === at ? state : "todo",
  }));
}

export function stageView(
  intervention: Pick<Intervention, "status" | "escalationReason">,
  riderName: string,
): StageView {
  const { status, escalationReason } = intervention;
  const escalated = ESCALATED_STATUSES.includes(status);
  const base: Id[] = ["detected", "guided", "replies", "covered", "resolved"];
  const withSupervisor: Id[] = ["detected", "guided", "replies", "covered", "supervisor", "resolved"];

  switch (status) {
    case "CREATED":
      return { stages: upTo(base, "detected"), escalated, failed: false, summary: `Heat risk crossed the limit for ${riderName}. Starting the workflow.` };
    case "GUIDANCE_READY":
      return { stages: upTo(base, "guided"), escalated, failed: false, summary: `Preparing the route to shade and spoken guidance for ${riderName}.` };
    case "AWAITING_WORKER":
      return { stages: upTo(base, "replies"), escalated, failed: false, summary: `${riderName} has the alert. Waiting for them to take a break or say they feel unwell.` };
    case "REASSIGNING":
      return { stages: upTo(base, "covered"), escalated, failed: false, summary: `${riderName} is stopping. Finding another rider for their delivery.` };
    case "RESTING":
      return { stages: upTo(base, "resolved"), escalated, failed: false, summary: `${riderName} is resting and their delivery is covered. Waiting for them to go back to work.` };
    case "COMPLETED":
      return { stages: build(base, {}, "done"), escalated, failed: false, summary: `Resolved. ${riderName} is back in the normal flow.` };

    case "AWAITING_SUPERVISOR":
    case "SUPERVISOR_RESPONDING":
    case "SUPERVISOR_UNACKNOWLEDGED": {
      const timedOut = escalationReason === "WORKER_TIMEOUT";
      const noCover = escalationReason === "NO_ELIGIBLE_WORKER";
      const overdue = status === "SUPERVISOR_UNACKNOWLEDGED";
      const acknowledged = status === "SUPERVISOR_RESPONDING";
      const stages = build(
        withSupervisor,
        {
          replies: timedOut ? "alert" : "done",
          covered: noCover ? "alert" : "done",
          supervisor: overdue ? "alert" : acknowledged ? "done" : "current",
          resolved: acknowledged ? "current" : "todo",
        },
        "done",
      );
      const why = escalationReason ? ESCALATION_REASONS[escalationReason] : "needs a supervisor";
      const summary = overdue
        ? `No supervisor acknowledged in time. ${riderName} was told to stay somewhere safe and ask for help.`
        : acknowledged
          ? `A supervisor has acknowledged. ${riderName} can go back to work once they confirm they feel well enough.`
          : `${riderName} ${why}. Waiting for a supervisor to acknowledge.`;
      return { stages, escalated, failed: overdue, summary };
    }

    case "REASSIGNMENT_REQUIRED":
      return {
        stages: build(withSupervisor, { covered: "alert", supervisor: "current", resolved: "todo" }, "done"),
        escalated,
        failed: false,
        summary: `No rider was free to take ${riderName}'s delivery. A supervisor needs to reassign it.`,
      };

    case "FAILED":
      return { stages: build(base, {}, "todo"), escalated, failed: true, summary: `The workflow for ${riderName} failed. Check the audit trail.` };
    case "DUPLICATE":
      return { stages: build(base, {}, "todo"), escalated, failed: false, summary: "A duplicate alert was ignored. The original run is unaffected." };
  }
}
