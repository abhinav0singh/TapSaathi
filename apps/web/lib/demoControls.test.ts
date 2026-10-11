import { describe, expect, it } from "vitest";
import { canUseDemoControls, demoControlErrorMessage, isDemoNotReady, planHeatSpike, type SpikeFacts } from "./demoControls";

describe("canUseDemoControls", () => {
  it("shows the controls to the operator and the supervisor only", () => {
    expect(canUseDemoControls(["OPERATOR"])).toBe(true);
    expect(canUseDemoControls(["SUPERVISOR"])).toBe(true);
    expect(canUseDemoControls(["WORKER"])).toBe(false);
    expect(canUseDemoControls([])).toBe(false);
  });

  it("does not match partial or differently cased group names", () => {
    expect(canUseDemoControls(["operator"])).toBe(false);
    expect(canUseDemoControls(["OPERATORS"])).toBe(false);
    expect(canUseDemoControls(["SUPERVISOR_READONLY"])).toBe(false);
  });
});

describe("demoControlErrorMessage", () => {
  it("keeps the server's reason in one sentence", () => {
    expect(demoControlErrorMessage("reset the demo", new Error("A reset is already running"))).toBe("Could not reset the demo. A reset is already running.");
  });

  it("explains an access error that a supervisor may see before the backend is updated", () => {
    const message = demoControlErrorMessage("start a heat spike", new Error("Operator access required."));
    expect(message).toContain("Could not start a heat spike. Operator access required.");
    expect(message).toContain("supervisor");
  });

  it("turns bare gateway refusals into plain advice", () => {
    expect(demoControlErrorMessage("reset the demo", new Error("API request failed: 401"))).toBe("Could not reset the demo. Your sign-in was not accepted. Sign out and sign in again.");
    expect(demoControlErrorMessage("start a heat spike", new Error("API request failed: 403"))).toBe("Could not start a heat spike. This account is not allowed to do that.");
    expect(demoControlErrorMessage("reset the demo", new Error("API request failed: 500"))).toBe("Could not reset the demo. API request failed: 500.");
  });

  it("falls back to a plain retry message", () => {
    expect(demoControlErrorMessage("reset the demo", "boom")).toBe("Could not reset the demo. Please try again.");
  });
});

const opening: SpikeFacts = {
  activeInterventions: [],
  workers: [
    { workerId: "ravi-001", state: "SAFE", activeMinutes: 75 },
    { workerId: "asha-001", state: "SAFE", activeMinutes: 20 },
    { workerId: "imran-001", state: "CAUTION", activeMinutes: 50 },
  ],
  tasks: [{ taskId: "delivery-001", assigneeId: "ravi-001" }],
};
const withRavi = (patch: Partial<SpikeFacts["workers"][number]>): SpikeFacts => ({
  ...opening,
  workers: opening.workers.map((worker) => (worker.workerId === "ravi-001" ? { ...worker, ...patch } : worker)),
});

describe("planHeatSpike", () => {
  it("just starts when the demo is in its opening state", () => {
    expect(planHeatSpike(opening)).toEqual({ kind: "start" });
  });

  it("resets first when Ravi has just resumed work (active time back at zero)", () => {
    expect(planHeatSpike(withRavi({ activeMinutes: 0 }))).toEqual({ kind: "reset-then-start", reason: "Ravi's active time was back at zero" });
  });

  it("treats exactly 60 active minutes as ready and 59 as not ready", () => {
    expect(planHeatSpike(withRavi({ activeMinutes: 60 }))).toEqual({ kind: "start" });
    expect(planHeatSpike(withRavi({ activeMinutes: 59 })).kind).toBe("reset-then-start");
  });

  it("resets first when Ravi is waiting on a supervisor, resting or at risk", () => {
    expect(planHeatSpike(withRavi({ state: "AWAITING_SUPERVISOR" }))).toEqual({ kind: "reset-then-start", reason: "Ravi was awaiting supervisor" });
    expect(planHeatSpike(withRavi({ state: "RESTING" })).kind).toBe("reset-then-start");
  });

  it("resets first when the delivery is no longer with Ravi", () => {
    expect(planHeatSpike({ ...opening, tasks: [{ taskId: "delivery-001", assigneeId: "asha-001" }] }).kind).toBe("reset-then-start");
    expect(planHeatSpike({ ...opening, tasks: [] }).kind).toBe("reset-then-start");
  });

  it("never resets underneath an alert that is running", () => {
    expect(planHeatSpike({ ...opening, activeInterventions: [{}] }).kind).toBe("blocked");
    expect(planHeatSpike({ ...withRavi({ state: "HIGH", activeMinutes: 0 }), activeInterventions: [{}] }).kind).toBe("blocked");
  });

  it("treats missing rider data as not ready", () => {
    expect(planHeatSpike({ ...opening, workers: [] }).kind).toBe("reset-then-start");
  });
});

describe("isDemoNotReady", () => {
  it("recognises the backend's reset-first answer and nothing else", () => {
    expect(isDemoNotReady(new Error("This heat reading did not raise an alert because Ravi has not been working long enough. Reset the demo to restore his active time, then start the heat spike again."))).toBe(true);
    expect(isDemoNotReady(new Error("API request failed: 401"))).toBe(false);
    expect(isDemoNotReady("nope")).toBe(false);
  });
});
