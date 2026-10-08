import { describe, expect, it, vi } from "vitest";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { HeatRiskRaisedEnvelope } from "@taapsaathi/contracts";
import { DynamoRepository } from "../src/dynamo-repository.js";

const envelope: HeatRiskRaisedEnvelope = {
  schemaVersion: 1,
  eventId: "evt-001",
  eventType: "HeatRiskRaised",
  source: "DEMO_SIMULATOR",
  occurredAt: "2026-10-08T10:00:00.000Z",
  correlationId: "corr-001",
  demoGeneration: 4,
  payload: {
    hubId: "hub-delhi-001",
    workerId: "ravi-001",
    shiftId: "shift-demo-001",
    riskLevel: "HIGH",
    matchedRule: "HEAT_ALERT_WITH_ACTIVE_EXPOSURE",
    temperatureC: 45.2,
    apparentTemperatureC: 49.1,
    activeMinutes: 75,
    idempotencyKey: "shift-demo-001#ravi-001#g4#window-01",
    policyVersion: "heat-policy-v1",
  },
};

describe("DynamoDB transaction adapter", () => {
  it("claims an event with a generation condition and conditional lock in one transaction", async () => {
    const send = vi.fn().mockResolvedValue({});
    const repository = new DynamoRepository("TaapSaathiTest", { send } as never);
    expect(await repository.claimRiskEvent(envelope, "int-001", 999999)).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(TransactWriteCommand);
    const items = (command as TransactWriteCommand).input.TransactItems;
    expect(items).toHaveLength(2);
    expect(items?.[0]?.ConditionCheck?.ConditionExpression).toContain("#value = :generation");
    expect(items?.[1]?.Put?.ConditionExpression).toBe("attribute_not_exists(PK)");
  });
});
