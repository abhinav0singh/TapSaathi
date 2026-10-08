import { z } from "zod";
import { IsoDateSchema } from "./entities.js";

export const EventSourceSchema = z.enum([
  "LIVE_WEATHER",
  "CACHED_WEATHER",
  "DEMO_SIMULATOR",
  "TAAPSAATHI_WORKFLOW",
  "TAAPSAATHI_API",
]);

export const HeatObservationSchema = z.object({
  schemaVersion: z.literal(1),
  observationId: z.string().min(1),
  source: z.enum(["LIVE_WEATHER", "CACHED_WEATHER", "DEMO_SIMULATOR"]),
  hubId: z.string().min(1),
  temperatureC: z.number().finite(),
  relativeHumidity: z.number().min(0).max(100),
  apparentTemperatureC: z.number().finite(),
  officialHeatAlert: z.boolean(),
  observedAt: IsoDateSchema,
});

export const RiskInputSchema = z.object({
  officialHeatAlert: z.boolean(),
  temperatureC: z.number().finite(),
  apparentTemperatureC: z.number().finite(),
  relativeHumidity: z.number().min(0).max(100),
  activeMinutes: z.number().int().nonnegative(),
  maxContinuousMinutes: z.number().int().positive(),
  symptomReported: z.boolean(),
  policyVersion: z.string().min(1),
  evaluatedAt: IsoDateSchema,
});

export const RiskDecisionSchema = z.object({
  state: z.enum(["SAFE", "CAUTION", "HIGH", "CRITICAL"]),
  matchedRule: z.enum([
    "NO_POLICY_MATCH",
    "OFFICIAL_HEAT_ALERT",
    "HEAT_ALERT_WITH_ACTIVE_EXPOSURE",
    "WORKER_REPORTED_SYMPTOM",
  ]),
  recommendedAction: z.enum(["CONTINUE", "PREPARE_BREAK", "TAKE_BREAK", "ESCALATE"]),
  policyVersion: z.string().min(1),
  evaluatedAt: IsoDateSchema,
  evidence: z.object({
    officialHeatAlert: z.boolean(),
    temperatureC: z.number(),
    apparentTemperatureC: z.number(),
    relativeHumidity: z.number(),
    activeMinutes: z.number().int(),
    maxContinuousMinutes: z.number().int(),
    symptomReported: z.boolean(),
  }),
});

export const HeatRiskRaisedPayloadSchema = z.object({
  hubId: z.string().min(1),
  workerId: z.string().min(1),
  shiftId: z.string().min(1),
  riskLevel: z.enum(["HIGH", "CRITICAL"]),
  matchedRule: z.string().min(1),
  temperatureC: z.number(),
  apparentTemperatureC: z.number(),
  activeMinutes: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(1),
  policyVersion: z.string().min(1),
});

export const HeatRiskRaisedSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string().min(1),
  eventType: z.literal("HeatRiskRaised"),
  source: z.enum(["LIVE_WEATHER", "CACHED_WEATHER", "DEMO_SIMULATOR"]),
  hubId: z.string().min(1),
  workerId: z.string().min(1),
  shiftId: z.string().min(1),
  riskLevel: z.enum(["HIGH", "CRITICAL"]),
  matchedRule: z.string().min(1),
  temperatureC: z.number(),
  apparentTemperatureC: z.number(),
  activeMinutes: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(1),
  policyVersion: z.string().min(1),
  correlationId: z.string().min(1),
  demoGeneration: z.number().int().nonnegative(),
  occurredAt: IsoDateSchema,
});

export const HeatRiskRaisedEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string().min(1),
  eventType: z.literal("HeatRiskRaised"),
  occurredAt: IsoDateSchema,
  correlationId: z.string().min(1),
  demoGeneration: z.number().int().nonnegative(),
  source: z.enum(["LIVE_WEATHER", "CACHED_WEATHER", "DEMO_SIMULATOR"]),
  payload: HeatRiskRaisedPayloadSchema,
});

export type EventSource = z.infer<typeof EventSourceSchema>;
export type HeatObservation = z.infer<typeof HeatObservationSchema>;
export type RiskInput = z.infer<typeof RiskInputSchema>;
export type RiskDecision = z.infer<typeof RiskDecisionSchema>;
export type HeatRiskRaised = z.infer<typeof HeatRiskRaisedSchema>;
export type HeatRiskRaisedPayload = z.infer<typeof HeatRiskRaisedPayloadSchema>;
export type HeatRiskRaisedEnvelope = z.infer<typeof HeatRiskRaisedEnvelopeSchema>;
