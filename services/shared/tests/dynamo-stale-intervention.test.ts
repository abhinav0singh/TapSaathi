import { describe, expect, it, vi } from "vitest";
import { DynamoRepository, NotFoundError, StaleGenerationError } from "../src/index.js";

const now = "2026-10-11T10:00:00.000Z";
const audit = {
  auditEventId: "audit-stale",
  interventionId: "int-removed",
  eventType: "INTERVENTION_COMPLETED" as const,
  actorType: "SYSTEM" as const,
  correlationId: "corr-stale",
  workerId: "ravi-001",
  hubId: "hub-delhi-001",
  demoGeneration: 4,
  details: {},
  occurredAt: now,
};

function repositoryAfterReset() {
  const send = vi.fn().mockResolvedValue({});
  const repository = new DynamoRepository("TaapSaathiTest", { send } as never);
  vi.spyOn(repository, "getDemoGeneration").mockResolvedValue(5);
  return { repository, send };
}

function repositoryWithOlderIntervention() {
  const send = vi.fn().mockResolvedValue({
    Item: { interventionId: "int-old", demoGeneration: 4 },
  });
  const repository = new DynamoRepository("TaapSaathiTest", { send } as never);
  return { repository, send };
}

describe("DynamoDB missing intervention after reset", () => {
  it("classifies stale callback consumption when the intervention has been removed", async () => {
    const { repository, send } = repositoryAfterReset();

    await expect(repository.consumeCallback({
      interventionId: "int-removed",
      generation: 4,
      actorType: "WORKER",
      actorId: "ravi-001",
      clientRequestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      action: "TAKE_BREAK",
      consumedAt: now,
    })).rejects.toBeInstanceOf(StaleGenerationError);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("classifies stale escalation when the intervention has been removed", async () => {
    const { repository, send } = repositoryAfterReset();

    await expect(repository.escalate({
      interventionId: "int-removed",
      generation: 4,
      reason: "WORKER_TIMEOUT",
      now,
      audit: { ...audit, eventType: "SUPERVISOR_ESCALATED" },
    })).rejects.toBeInstanceOf(StaleGenerationError);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("classifies stale completion when the intervention has been removed", async () => {
    const { repository, send } = repositoryAfterReset();

    await expect(repository.complete({
      interventionId: "int-removed",
      generation: 4,
      status: "SUPERVISOR_UNACKNOWLEDGED",
      now,
      audit,
    })).rejects.toBeInstanceOf(StaleGenerationError);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps a missing intervention in the current generation as not found", async () => {
    const send = vi.fn().mockResolvedValue({});
    const repository = new DynamoRepository("TaapSaathiTest", { send } as never);
    vi.spyOn(repository, "getDemoGeneration").mockResolvedValue(4);

    await expect(repository.complete({
      interventionId: "int-missing-current",
      generation: 4,
      status: "SUPERVISOR_UNACKNOWLEDGED",
      now,
      audit,
    })).rejects.toBeInstanceOf(NotFoundError);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("classifies an older existing intervention as stale before escalation writes", async () => {
    const { repository, send } = repositoryWithOlderIntervention();

    await expect(repository.escalate({
      interventionId: "int-old",
      generation: 5,
      reason: "WORKER_TIMEOUT",
      now,
      audit: { ...audit, interventionId: "int-old", eventType: "SUPERVISOR_ESCALATED", demoGeneration: 5 },
    })).rejects.toBeInstanceOf(StaleGenerationError);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("classifies an older existing intervention as stale before callback consumption", async () => {
    const { repository, send } = repositoryWithOlderIntervention();

    await expect(repository.consumeCallback({
      interventionId: "int-old",
      generation: 5,
      actorType: "WORKER",
      actorId: "ravi-001",
      clientRequestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      action: "TAKE_BREAK",
      consumedAt: now,
    })).rejects.toBeInstanceOf(StaleGenerationError);

    expect(send).toHaveBeenCalledTimes(1);
  });
});
