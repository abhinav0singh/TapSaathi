import { describe, expect, it, vi } from "vitest";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoRepository } from "../src/dynamo-repository.js";

const intervention = {
  interventionId: "int-first",
  eventId: "evt-first",
  correlationId: "corr-first",
  idempotencyKey: "key-first",
  workerId: "ravi-001",
  hubId: "hub-delhi-001",
  riskLevel: "HIGH" as const,
  matchedRule: "HEAT_ALERT_WITH_ACTIVE_EXPOSURE",
  status: "AWAITING_SUPERVISOR" as const,
  demoGeneration: 4,
  createdAt: "2026-10-09T08:00:00.000Z",
  updatedAt: "2026-10-09T08:00:00.000Z",
};

const now = "2026-10-09T09:00:00.000Z";

function setup(activeInterventionId?: string) {
  const send = vi.fn(async (command: unknown) => {
    if (command instanceof GetCommand) {
      const key = command.input.Key;

      if (key?.PK === "INTERVENTION#int-first") {
        return { Item: intervention };
      }

      if (key?.PK === "WORKER#ravi-001") {
        return {
          Item: {
            workerId: "ravi-001",
            demoGeneration: 4,
            state: "AWAITING_SUPERVISOR",
            ...(activeInterventionId
              ? { activeInterventionId }
              : {}),
          },
        };
      }
    }

    if (command instanceof TransactWriteCommand) {
      return {};
    }

    throw new Error("Unexpected DynamoDB command");
  });

  const repository = new DynamoRepository(
    "TaapSaathiTest",
    { send } as never
  );

  return { repository, send };
}

async function complete(
  repository: DynamoRepository
) {
  await repository.complete({
    interventionId: intervention.interventionId,
    generation: 4,
    status: "SUPERVISOR_UNACKNOWLEDGED",
    now,
    audit: {
      auditEventId: "audit-completed",
      interventionId: intervention.interventionId,
      eventType: "INTERVENTION_COMPLETED",
      actorType: "SYSTEM",
      correlationId: intervention.correlationId,
      workerId: intervention.workerId,
      hubId: intervention.hubId,
      demoGeneration: 4,
      details: {},
      occurredAt: now,
    },
  });
}

describe("DynamoDB terminal ownership reconciliation", () => {
  it("rejects a concurrent ownership change without reporting success", async () => {
    const { repository, send } = setup("int-first");

    const transactionError = new Error(
      "Worker ownership changed before transaction"
    );
    transactionError.name = "TransactionCanceledException";

    Object.assign(transactionError, {
      CancellationReasons: [
        { Code: "None" },
        { Code: "None" },
        { Code: "ConditionalCheckFailed" },
        { Code: "None" },
      ],
    });

    send.mockImplementationOnce(async (command: unknown) => {
      if (!(command instanceof GetCommand)) {
        throw new Error("Expected intervention read");
      }
      return { Item: intervention };
    });

    send.mockImplementationOnce(async (command: unknown) => {
      if (!(command instanceof GetCommand)) {
        throw new Error("Expected worker read");
      }
      return {
        Item: {
          workerId: "ravi-001",
          demoGeneration: 4,
          state: "AWAITING_SUPERVISOR",
          activeInterventionId: "int-first",
        },
      };
    });

    send.mockImplementationOnce(async (command: unknown) => {
      if (!(command instanceof TransactWriteCommand)) {
        throw new Error("Expected completion transaction");
      }

      const workerUpdate = command.input.TransactItems?.[2]?.Update;

      expect(workerUpdate?.ConditionExpression).toContain(
        "activeInterventionId = :interventionId"
      );

      throw transactionError;
    });

    await expect(complete(repository)).rejects.toBe(transactionError);

    expect(send).toHaveBeenCalledTimes(3);
  });

  it("clears ownership only when worker owns the completing intervention", async () => {
    const { repository, send } = setup("int-first");

    await complete(repository);

    const command = send.mock.calls
      .map((call) => call[0])
      .find((item) => item instanceof TransactWriteCommand);

    expect(command).toBeInstanceOf(TransactWriteCommand);

    const items = (command as TransactWriteCommand).input.TransactItems;

    expect(items).toHaveLength(4);

    const workerUpdate = items?.[2]?.Update;

    expect(workerUpdate?.UpdateExpression).toContain(
      "REMOVE activeInterventionId"
    );

    expect(workerUpdate?.ConditionExpression).toContain(
      "activeInterventionId = :interventionId"
    );

    expect(workerUpdate?.ExpressionAttributeValues?.[":interventionId"])
      .toBe("int-first");

    expect(items?.[1]?.Update?.ConditionExpression).toContain(
      "attribute_not_exists(completedAt)"
    );
  });

  it("preserves ownership belonging to a newer intervention", async () => {
    const { repository, send } = setup("int-newer");

    await complete(repository);

    const command = send.mock.calls
      .map((call) => call[0])
      .find((item) => item instanceof TransactWriteCommand) as TransactWriteCommand;

    const workerCheck = command.input.TransactItems?.[2]?.ConditionCheck;

    expect(workerCheck).toBeDefined();
    expect(workerCheck?.ConditionExpression).toContain(
      "activeInterventionId = :observed"
    );
    expect(workerCheck?.ExpressionAttributeValues?.[":observed"])
      .toBe("int-newer");
  });

  it("preserves absent ownership", async () => {
    const { repository, send } = setup();

    await complete(repository);

    const command = send.mock.calls
      .map((call) => call[0])
      .find((item) => item instanceof TransactWriteCommand) as TransactWriteCommand;

    const workerCheck = command.input.TransactItems?.[2]?.ConditionCheck;

    expect(workerCheck?.ConditionExpression).toContain(
      "attribute_not_exists(activeInterventionId)"
    );
    expect(workerCheck?.ExpressionAttributeValues)
      .not.toHaveProperty(":observed");
  });
});
