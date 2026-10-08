import { describe, expect, it } from "vitest";
import { evaluateRisk } from "../src/evaluate-risk.js";

const base = {
  officialHeatAlert: false,
  temperatureC: 35,
  apparentTemperatureC: 37,
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
      temperatureC: 35,
      apparentTemperatureC: 37,
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
});
