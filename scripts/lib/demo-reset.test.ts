import { describe, expect, it } from "vitest";
import { checkCleanState, describeState, parseArgs, type DashboardSnapshot } from "./demo-reset.js";

const clean: DashboardSnapshot = {
  demoGeneration: 38,
  workers: [
    { workerId: "ravi-001", state: "SAFE" },
    { workerId: "asha-001", state: "SAFE" },
    { workerId: "imran-001", state: "CAUTION" },
  ],
  tasks: [{ taskId: "delivery-001", assigneeId: "ravi-001" }],
  activeInterventions: [],
};

describe("checkCleanState", () => {
  it("accepts the opening state (Imran's CAUTION is part of it)", () => {
    expect(checkCleanState(clean)).toEqual({ clean: true, problems: [] });
  });

  it("flags Ravi awaiting a supervisor, as seen on the live demo", () => {
    const stuck = { ...clean, workers: clean.workers.map((worker) => worker.workerId === "ravi-001" ? { ...worker, state: "AWAITING_SUPERVISOR" } : worker), tasks: [{ taskId: "delivery-001", assigneeId: "asha-001" }] };
    const result = checkCleanState(stuck);
    expect(result.clean).toBe(false);
    expect(result.problems).toEqual(["Ravi is AWAITING_SUPERVISOR, expected SAFE", "delivery-001 is with asha-001, expected ravi-001"]);
  });

  it("flags an open intervention and a missing delivery", () => {
    const result = checkCleanState({ ...clean, activeInterventions: [{}], tasks: [] });
    expect(result.problems).toEqual(["1 active intervention(s) are still open", "delivery-001 is with nobody, expected ravi-001"]);
  });

  it("flags a missing rider rather than treating it as safe", () => {
    expect(checkCleanState({ ...clean, workers: [] }).problems).toContain("Ravi is missing, expected SAFE");
  });
});

describe("describeState", () => {
  it("summarises generation, riders, delivery and active count", () => {
    expect(describeState(clean)).toBe("generation 38 | ravi=SAFE, asha=SAFE, imran=CAUTION | delivery-001 with ravi-001 | 0 active");
  });
});

describe("parseArgs", () => {
  it("defaults to a confirmed reset", () => {
    expect(parseArgs([])).toMatchObject({ mode: "reset", yes: false, force: false, help: false, errors: [] });
  });

  it("reads flags and a username", () => {
    expect(parseArgs(["--check"]).mode).toBe("check");
    expect(parseArgs(["--yes", "--force", "--user", "demo-operator"])).toMatchObject({ yes: true, force: true, username: "demo-operator", errors: [] });
  });

  it("rejects unknown options and a missing username", () => {
    expect(parseArgs(["--wat"]).errors).toEqual(["Unknown option: --wat"]);
    expect(parseArgs(["--user"]).errors).toEqual(["--user needs a username"]);
    expect(parseArgs(["--user", "--yes"]).errors).toEqual(["--user needs a username"]);
  });
});
