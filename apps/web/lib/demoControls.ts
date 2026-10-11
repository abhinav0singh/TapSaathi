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
