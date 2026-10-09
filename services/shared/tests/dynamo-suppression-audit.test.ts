import { describe, expect, it, vi } from "vitest";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { AuditEvent } from "@taapsaathi/contracts";
import { DynamoRepository } from "../src/dynamo-repository.js";

const audit: AuditEvent = {
  auditEventId: "audit-suppressed-int-001",
  interventionId: "int-001",
  eventType: "INTERVENTION_SUPPRESSED",
  actorType: "SYSTEM",
  correlationId: "corr-001",
  workerId: "ravi-001",
  hubId: "hub-delhi-001",
  demoGeneration: 4,
  details: {
    eventId: "evt-001",
    reason: "WORKER_UNAVAILABLE",
  },
  occurredAt: "2026-10-09T10:00:00.000Z",
};

function cancellation(codes: string[]) {
  const error = new Error("Transaction cancelled");
  error.name = "TransactionCanceledException";
  Object.assign(error, {
    CancellationReasons: codes.map((Code) => ({ Code })),
  });
  return error;
}

describe("DynamoDB suppression audit persistence", () => {
  it("uses a generation-guarded conditional transaction", async () => {
    const send = vi.fn().mockResolvedValue({});
    const repository = new DynamoRepository("TestTable", { send } as never);

    await repository.recordSuppressedRiskEvent(audit);

    expect(send).toHaveBeenCalledTimes(1);

    const command = send.mock.calls[0]?.[0] as TransactWriteCommand;
    expect(command).toBeInstanceOf(TransactWriteCommand);

    const items = command.input.TransactItems;
    expect(items).toHaveLength(2);
    expect(items?.[0]?.ConditionCheck?.ConditionExpression)
      .toContain("#value = :generation");
    expect(items?.[1]?.Put?.ConditionExpression)
      .toBe("attribute_not_exists(PK)");
    expect(items?.[1]?.Put?.Item?.SK)
      .toBe("EVENT#SUPPRESSED#audit-suppressed-int-001");
  });

  it("accepts an identical retry after the audit already exists", async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(cancellation(["None", "ConditionalCheckFailed"]))
      .mockResolvedValueOnce({
        Item: {
          PK: "INTERVENTION#int-001",
          SK: "EVENT#SUPPRESSED#audit-suppressed-int-001",
          entityType: "AUDIT_EVENT",
          demoHubId: "hub-delhi-001",
          ...audit,
        },
      })
      .mockResolvedValueOnce({
        Item: { value: 4 },
      });

    const repository = new DynamoRepository("TestTable", { send } as never);

    await expect(repository.recordSuppressedRiskEvent(audit))
      .resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(GetCommand);
  });

  it("rejects an identical retry after demo generation changes", async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(
        cancellation(["None", "ConditionalCheckFailed"])
      )
      .mockResolvedValueOnce({
        Item: {
          PK: "INTERVENTION#int-001",
          SK: "EVENT#SUPPRESSED#audit-suppressed-int-001",
          entityType: "AUDIT_EVENT",
          demoHubId: "hub-delhi-001",
          ...audit,
        },
      })
      .mockResolvedValueOnce({
        Item: { value: 5 },
      });

    const repository = new DynamoRepository(
      "TestTable",
      { send } as never
    );

    await expect(
      repository.recordSuppressedRiskEvent(audit)
    ).rejects.toMatchObject({
      code: "STALE_DEMO_GENERATION",
    });

    expect(send).toHaveBeenCalledTimes(3);

    const auditRead = send.mock.calls[1]?.[0] as GetCommand;

    expect(auditRead).toBeInstanceOf(GetCommand);
    expect(auditRead.input.ConsistentRead).toBe(true);
  });
  it("rejects conflicting audit content", async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(cancellation(["None", "ConditionalCheckFailed"]))
      .mockResolvedValueOnce({
        Item: {
          ...audit,
          details: { eventId: "different-event" },
        },
      });

    const repository = new DynamoRepository("TestTable", { send } as never);

    await expect(repository.recordSuppressedRiskEvent(audit))
      .rejects.toMatchObject({
        code: "SUPPRESSION_AUDIT_CONFLICT",
      });
  });

  it("rejects stale demo generations", async () => {
    const error = cancellation(["ConditionalCheckFailed", "None"]);
    const send = vi.fn().mockRejectedValue(error);
    const repository = new DynamoRepository("TestTable", { send } as never);

    await expect(repository.recordSuppressedRiskEvent(audit))
      .rejects.toMatchObject({
        code: "STALE_DEMO_GENERATION",
      });
  });

  it("preserves DynamoDB infrastructure errors", async () => {
    const error = cancellation(["None", "ProvisionedThroughputExceeded"]);
    const send = vi.fn().mockRejectedValue(error);
    const repository = new DynamoRepository("TestTable", { send } as never);

    await expect(repository.recordSuppressedRiskEvent(audit))
      .rejects.toBe(error);
  });
});
