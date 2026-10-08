export interface PolicyInput {
  officialHeatAlert: boolean;
  temperatureC: number;
  apparentTemperatureC: number;
  relativeHumidity: number;
  activeMinutes: number;
  maxContinuousMinutes: number;
  symptomReported: boolean;
  policyVersion: string;
  evaluatedAt: string;
}

export interface PolicyDecision {
  state: "SAFE" | "CAUTION" | "HIGH" | "CRITICAL";
  matchedRule: "NO_POLICY_MATCH" | "OFFICIAL_HEAT_ALERT" | "HEAT_ALERT_WITH_ACTIVE_EXPOSURE" | "WORKER_REPORTED_SYMPTOM";
  recommendedAction: "CONTINUE" | "PREPARE_BREAK" | "TAKE_BREAK" | "ESCALATE";
  policyVersion: string;
  evaluatedAt: string;
  evidence: {
    officialHeatAlert: boolean;
    temperatureC: number;
    apparentTemperatureC: number;
    relativeHumidity: number;
    activeMinutes: number;
    maxContinuousMinutes: number;
    symptomReported: boolean;
  };
}

export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  const evidence = {
    officialHeatAlert: input.officialHeatAlert,
    temperatureC: input.temperatureC,
    apparentTemperatureC: input.apparentTemperatureC,
    relativeHumidity: input.relativeHumidity,
    activeMinutes: input.activeMinutes,
    maxContinuousMinutes: input.maxContinuousMinutes,
    symptomReported: input.symptomReported,
  };
  const common = { policyVersion: input.policyVersion, evaluatedAt: input.evaluatedAt, evidence };
  if (input.symptomReported) return { ...common, state: "CRITICAL", matchedRule: "WORKER_REPORTED_SYMPTOM", recommendedAction: "ESCALATE" };
  if (input.officialHeatAlert && input.activeMinutes >= input.maxContinuousMinutes) return { ...common, state: "HIGH", matchedRule: "HEAT_ALERT_WITH_ACTIVE_EXPOSURE", recommendedAction: "TAKE_BREAK" };
  if (input.officialHeatAlert) return { ...common, state: "CAUTION", matchedRule: "OFFICIAL_HEAT_ALERT", recommendedAction: "PREPARE_BREAK" };
  return { ...common, state: "SAFE", matchedRule: "NO_POLICY_MATCH", recommendedAction: "CONTINUE" };
}
