/** Who may see the shared-sandbox controls. The API still decides; this only avoids showing buttons that cannot work. */
export function canUseDemoControls(groups: readonly string[]): boolean {
  return groups.includes("OPERATOR") || groups.includes("SUPERVISOR");
}

export type DemoControlAction = "start a heat spike" | "reset the demo";

/** Turns an API failure into one plain sentence, keeping the server's reason. */
export function demoControlErrorMessage(action: DemoControlAction, error: unknown): string {
  const reason = error instanceof Error && error.message ? error.message.trim() : "";
  const base = `Could not ${action}.`;
  if (!reason) return `${base} Please try again.`;
  // The API client reports bare gateway refusals as "API request failed: <status>".
  if (/failed: 401\b/.test(reason)) return `${base} Your sign-in was not accepted. Sign out and sign in again.`;
  if (/failed: 403\b/.test(reason)) return `${base} This account is not allowed to do that.`;
  const sentence = /[.!?]$/.test(reason) ? reason : `${reason}.`;
  const accessDenied = /access required/i.test(reason);
  return accessDenied
    ? `${base} ${sentence} If you are the supervisor, the backend update that lets supervisors use these controls may not be deployed yet.`
    : `${base} ${sentence}`;
}

/** The few facts about the shared demo that decide whether a heat spike can raise an alert right now. */
export interface SpikeFacts {
  activeInterventions: readonly unknown[];
  workers: ReadonlyArray<{ workerId: string; state: string; activeMinutes: number }>;
  tasks: ReadonlyArray<{ taskId: string; assigneeId?: string | null }>;
}

export type SpikePlan =
  | { kind: "start" }
  | { kind: "reset-then-start"; reason: string }
  | { kind: "blocked"; reason: string };

/** Ravi has to be at least this long into his shift for the spike readings to reach the HIGH rule. */
export const SPIKE_EXPOSURE_MINUTES = 60;

/**
 * "Start heat spike" should just work. If Ravi is not in the opening state (he already resumed, is in
 * an alert, or the delivery moved), reset first and then start. The one thing it will not do is reset
 * underneath an alert that is running right now.
 */
export function planHeatSpike(facts: SpikeFacts): SpikePlan {
  if (facts.activeInterventions.length > 0) {
    return { kind: "blocked", reason: "An alert is already running. Let it finish, or reset the demo first." };
  }
  const ravi = facts.workers.find((worker) => worker.workerId === "ravi-001");
  if (!ravi) return { kind: "reset-then-start", reason: "Ravi's data was missing" };
  if (ravi.state !== "SAFE") return { kind: "reset-then-start", reason: `Ravi was ${ravi.state.toLowerCase().replaceAll("_", " ")}` };
  if (ravi.activeMinutes < SPIKE_EXPOSURE_MINUTES) return { kind: "reset-then-start", reason: "Ravi's active time was back at zero" };
  const delivery = facts.tasks.find((task) => task.taskId === "delivery-001");
  if (delivery?.assigneeId !== "ravi-001") return { kind: "reset-then-start", reason: "the delivery was no longer with Ravi" };
  return { kind: "start" };
}

/** The backend answers 409 DEMO_NOT_READY with this wording when the readings raised no alert for Ravi. */
export function isDemoNotReady(error: unknown): boolean {
  return error instanceof Error && /Reset the demo to restore/i.test(error.message);
}
