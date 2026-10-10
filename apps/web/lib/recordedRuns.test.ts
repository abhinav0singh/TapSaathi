import { describe, expect, it } from "vitest";
import { recordedRuns } from "./recordedRuns";

const toSeconds = (at: string) => {
  const [h, m, s] = at.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};

describe("recorded runs", () => {
  it("lists steps in time order", () => {
    for (const run of recordedRuns) {
      const times = run.steps.map((step) => toSeconds(step.at));
      expect([...times].sort((a, b) => a - b)).toEqual(times);
    }
  });

  it("starts with the policy decision and never has a rider's delivery move back", () => {
    for (const run of recordedRuns) {
      expect(run.steps[0]?.event).toBe("INTERVENTION_CREATED");
      const owners = run.steps.map((step) => step.deliveryOwner);
      const firstAsha = owners.indexOf("Asha");
      expect(owners.slice(firstAsha).every((owner) => owner === "Asha")).toBe(true);
    }
  });

  it("secures the delivery before escalating in the unwell run", () => {
    const run = recordedRuns.find((item) => item.id === "feel-unwell")!;
    const events = run.steps.map((step) => step.event);
    expect(events.indexOf("DELIVERY_REASSIGNED")).toBeLessThan(events.indexOf("SUPERVISOR_ESCALATED"));
  });

  it("keeps the rider's resume as the last recorded step of the unwell run", () => {
    const run = recordedRuns.find((item) => item.id === "feel-unwell")!;
    expect(run.steps.at(-1)?.event).toBe("RIDER_RESUMED_WORK");
    expect(run.steps.at(-1)?.workers.ravi).toBe("SAFE");
  });
});
