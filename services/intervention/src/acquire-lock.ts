import { createHash } from "node:crypto";
import type { Handler } from "aws-lambda";
import { DynamoRepository, loadEnvironment, log, metric } from "@taapsaathi/shared";
import { parseEventBridgeInput } from "./workflow-input.js";

export const handler: Handler = async (input: unknown) => {
  const environment = loadEnvironment();
  const envelope = parseEventBridgeInput(input);
  const repository = new DynamoRepository(environment.TABLE_NAME);
  const interventionId = `int-${createHash("sha256").update(envelope.payload.idempotencyKey).digest("hex").slice(0, 20)}`;
  const existingIntervention = await repository.getIntervention(interventionId);
  const claimed = existingIntervention
    ? false
    : await repository.claimRiskEvent(envelope, interventionId, Math.floor(Date.now() / 1000) + 86400);
  metric(claimed ? "HeatRiskEventsReceived" : "DuplicateEventsPrevented", 1, { operation: "AcquireIdempotencyLock" });
  log("INFO", "AcquireIdempotencyLock", { eventId: envelope.eventId, interventionId, workerId: envelope.payload.workerId, duplicate: !claimed, correlationId: envelope.correlationId });
  return { envelope, interventionId, duplicate: !claimed };
};
