import type { Handler } from "aws-lambda";
import { createAudit, DynamoRepository, loadEnvironment } from "@taapsaathi/shared";
import type { WorkflowState } from "./workflow-input.js";

interface Input extends WorkflowState {
  taskToken: string;
  actorType: "WORKER" | "SUPERVISOR";
}

export const handler: Handler<Input> = async (input) => {
  const environment = loadEnvironment();
  const now = new Date().toISOString();
  const timeout = input.actorType === "WORKER" ? environment.WORKER_RESPONSE_TIMEOUT_SECONDS : environment.SUPERVISOR_RESPONSE_TIMEOUT_SECONDS;
  const expectedActorId = input.actorType === "WORKER" ? input.envelope.payload.workerId : "supervisor-neha-001";
  await new DynamoRepository(environment.TABLE_NAME).registerCallback({
    interventionId: input.interventionId,
    actorType: input.actorType,
    expectedActorId,
    taskToken: input.taskToken,
    demoGeneration: input.envelope.demoGeneration,
    expiresAt: Math.floor(Date.now() / 1000) + timeout + 300,
  }, now, createAudit({
    interventionId: input.interventionId,
    eventType: input.actorType === "WORKER" ? "WORKER_RESPONSE_REQUESTED" : "SUPERVISOR_RESPONSE_REQUESTED",
    actorType: "SYSTEM",
    correlationId: input.envelope.correlationId,
    workerId: input.envelope.payload.workerId,
    hubId: input.envelope.payload.hubId,
    demoGeneration: input.envelope.demoGeneration,
    details: { actorType: input.actorType, timeoutSeconds: timeout },
    occurredAt: now,
  }));
  return { registered: true };
};
