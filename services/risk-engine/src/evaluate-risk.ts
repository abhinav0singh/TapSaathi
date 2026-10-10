import {
  RiskDecisionSchema,
  RiskInputSchema,
  type RiskDecision,
  type RiskInput,
} from "@taapsaathi/contracts";
import { evaluatePolicy } from "./policy.js";

export const CURRENT_POLICY_VERSION = "heat-policy-v2";

/**
 * Pure deterministic policy evaluation. The timestamp and policy version are
 * inputs so identical input produces byte-equivalent output.
 */
export function evaluateRisk(unparsed: RiskInput): RiskDecision {
  const input = RiskInputSchema.parse(unparsed);
  return RiskDecisionSchema.parse(evaluatePolicy(input));
}
