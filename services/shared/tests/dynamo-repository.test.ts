import { describe, expect, it, vi } from "vitest";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { HeatRiskRaisedEnvelope } from "@taapsaathi/contracts";
import { DynamoRepository } from "../src/dynamo-repository.js";
import { createSeedState } from "../src/seed.js";

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
  it("does not classify throttled risk claims as duplicates", async () => {
    const error = new Error("DynamoDB transaction throttled");
    error.name = "TransactionCanceledException";

    Object.assign(error, {
      CancellationReasons: [
        { Code: "None" },
        { Code: "ProvisionedThroughputExceeded" },
      ],
    });

    const send = vi.fn().mockRejectedValue(error);

    const repository = new DynamoRepository(
      "TaapSaathiTest",
      { send } as never
    );

    await expect(
      repository.claimRiskEvent(
        envelope,
        "int-throttled",
        999999
      )
    ).rejects.toBe(error);
  });

  it.each([
    {
      title: "missing cancellation reasons",
      reasons: undefined,
    },
    {
      title: "multiple conditional failures",
      reasons: [
        { Code: "ConditionalCheckFailed" },
        { Code: "None" },
        { Code: "None" },
        { Code: "ConditionalCheckFailed" },
      ],
    },
    {
      title: "worker conflict accompanied by throttling",
      reasons: [
        { Code: "None" },
        { Code: "None" },
        { Code: "None" },
        { Code: "ProvisionedThroughputExceeded" },
      ],
    },
  ])("preserves ambiguous transaction cancellations: $title", async ({ reasons }) => {
    const error = new Error("Transaction cancelled");
    error.name = "TransactionCanceledException";

    if (reasons !== undefined) {
      Object.assign(error, { CancellationReasons: reasons });
    }

    const send = vi.fn().mockRejectedValue(error);
    const repository = new DynamoRepository("TaapSaathiTest", { send } as never);

    const intervention = {
      interventionId: "int-edge-case",
      eventId: "evt-edge-case",
      correlationId: "corr-edge-case",
      idempotencyKey: "key-edge-case",
      workerId: "ravi-001",
      hubId: "hub-delhi-001",
      riskLevel: "HIGH" as const,
      matchedRule: "HEAT_ALERT_WITH_ACTIVE_EXPOSURE",
      status: "CREATED" as const,
      demoGeneration: 4,
      createdAt: "2026-10-08T10:00:00.000Z",
      updatedAt: "2026-10-08T10:00:00.000Z",
    };

    const audit = {
      auditEventId: "audit-edge-case",
      interventionId: intervention.interventionId,
      eventType: "INTERVENTION_CREATED",
      actorType: "SYSTEM" as const,
      correlationId: intervention.correlationId,
      workerId: intervention.workerId,
      hubId: intervention.hubId,
      demoGeneration: intervention.demoGeneration,
      details: {},
      occurredAt: intervention.createdAt,
    };

    await expect(
      repository.createIntervention(intervention, audit)
    ).rejects.toBe(error);
  });

  it.each([
    {
      title: "classifies worker ownership failure separately",
      failedIndex: 3,
      expectedCode: "WORKER_INTERVENTION_ACTIVE",
    },
    {
      title: "classifies stale generation separately",
      failedIndex: 0,
      expectedCode: "STALE_DEMO_GENERATION",
    },
    {
      title: "classifies intervention record conflict separately",
      failedIndex: 1,
      expectedCode: "INTERVENTION_CREATE_CONFLICT",
    },
  ])("$title", async ({ failedIndex, expectedCode }) => {
    const reasons = Array.from({ length: 4 }, (_, index) => ({
      Code: index === failedIndex ? "ConditionalCheckFailed" : "None",
    }));

    const error = new Error("Transaction cancelled");
    error.name = "TransactionCanceledException";

    Object.assign(error, {
      CancellationReasons: reasons,
    });

    const send = vi.fn().mockRejectedValue(error);

    const repository = new DynamoRepository(
      "TaapSaathiTest",
      { send } as never
    );

    const intervention = {
      interventionId: "int-classification",
      eventId: "evt-classification",
      correlationId: "corr-classification",
      idempotencyKey: "key-classification",
      workerId: "ravi-001",
      hubId: "hub-delhi-001",
      riskLevel: "HIGH" as const,
      matchedRule: "HEAT_ALERT_WITH_ACTIVE_EXPOSURE",
      status: "CREATED" as const,
      demoGeneration: 4,
      createdAt: "2026-10-08T10:00:00.000Z",
      updatedAt: "2026-10-08T10:00:00.000Z",
    };

    const audit = {
      auditEventId: "audit-classification",
      interventionId: intervention.interventionId,
      eventType: "INTERVENTION_CREATED",
      actorType: "SYSTEM" as const,
      correlationId: intervention.correlationId,
      workerId: intervention.workerId,
      hubId: intervention.hubId,
      demoGeneration: intervention.demoGeneration,
      details: {},
      occurredAt: intervention.createdAt,
    };

    await expect(
      repository.createIntervention(intervention, audit)
    ).rejects.toMatchObject({
      code: expectedCode,
    });
  });

  it("does not classify unrelated transaction cancellation as worker conflict", async () => {
    const error = new Error("Transaction cancelled for throttling");
    error.name = "TransactionCanceledException";

    Object.assign(error, {
      CancellationReasons: [
        { Code: "None" },
        { Code: "None" },
        { Code: "None" },
        { Code: "ProvisionedThroughputExceeded" },
      ],
    });

    const send = vi.fn().mockRejectedValue(error);
    const repository = new DynamoRepository("TaapSaathiTest", { send } as never);

    const intervention = {
      interventionId: "int-throttled",
      eventId: "evt-throttled",
      correlationId: "corr-throttled",
      idempotencyKey: "key-throttled",
      workerId: "ravi-001",
      hubId: "hub-delhi-001",
      riskLevel: "HIGH" as const,
      matchedRule: "HEAT_ALERT_WITH_ACTIVE_EXPOSURE",
      status: "CREATED" as const,
      demoGeneration: 4,
      createdAt: "2026-10-08T10:00:00.000Z",
      updatedAt: "2026-10-08T10:00:00.000Z",
    };

    const audit = {
      auditEventId: "audit-throttled",
      interventionId: intervention.interventionId,
      eventType: "INTERVENTION_CREATED",
      actorType: "SYSTEM" as const,
      correlationId: intervention.correlationId,
      workerId: intervention.workerId,
      hubId: intervention.hubId,
      demoGeneration: intervention.demoGeneration,
      details: {},
      occurredAt: intervention.createdAt,
    };

    await expect(
      repository.createIntervention(intervention, audit)
    ).rejects.toBe(error);
  });

  it("enforces atomic worker intervention exclusivity", async () => {
    const send = vi.fn().mockResolvedValue({});
    const repository = new DynamoRepository("TaapSaathiTest", { send } as never);

    const intervention = {
      interventionId: "int-test-001",
      eventId: "evt-test-001",
      correlationId: "corr-test-001",
      idempotencyKey: "test-key-001",
      workerId: "ravi-001",
      hubId: "hub-delhi-001",
      riskLevel: "HIGH" as const,
      matchedRule: "HEAT_ALERT_WITH_ACTIVE_EXPOSURE",
      status: "CREATED" as const,
      demoGeneration: 4,
      createdAt: "2026-10-08T10:00:00.000Z",
      updatedAt: "2026-10-08T10:00:00.000Z",
    };

    const audit = {
      auditEventId: "audit-test-001",
      interventionId: intervention.interventionId,
      eventType: "INTERVENTION_CREATED",
      actorType: "SYSTEM" as const,
      correlationId: intervention.correlationId,
      workerId: intervention.workerId,
      hubId: intervention.hubId,
      demoGeneration: intervention.demoGeneration,
      details: {},
      occurredAt: intervention.createdAt,
    };

    await repository.createIntervention(intervention, audit);

    expect(send).toHaveBeenCalledTimes(1);

    const command = send.mock.calls[0]?.[0];

    expect(command).toBeInstanceOf(TransactWriteCommand);

    const items = (command as TransactWriteCommand).input.TransactItems;

    expect(items).toHaveLength(4);

    const workerUpdate = items?.find(
      (item) => item.Update?.Key?.PK === "WORKER#ravi-001"
    )?.Update;

    expect(workerUpdate).toBeDefined();

    expect(workerUpdate?.ConditionExpression).toContain(
      "attribute_not_exists(activeInterventionId)"
    );

    expect(workerUpdate?.ConditionExpression).toContain(
      "demoGeneration = :generation"
    );

    expect(workerUpdate?.ConditionExpression).toContain(
      "#state = :safe OR #state = :caution"
    );

    expect(workerUpdate?.ExpressionAttributeValues).toMatchObject({
      ":safe": "SAFE",
      ":caution": "CAUTION",
      ":generation": 4,
    });
  });

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

  it("preserves intervention ownership while securing an escalated delivery", async () => {
    const send = vi.fn().mockResolvedValue({});
    const repository = new DynamoRepository("TaapSaathiTest", { send } as never);
    const workers = createSeedState(4, envelope.occurredAt).workers.map((worker) =>
      worker.workerId === "ravi-001"
        ? { ...worker, state: "HIGH" as const, activeInterventionId: "int-001" }
        : worker
    );

    vi.spyOn(repository, "getDemoGeneration").mockResolvedValue(4);
    vi.spyOn(repository, "getWorkers").mockResolvedValue(workers);

    await repository.reassignTask({
      interventionId: "int-001",
      generation: 4,
      workerId: "ravi-001",
      taskId: "delivery-001",
      hubId: "hub-delhi-001",
      now: envelope.occurredAt,
      correlationId: envelope.correlationId,
      preserveIntervention: true,
    });

    const command = send.mock.calls[0]?.[0];
    expect(command).toBeInstanceOf(TransactWriteCommand);
    const items = (command as TransactWriteCommand).input.TransactItems;
    const workerUpdate = items?.find(
      (item) => item.Update?.Key?.PK === "WORKER#ravi-001"
    )?.Update;
    const interventionUpdate = items?.find(
      (item) => item.Update?.Key?.PK === "INTERVENTION#int-001"
    )?.Update;

    expect(workerUpdate?.UpdateExpression).toBe(
      "SET activeTaskIds = :remaining, updatedAt = :now"
    );
    expect(workerUpdate?.ExpressionAttributeValues).toMatchObject({
      ":remaining": [],
      ":interventionId": "int-001",
    });
    expect(interventionUpdate?.UpdateExpression).toBe(
      "SET replacementWorkerId = :replacement, updatedAt = :now"
    );
    expect(interventionUpdate?.ExpressionAttributeNames).toBeUndefined();
  });
});
