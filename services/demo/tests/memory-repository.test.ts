import { describe, expect, it } from "vitest";
import type { AuditEvent, HeatRiskRaisedEnvelope, Intervention } from "@taapsaathi/contracts";
import { MemoryRepository } from "../../shared/src/memory-repository.js";

const now = "2026-10-08T10:00:00.000Z";

function event(generation: number): HeatRiskRaisedEnvelope {
  return {
    schemaVersion: 1,
    eventId: "evt-001",
    eventType: "HeatRiskRaised",
    source: "DEMO_SIMULATOR",
    occurredAt: now,
    correlationId: "corr-001",
    demoGeneration: generation,
    payload: { hubId: "hub-delhi-001", workerId: "ravi-001", shiftId: "shift-demo-001", riskLevel: "HIGH", matchedRule: "HEAT_ALERT_WITH_ACTIVE_EXPOSURE", temperatureC: 45.2, apparentTemperatureC: 49.1, activeMinutes: 75, idempotencyKey: `key-g${generation}`, policyVersion: "heat-policy-v1" },
  };
}

function intervention(generation: number): Intervention {
  return { interventionId: "int-001", eventId: "evt-001", correlationId: "corr-001", idempotencyKey: `key-g${generation}`, workerId: "ravi-001", hubId: "hub-delhi-001", taskId: "delivery-001", riskLevel: "HIGH", matchedRule: "HEAT_ALERT_WITH_ACTIVE_EXPOSURE", status: "CREATED", demoGeneration: generation, createdAt: now, updatedAt: now };
}

function audit(generation: number): AuditEvent {
  return { auditEventId: "audit-001", interventionId: "int-001", eventType: "INTERVENTION_CREATED", actorType: "SYSTEM", correlationId: "corr-001", workerId: "ravi-001", hubId: "hub-delhi-001", demoGeneration: generation, details: {}, occurredAt: now };
}

describe("repository correctness", () => {
  it("WF-004 claims a duplicate event exactly once", async () => {
    const repository = new MemoryRepository();
    const { generation } = await repository.resetDemo(now);
    expect(await repository.claimRiskEvent(event(generation), "int-001", 999)).toBe(true);
    expect(await repository.claimRiskEvent(event(generation), "int-001", 999)).toBe(false);
  });

  it("RS-001/RS-002 recreates exact seed state and increments generation", async () => {
    const repository = new MemoryRepository();
    const first = await repository.resetDemo(now);
    await repository.createIntervention(intervention(first.generation), audit(first.generation));
    const second = await repository.resetDemo(now);
    expect(second.generation).toBe(first.generation + 1);
    expect(await repository.getWorkers("hub-delhi-001")).toHaveLength(3);
    expect(await repository.getTasks("hub-delhi-001")).toEqual([expect.objectContaining({ taskId: "delivery-001", assigneeId: "ravi-001" })]);
    expect(await repository.getRestPoints("hub-delhi-001")).toHaveLength(3);
    expect(await repository.listInterventions("hub-delhi-001")).toEqual([]);
  });

  it("WF-011 rejects an operation from an old generation", async () => {
    const repository = new MemoryRepository();
    const first = await repository.resetDemo(now);
    await repository.resetDemo(now);
    await expect(repository.claimRiskEvent(event(first.generation), "int-old", 999)).rejects.toMatchObject({ code: "STALE_DEMO_GENERATION" });
  });

  it("WF-009 consumes a callback once and preserves same-request idempotency", async () => {
    const repository = new MemoryRepository();
    const { generation } = await repository.resetDemo(now);
    await repository.createIntervention(intervention(generation), audit(generation));
    await repository.registerCallback({ interventionId: "int-001", actorType: "WORKER", expectedActorId: "ravi-001", taskToken: "secret-token", demoGeneration: generation, expiresAt: 9999999999 }, now, { ...audit(generation), auditEventId: "audit-callback", eventType: "WORKER_RESPONSE_REQUESTED" });
    const input = { interventionId: "int-001", actorType: "WORKER" as const, actorId: "ravi-001", clientRequestId: "86cd2d77-4502-4e9b-92c1-d625cc9a7084", action: "TAKE_BREAK" as const, consumedAt: now };
    expect(await repository.consumeCallback(input)).toMatchObject({ duplicate: false, taskToken: "secret-token" });
    expect(await repository.consumeCallback(input)).toMatchObject({ duplicate: true });
    await expect(repository.consumeCallback({ ...input, clientRequestId: "5bb3d3d5-ea0e-4348-a63d-f8770a14a179" })).rejects.toMatchObject({ code: "ALREADY_RESPONDED" });
  });

  it("releases a callback reservation when SendTaskSuccess fails", async () => {
    const repository = new MemoryRepository();
    const { generation } = await repository.resetDemo(now);
    await repository.createIntervention(intervention(generation), audit(generation));
    await repository.registerCallback({ interventionId: "int-001", actorType: "WORKER", expectedActorId: "ravi-001", taskToken: "secret-token", demoGeneration: generation, expiresAt: 9999999999 }, now, { ...audit(generation), auditEventId: "audit-callback", eventType: "WORKER_RESPONSE_REQUESTED" });
    const input = { interventionId: "int-001", actorType: "WORKER" as const, actorId: "ravi-001", clientRequestId: "86cd2d77-4502-4e9b-92c1-d625cc9a7084", action: "TAKE_BREAK" as const, consumedAt: now };
    await repository.consumeCallback(input);
    await repository.releaseCallback({ interventionId: input.interventionId, actorType: input.actorType, clientRequestId: input.clientRequestId });
    expect(await repository.consumeCallback({ ...input, consumedAt: "2026-10-08T10:00:01.000Z" })).toMatchObject({ duplicate: false, taskToken: "secret-token" });
  });

  it("transactional repository double reassigns exactly once", async () => {
    const repository = new MemoryRepository();
    const { generation } = await repository.resetDemo(now);
    await repository.createIntervention(intervention(generation), audit(generation));
    expect(await repository.reassignTask({ interventionId: "int-001", generation, workerId: "ravi-001", taskId: "delivery-001", hubId: "hub-delhi-001", now, correlationId: "corr-001" })).toEqual({ status: "REASSIGNED", replacementWorkerId: "asha-001" });
    await expect(repository.reassignTask({ interventionId: "int-001", generation, workerId: "ravi-001", taskId: "delivery-001", hubId: "hub-delhi-001", now, correlationId: "corr-001" })).rejects.toMatchObject({ code: "TASK_OWNERSHIP_CHANGED" });
  });

  it("secures an escalated worker's delivery without clearing intervention ownership", async () => {
    const repository = new MemoryRepository();
    const { generation } = await repository.resetDemo(now);
    await repository.createIntervention(intervention(generation), audit(generation));

    expect(await repository.reassignTask({
      interventionId: "int-001",
      generation,
      workerId: "ravi-001",
      taskId: "delivery-001",
      hubId: "hub-delhi-001",
      now,
      correlationId: "corr-001",
      preserveIntervention: true,
    })).toEqual({ status: "REASSIGNED", replacementWorkerId: "asha-001" });

    expect(await repository.getWorker("ravi-001")).toMatchObject({
      activeInterventionId: "int-001",
      activeTaskIds: [],
      state: "HIGH",
    });
    expect(await repository.getWorker("asha-001")).toMatchObject({
      activeTaskIds: ["delivery-001"],
      state: "SAFE",
    });
    expect(await repository.getIntervention("int-001")).toMatchObject({
      replacementWorkerId: "asha-001",
      status: "CREATED",
    });
  });
});
