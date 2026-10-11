export const HEAT_THRESHOLDS = { elevatedApparentC: 32, dangerApparentC: 39, extremeApparentC: 52, dangerAirTemperatureC: 45 } as const;
export type HeatPolicyInput = { officialHeatAlert: boolean; temperatureC: number; apparentTemperatureC: number; relativeHumidity: number; activeMinutes: number; maxContinuousMinutes: number; symptomReported: boolean; policyVersion: string; evaluatedAt: string };
export type HeatPolicyMatchedRule = "NO_POLICY_MATCH" | "ELEVATED_HEAT_INDEX" | "OFFICIAL_HEAT_ALERT" | "HEAT_ALERT_WITH_ACTIVE_EXPOSURE" | "HEAT_THRESHOLD" | "HEAT_THRESHOLD_WITH_ACTIVE_EXPOSURE" | "EXTREME_HEAT_INDEX" | "WORKER_REPORTED_SYMPTOM";
export type HeatPolicyDecision = { state: "SAFE" | "CAUTION" | "HIGH" | "CRITICAL"; matchedRule: HeatPolicyMatchedRule; recommendedAction: "CONTINUE" | "PREPARE_BREAK" | "TAKE_BREAK" | "ESCALATE"; policyVersion: string; evaluatedAt: string; evidence: Omit<HeatPolicyInput, "policyVersion" | "evaluatedAt"> };
/** Deterministic demonstration policy shared by backend and recorded replay; not medical advice. */
export function evaluateHeatPolicy(input: HeatPolicyInput): HeatPolicyDecision {
  const evidence = { officialHeatAlert: input.officialHeatAlert, temperatureC: input.temperatureC, apparentTemperatureC: input.apparentTemperatureC, relativeHumidity: input.relativeHumidity, activeMinutes: input.activeMinutes, maxContinuousMinutes: input.maxContinuousMinutes, symptomReported: input.symptomReported };
  const common = { policyVersion: input.policyVersion, evaluatedAt: input.evaluatedAt, evidence };
  const exposed = input.activeMinutes >= input.maxContinuousMinutes;
  if (input.symptomReported) return { ...common, state: "CRITICAL", matchedRule: "WORKER_REPORTED_SYMPTOM", recommendedAction: "ESCALATE" };
  if (input.apparentTemperatureC >= HEAT_THRESHOLDS.extremeApparentC) return { ...common, state: "HIGH", matchedRule: "EXTREME_HEAT_INDEX", recommendedAction: "TAKE_BREAK" };
  if (input.officialHeatAlert && exposed) return { ...common, state: "HIGH", matchedRule: "HEAT_ALERT_WITH_ACTIVE_EXPOSURE", recommendedAction: "TAKE_BREAK" };
  if (input.officialHeatAlert) return { ...common, state: "CAUTION", matchedRule: "OFFICIAL_HEAT_ALERT", recommendedAction: "PREPARE_BREAK" };
  const dangerous = input.apparentTemperatureC >= HEAT_THRESHOLDS.dangerApparentC || input.temperatureC >= HEAT_THRESHOLDS.dangerAirTemperatureC;
  if (dangerous && exposed) return { ...common, state: "HIGH", matchedRule: "HEAT_THRESHOLD_WITH_ACTIVE_EXPOSURE", recommendedAction: "TAKE_BREAK" };
  if (dangerous) return { ...common, state: "CAUTION", matchedRule: "HEAT_THRESHOLD", recommendedAction: "PREPARE_BREAK" };
  if (input.apparentTemperatureC >= HEAT_THRESHOLDS.elevatedApparentC) return { ...common, state: "CAUTION", matchedRule: "ELEVATED_HEAT_INDEX", recommendedAction: "PREPARE_BREAK" };
  return { ...common, state: "SAFE", matchedRule: "NO_POLICY_MATCH", recommendedAction: "CONTINUE" };
}
