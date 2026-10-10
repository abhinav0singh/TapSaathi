import { describe, expect, it } from "vitest";
import { delhiHistoricalDecision } from "./historicalHeatReplay";

describe("Delhi historical replay", () => {
  it("evaluates the fixed archive observation through heat-policy-v2", () => {
    expect(delhiHistoricalDecision).toMatchObject({
      state: "HIGH",
      matchedRule: "HEAT_THRESHOLD_WITH_ACTIVE_EXPOSURE",
      recommendedAction: "TAKE_BREAK",
      policyVersion: "heat-policy-v2",
    });
  });
});
