import { describe, expect, it } from "vitest";
import { evaluateRisk } from "../src/evaluate-risk.js";

const base = {
  officialHeatAlert: false,
  temperatureC: 30,
  apparentTemperatureC: 31,
  relativeHumidity: 40,
  activeMinutes: 20,
  maxContinuousMinutes: 60,
  symptomReported: false,
  policyVersion: "heat-policy-v1",
  evaluatedAt: "2026-10-08T10:00:00.000Z",
};

describe("deterministic heat-risk policy", () => {
  it("RE-001 returns SAFE", () => {
    expect(evaluateRisk(base)).toMatchObject({ state: "SAFE", matchedRule: "NO_POLICY_MATCH", recommendedAction: "CONTINUE" });
  });

  it("RE-002 returns CAUTION", () => {
    expect(evaluateRisk({ ...base, officialHeatAlert: true })).toMatchObject({ state: "CAUTION", matchedRule: "OFFICIAL_HEAT_ALERT", recommendedAction: "PREPARE_BREAK" });
  });

  it("RE-003 returns HIGH", () => {
    expect(evaluateRisk({ ...base, officialHeatAlert: true, activeMinutes: 60 })).toMatchObject({ state: "HIGH", matchedRule: "HEAT_ALERT_WITH_ACTIVE_EXPOSURE", recommendedAction: "TAKE_BREAK" });
  });

  it("RE-004 gives symptom precedence", () => {
    expect(evaluateRisk({ ...base, symptomReported: true })).toMatchObject({ state: "CRITICAL", matchedRule: "WORKER_REPORTED_SYMPTOM", recommendedAction: "ESCALATE" });
  });

  it.each([
    [59, "CAUTION"],
    [60, "HIGH"],
    [61, "HIGH"],
  ])("RE-005 handles boundary %i as %s", (activeMinutes, expected) => {
    expect(evaluateRisk({ ...base, officialHeatAlert: true, activeMinutes }).state).toBe(expected);
  });

  it("RE-006 records complete evidence", () => {
    expect(evaluateRisk(base).evidence).toEqual({
      officialHeatAlert: false,
      temperatureC: 30,
      apparentTemperatureC: 31,
      relativeHumidity: 40,
      activeMinutes: 20,
      maxContinuousMinutes: 60,
      symptomReported: false,
    });
  });

  it("RE-007 is byte deterministic for 100 evaluations", () => {
    const encoded = JSON.stringify(evaluateRisk(base));
    for (let index = 0; index < 100; index += 1) {
      expect(JSON.stringify(evaluateRisk(base))).toBe(encoded);
    }
  });

  describe("reading-driven rules (no official alert)", () => {
    it.each([
      [31.9, "SAFE", "NO_POLICY_MATCH"],
      [32, "CAUTION", "ELEVATED_HEAT_INDEX"],
      [38.9, "CAUTION", "ELEVATED_HEAT_INDEX"],
      [39, "CAUTION", "HEAT_THRESHOLD"],
      [51.9, "CAUTION", "HEAT_THRESHOLD"],
    ])("HR-001 apparent %f C with a short exposure is %s via %s", (apparentTemperatureC, state, matchedRule) => {
      expect(evaluateRisk({ ...base, apparentTemperatureC })).toMatchObject({ state, matchedRule });
    });

    it.each([
      [38.9, "CAUTION"],
      [39, "HIGH"],
    ])("HR-002 apparent %f C with the maximum exposure is %s", (apparentTemperatureC, state) => {
      expect(evaluateRisk({ ...base, apparentTemperatureC, activeMinutes: 60 }).state).toBe(state);
    });

    it("HR-003 a high air temperature alone reaches the danger band", () => {
      expect(evaluateRisk({ ...base, temperatureC: 45, apparentTemperatureC: 35, activeMinutes: 60 })).toMatchObject({
        state: "HIGH",
        matchedRule: "HEAT_THRESHOLD_WITH_ACTIVE_EXPOSURE",
        recommendedAction: "TAKE_BREAK",
      });
      expect(evaluateRisk({ ...base, temperatureC: 44.9, apparentTemperatureC: 35, activeMinutes: 60 }).state).toBe("CAUTION");
    });

    it("HR-004 an extreme apparent temperature requires a break regardless of exposure", () => {
      expect(evaluateRisk({ ...base, apparentTemperatureC: 52, activeMinutes: 1 })).toMatchObject({
        state: "HIGH",
        matchedRule: "EXTREME_HEAT_INDEX",
        recommendedAction: "TAKE_BREAK",
      });
    });

    it("HR-005 the demo spike readings select a rule from the data alone", () => {
      expect(evaluateRisk({ ...base, temperatureC: 45.2, apparentTemperatureC: 49.1, relativeHumidity: 42, activeMinutes: 75 })).toMatchObject({
        state: "HIGH",
        matchedRule: "HEAT_THRESHOLD_WITH_ACTIVE_EXPOSURE",
      });
    });

    it("HR-006 symptoms keep precedence over every reading", () => {
      expect(evaluateRisk({ ...base, apparentTemperatureC: 55, symptomReported: true }).matchedRule).toBe("WORKER_REPORTED_SYMPTOM");
    });

    it("HR-007 an official alert keeps its own rules", () => {
      expect(evaluateRisk({ ...base, officialHeatAlert: true, activeMinutes: 60 }).matchedRule).toBe("HEAT_ALERT_WITH_ACTIVE_EXPOSURE");
    });
  });
});
