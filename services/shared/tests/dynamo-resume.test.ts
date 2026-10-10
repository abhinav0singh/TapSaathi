import { describe, expect, it, vi } from "vitest";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoRepository } from "../src/dynamo-repository.js";

const now = "2026-10-10T10:30:00.000Z";

function input() {
  return {
    workerId: "ravi-001",
    generation: 16,
    interventionId: "int-break",
    clientRequestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    now,
    audit: {
      auditEventId: "audit-resume-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      interventionId: "int-break",
      eventType: "RIDER_RESUMED_WORK",
      actorId: "ravi-001",
      actorType: "WORKER" as const,
      correlationId: "corr-break",
      workerId: "ravi-001",
      hubId: "hub-delhi-001",
      demoGeneration: 16,
      details: {},
      occurredAt: now,
    },
  };
}

describe("DynamoDB rider resume", () => {
  it("atomically returns a resting rider to SAFE without reclaiming a task", async () => {
    const send = vi.fn(async (command: unknown) => {
      if (command instanceof GetCommand) return { Item: { value: 16 } };
      if (command instanceof TransactWriteCommand) return {};
      throw new Error("Unexpected command");
    });
    const repository = new DynamoRepository("TaapSaathiTest", { send } as never);

    await expect(repository.resumeWorker(input())).resolves.toEqual({
      duplicate: false,
      resumedAt: now,
    });

    const transaction = send.mock.calls
      .map((call) => call[0])
      .find((command) => command instanceof TransactWriteCommand) as TransactWriteCommand;
    const items = transaction.input.TransactItems;
    const workerUpdate = items?.[1]?.Update;

    expect(workerUpdate?.ConditionExpression).toContain("#state = :resting");
    expect(workerUpdate?.ConditionExpression).toContain("attribute_not_exists(activeInterventionId)");
    expect(workerUpdate?.UpdateExpression).toContain("activeMinutes = :zero");
    expect(workerUpdate?.ExpressionAttributeValues).toMatchObject({
      ":safe": "SAFE",
      ":resting": "RESTING",
      ":zero": 0,
    });
    expect(JSON.stringify(items)).not.toContain("activeTaskIds");
    expect(items?.[2]?.Put?.Item?.["eventType"]).toBe("RIDER_RESUMED_WORK");
  });

  it("returns the original result for an identical retry", async () => {
    const conditional = new Error("already written");
    conditional.name = "TransactionCanceledException";
    const send = vi.fn()
      .mockResolvedValueOnce({ Item: { value: 16 } })
      .mockRejectedValueOnce(conditional)
      .mockResolvedValueOnce({
        Item: {
          demoGeneration: 16,
          interventionId: "int-break",
          resumedAt: now,
        },
      });
    const repository = new DynamoRepository("TaapSaathiTest", { send } as never);

    await expect(repository.resumeWorker(input())).resolves.toEqual({
      duplicate: true,
      resumedAt: now,
    });
  });
});
