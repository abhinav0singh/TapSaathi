import { describe, expect, it } from "vitest";
import {
  ErrorEnvelopeSchema,
  HeatRiskRaisedSchema,
  HeatRiskRaisedEnvelopeSchema,
  RespondRequestSchema,
} from "../src/index.js";

const event = {
  schemaVersion: 1 as const,
  eventId: "evt-test-001",
  eventType: "HeatRiskRaised" as const,
  source: "DEMO_SIMULATOR" as const,
  hubId: "hub-delhi-001",
  workerId: "ravi-001",
  shiftId: "shift-demo-001",
  riskLevel: "HIGH" as const,
  matchedRule: "HEAT_ALERT_WITH_ACTIVE_EXPOSURE",
  temperatureC: 45.2,
  apparentTemperatureC: 49.1,
  activeMinutes: 75,
  idempotencyKey: "shift-demo-001#ravi-001#g1#window-01",
  policyVersion: "heat-policy-v1",
  correlationId: "corr-test-001",
  demoGeneration: 1,
  occurredAt: "2026-10-08T10:00:00.000Z",
};

describe("shared contracts", () => {
  it("CT-001 accepts a complete v1 heat-risk event without mutation", () => {
    expect(HeatRiskRaisedSchema.parse(event)).toEqual(event);
  });

  it("CT-002 rejects a missing idempotency key", () => {
    const { idempotencyKey: _removed, ...invalid } = event;
    expect(HeatRiskRaisedSchema.safeParse(invalid).success).toBe(false);
  });

  it("CT-003 rejects an unknown schema version", () => {
    expect(HeatRiskRaisedSchema.safeParse({ ...event, schemaVersion: 2 }).success).toBe(false);
  });

  it("accepts the versioned envelope required by the workflow", () => {
    expect(HeatRiskRaisedEnvelopeSchema.safeParse({
      schemaVersion: 1,
      eventId: event.eventId,
      eventType: event.eventType,
      source: event.source,
      occurredAt: event.occurredAt,
      correlationId: event.correlationId,
      demoGeneration: event.demoGeneration,
      payload: {
        hubId: event.hubId,
        workerId: event.workerId,
        shiftId: event.shiftId,
        riskLevel: event.riskLevel,
        matchedRule: event.matchedRule,
        temperatureC: event.temperatureC,
        apparentTemperatureC: event.apparentTemperatureC,
        activeMinutes: event.activeMinutes,
        idempotencyKey: event.idempotencyKey,
        policyVersion: event.policyVersion,
      },
    }).success).toBe(true);
  });

  it("CT-005 keeps the stable error envelope", () => {
    expect(ErrorEnvelopeSchema.parse({ error: { code: "NOT_FOUND", message: "Not found", requestId: "req-1" } }))
      .toEqual({ error: { code: "NOT_FOUND", message: "Not found", requestId: "req-1" } });
  });

  it("rejects mismatched actor and action combinations", () => {
    expect(RespondRequestSchema.safeParse({
      actorId: "ravi-001",
      actorType: "WORKER",
      action: "SUPERVISOR_ACK",
      clientRequestId: "86cd2d77-4502-4e9b-92c1-d625cc9a7084",
    }).success).toBe(false);
  });
});
