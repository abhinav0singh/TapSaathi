import { describe, expect, it } from "vitest";
import type { Intervention } from "@taapsaathi/contracts";
import { MemoryRepository } from "../../shared/src/memory-repository.js";
import { createAudit } from "../../shared/src/audit.js";

const NOW = "2026-10-09T08:00:00.000Z";

function intervention(
  interventionId: string,
  generation: number
): Intervention {
  return {
    interventionId,
    eventId: `event-${interventionId}`,
    correlationId: `correlation-${interventionId}`,
    idempotencyKey: `key-${interventionId}`,
    workerId: "ravi-001",
    hubId: "hub-delhi-001",
    taskId: "delivery-001",
    riskLevel: "HIGH",
    matchedRule: "HEAT_ALERT_WITH_ACTIVE_EXPOSURE",
    status: "CREATED",
    demoGeneration: generation,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function audit(item: Intervention) {
  return createAudit({
    interventionId: item.interventionId,
    eventType: "INTERVENTION_CREATED",
    actorType: "SYSTEM",
    correlationId: item.correlationId,
    workerId: item.workerId,
    hubId: item.hubId,
    demoGeneration: item.demoGeneration,
    details: {},
    occurredAt: NOW,
  });
}

describe("worker intervention concurrency", () => {
  it("rejects conflicting suppression audit retries", async () => {
    const repository = new MemoryRepository();
    const { generation } = await repository.resetDemo(NOW);

    const original = createAudit({
      auditEventId: "audit-suppression-conflict",
      interventionId: "int-suppression-conflict",
      eventType: "INTERVENTION_SUPPRESSED",
      actorType: "SYSTEM",
      correlationId: "corr-suppression",
      workerId: "ravi-001",
      hubId: "hub-delhi-001",
      demoGeneration: generation,
      details: {
        eventId: "evt-original",
        reason: "WORKER_UNAVAILABLE",
      },
      occurredAt: NOW,
    });

    await repository.recordSuppressedRiskEvent(original);

    await expect(
      repository.recordSuppressedRiskEvent({
        ...original,
        details: {
          eventId: "evt-different",
          reason: "WORKER_UNAVAILABLE",
        },
      })
    ).rejects.toMatchObject({
      code: "SUPPRESSION_AUDIT_CONFLICT",
    });

    const events = await repository.listAuditEvents(
      undefined,
      "hub-delhi-001"
    );

    expect(events.events.filter(
      (event) => event.auditEventId === original.auditEventId
    )).toEqual([original]);
  });

  it("records suppressed risk events without modifying worker state", async () => {
    const repository = new MemoryRepository();
    const { generation } = await repository.resetDemo(NOW);

    const workerBefore = await repository.getWorker("ravi-001");

    const suppressedAudit = createAudit({
      auditEventId: "audit-suppressed-int-test",
      interventionId: "int-suppressed-test",
      eventType: "INTERVENTION_SUPPRESSED",
      actorType: "SYSTEM",
      correlationId: "corr-suppressed-test",
      workerId: "ravi-001",
      hubId: "hub-delhi-001",
      demoGeneration: generation,
      details: {
        eventId: "evt-suppressed-test",
        reason: "WORKER_UNAVAILABLE",
      },
      occurredAt: NOW,
    });

    await repository.recordSuppressedRiskEvent(suppressedAudit);
    await repository.recordSuppressedRiskEvent(suppressedAudit);

    const workerAfter = await repository.getWorker("ravi-001");
    const events = await repository.listAuditEvents(undefined, "hub-delhi-001");
    const interventions = await repository.listInterventions("hub-delhi-001");

    expect(workerAfter).toEqual(workerBefore);

    expect(
      events.events.filter(
        (event) => event.auditEventId === suppressedAudit.auditEventId
      )
    ).toHaveLength(1);

    expect(interventions).toHaveLength(0);
  });

  it("does not clear ownership belonging to another intervention", async () => {
    const repository = new MemoryRepository();
    const { generation } = await repository.resetDemo(NOW);

    const first = intervention("int-first", generation);

    await repository.createIntervention(first, audit(first));

    // Simulate a later ownership change without allowing a second
    // intervention to be created through the normal guarded method.
    const worker = await repository.getWorker("ravi-001");
    expect(worker?.activeInterventionId).toBe("int-first");

    const workers = (repository as unknown as {
      workers: Map<string, {
        activeInterventionId?: string;
        state: string;
        updatedAt: string;
      }>;
    }).workers;

    const current = workers.get("ravi-001");
    expect(current).toBeDefined();

    if (!current) throw new Error("Worker fixture missing.");

    workers.set("ravi-001", {
      ...current,
      activeInterventionId: "int-newer",
    });

    await repository.complete({
      interventionId: first.interventionId,
      generation,
      status: "SUPERVISOR_UNACKNOWLEDGED",
      now: NOW,
      audit: createAudit({
        interventionId: first.interventionId,
        eventType: "INTERVENTION_COMPLETED",
        actorType: "SYSTEM",
        correlationId: first.correlationId,
        workerId: first.workerId,
        hubId: first.hubId,
        demoGeneration: generation,
        details: {},
        occurredAt: NOW,
      }),
    });

    const updated = await repository.getWorker("ravi-001");

    expect(updated?.activeInterventionId).toBe("int-newer");
  });

  it("rejects a second active intervention for the same worker", async () => {
    const repository = new MemoryRepository();
    const { generation } = await repository.resetDemo(NOW);

    const first = intervention("int-first", generation);
    const second = intervention("int-second", generation);

    await repository.createIntervention(first, audit(first));

    await expect(
      repository.createIntervention(second, audit(second))
    ).rejects.toThrow();

    const worker = await repository.getWorker("ravi-001");

    expect(worker?.activeInterventionId).toBe("int-first");
    expect(await repository.getIntervention("int-second")).toBeUndefined();
  });

  it("does not create duplicate interventions with the same ID", async () => {
    const repository = new MemoryRepository();
    const { generation } = await repository.resetDemo(NOW);

    const first = intervention("int-first", generation);

    await repository.createIntervention(first, audit(first));

    await expect(
      repository.createIntervention(first, audit(first))
    ).rejects.toThrow();

    const interventions = await repository.listInterventions("hub-delhi-001");

    expect(
      interventions.filter(
        (item) => item.interventionId === "int-first"
      )
    ).toHaveLength(1);
  });

  it("preserves an unsafe state after supervisor timeout completion", async () => {
    const repository = new MemoryRepository();
    const { generation } = await repository.resetDemo(NOW);

    const first = intervention("int-first", generation);

    await repository.createIntervention(first, audit(first));

    await repository.escalate({
      interventionId: first.interventionId,
      generation,
      reason: "WORKER_TIMEOUT",
      now: NOW,
      audit: createAudit({
        interventionId: first.interventionId,
        eventType: "SUPERVISOR_ESCALATED",
        actorType: "SYSTEM",
        correlationId: first.correlationId,
        workerId: first.workerId,
        hubId: first.hubId,
        demoGeneration: generation,
        details: {},
        occurredAt: NOW,
      }),
    });

    await repository.complete({
      interventionId: first.interventionId,
      generation,
      status: "SUPERVISOR_UNACKNOWLEDGED",
      now: NOW,
      audit: createAudit({
        interventionId: first.interventionId,
        eventType: "INTERVENTION_COMPLETED",
        actorType: "SYSTEM",
        correlationId: first.correlationId,
        workerId: first.workerId,
        hubId: first.hubId,
        demoGeneration: generation,
        details: {},
        occurredAt: NOW,
      }),
    });

    const worker = await repository.getWorker("ravi-001");
    const completed = await repository.getIntervention(first.interventionId);

    expect(worker?.state).toBe("AWAITING_SUPERVISOR");
    expect(worker?.activeInterventionId).toBeUndefined();
    expect(completed?.status).toBe("SUPERVISOR_UNACKNOWLEDGED");
    expect(completed?.completedAt).toBeDefined();
  });
});
