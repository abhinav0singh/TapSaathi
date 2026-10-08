import { randomUUID } from "node:crypto";
import {
  HeatObservationSchema,
  HeatRiskRaisedEnvelopeSchema,
  type HeatObservation,
  type HeatRiskRaisedEnvelope,
  type Worker,
} from "@taapsaathi/contracts";
import { CURRENT_POLICY_VERSION, evaluateRisk } from "./evaluate-risk.js";

export interface ObservationContext {
  workers: Worker[];
  demoGeneration: number;
  maxContinuousMinutes: number;
  correlationId?: string;
  now?: string;
  idFactory?: () => string;
}

export interface ObservationResult {
  decisions: Array<{ workerId: string; state: string; matchedRule: string }>;
  events: HeatRiskRaisedEnvelope[];
}

export function processObservation(
  unparsed: HeatObservation,
  context: ObservationContext,
): ObservationResult {
  const observation = HeatObservationSchema.parse(unparsed);
  const occurredAt = context.now ?? observation.observedAt;
  const correlationId = context.correlationId ?? randomUUID();
  const idFactory = context.idFactory ?? randomUUID;
  const decisions: ObservationResult["decisions"] = [];
  const events: HeatRiskRaisedEnvelope[] = [];

  for (const worker of [...context.workers].sort((a, b) => a.workerId.localeCompare(b.workerId))) {
    if (!worker.shiftActive || worker.hubId !== observation.hubId) continue;
    const decision = evaluateRisk({
      officialHeatAlert: observation.officialHeatAlert,
      temperatureC: observation.temperatureC,
      apparentTemperatureC: observation.apparentTemperatureC,
      relativeHumidity: observation.relativeHumidity,
      activeMinutes: worker.activeMinutes,
      maxContinuousMinutes: context.maxContinuousMinutes,
      symptomReported: false,
      policyVersion: CURRENT_POLICY_VERSION,
      evaluatedAt: occurredAt,
    });
    decisions.push({ workerId: worker.workerId, state: decision.state, matchedRule: decision.matchedRule });

    if (decision.state !== "HIGH" && decision.state !== "CRITICAL") continue;
    const eventId = `evt-${idFactory()}`;
    events.push(HeatRiskRaisedEnvelopeSchema.parse({
      schemaVersion: 1,
      eventId,
      eventType: "HeatRiskRaised",
      occurredAt,
      correlationId,
      demoGeneration: context.demoGeneration,
      source: observation.source,
      payload: {
        hubId: observation.hubId,
        workerId: worker.workerId,
        shiftId: worker.shiftId,
        riskLevel: decision.state,
        matchedRule: decision.matchedRule,
        temperatureC: observation.temperatureC,
        apparentTemperatureC: observation.apparentTemperatureC,
        activeMinutes: worker.activeMinutes,
        idempotencyKey: `${worker.shiftId}#${worker.workerId}#g${context.demoGeneration}#${observation.observationId}`,
        policyVersion: decision.policyVersion,
      },
    }));
  }
  return { decisions, events };
}
