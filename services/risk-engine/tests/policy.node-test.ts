import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluatePolicy } from "../src/policy.ts";

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

describe("deterministic risk policy", () => {
  it("covers safe, caution, high, critical, and boundary precedence", () => {
    assert.deepEqual([59, 60, 61].map((activeMinutes) => evaluatePolicy({ ...base, officialHeatAlert: true, activeMinutes }).state), ["CAUTION", "HIGH", "HIGH"]);
    assert.equal(evaluatePolicy(base).matchedRule, "NO_POLICY_MATCH");
    assert.equal(evaluatePolicy({ ...base, officialHeatAlert: true }).matchedRule, "OFFICIAL_HEAT_ALERT");
    assert.equal(evaluatePolicy({ ...base, officialHeatAlert: true, activeMinutes: 60 }).matchedRule, "HEAT_ALERT_WITH_ACTIVE_EXPOSURE");
    assert.equal(evaluatePolicy({ ...base, symptomReported: true }).matchedRule, "WORKER_REPORTED_SYMPTOM");
  });

  it("selects rules from the readings when no official alert exists", () => {
    assert.equal(evaluatePolicy({ ...base, apparentTemperatureC: 32 }).matchedRule, "ELEVATED_HEAT_INDEX");
    assert.equal(evaluatePolicy({ ...base, apparentTemperatureC: 39 }).matchedRule, "HEAT_THRESHOLD");
    assert.equal(evaluatePolicy({ ...base, apparentTemperatureC: 39, activeMinutes: 60 }).matchedRule, "HEAT_THRESHOLD_WITH_ACTIVE_EXPOSURE");
    assert.equal(evaluatePolicy({ ...base, apparentTemperatureC: 52 }).matchedRule, "EXTREME_HEAT_INDEX");
    assert.equal(evaluatePolicy({ ...base, temperatureC: 45 }).matchedRule, "HEAT_THRESHOLD");
  });

  it("returns byte-identical output 100 times", () => {
    const expected = JSON.stringify(evaluatePolicy(base));
    for (let index = 0; index < 100; index += 1) assert.equal(JSON.stringify(evaluatePolicy(base)), expected);
  });
});
