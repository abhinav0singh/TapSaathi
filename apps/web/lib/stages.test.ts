import { describe, expect, it } from "vitest";
import { stageView } from "./stages";

const states = (status: Parameters<typeof stageView>[0]["status"], escalationReason?: "FEEL_UNWELL" | "WORKER_TIMEOUT" | "NO_ELIGIBLE_WORKER") =>
  stageView({ status, escalationReason }, "Ravi").stages.map((stage) => `${stage.id}:${stage.state}`);

describe("stageView", () => {
  it("shows the rider as the current stage while waiting for a reply", () => {
    expect(states("AWAITING_WORKER")).toEqual([
      "detected:done",
      "guided:done",
      "replies:current",
      "covered:todo",
      "resolved:todo",
    ]);
  });

  it("marks everything done once resolved", () => {
    expect(stageView({ status: "COMPLETED" }, "Ravi").stages.every((stage) => stage.state === "done")).toBe(true);
  });

  it("adds a supervisor stage on escalation", () => {
    expect(states("AWAITING_SUPERVISOR", "FEEL_UNWELL")).toEqual([
      "detected:done",
      "guided:done",
      "replies:done",
      "covered:done",
      "supervisor:current",
      "resolved:todo",
    ]);
  });

  it("flags a rider who never replied", () => {
    expect(states("AWAITING_SUPERVISOR", "WORKER_TIMEOUT")).toContain("replies:alert");
  });

  it("flags an unacknowledged escalation as an alert and a failed run", () => {
    const view = stageView({ status: "SUPERVISOR_UNACKNOWLEDGED", escalationReason: "FEEL_UNWELL" }, "Ravi");
    expect(view.stages.find((stage) => stage.id === "supervisor")?.state).toBe("alert");
    expect(view.failed).toBe(true);
  });

  it("flags the delivery stage when nobody can take it", () => {
    expect(states("REASSIGNMENT_REQUIRED", "NO_ELIGIBLE_WORKER")).toContain("covered:alert");
  });

  it("names the rider in the summary", () => {
    expect(stageView({ status: "REASSIGNING" }, "Ravi").summary).toContain("Ravi");
  });
});
