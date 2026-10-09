import type { Handler } from "aws-lambda";
import type { Intervention } from "@taapsaathi/contracts";
import { AppError, createAudit, DynamoRepository, loadEnvironment, log, metric } from "@taapsaathi/shared";
import type { WorkflowState } from "./workflow-input.js";

export const handler: Handler<WorkflowState> = async (input) => {
  const now = new Date().toISOString();
  const { envelope } = input;
  const repository = new DynamoRepository(loadEnvironment().TABLE_NAME);
  const intervention: Intervention = {
    interventionId: input.interventionId,
    eventId: envelope.eventId,
    correlationId: envelope.correlationId,
    idempotencyKey: envelope.payload.idempotencyKey,
    workerId: envelope.payload.workerId,
    hubId: envelope.payload.hubId,
    ...(input.taskId ? { taskId: input.taskId } : {}),
    riskLevel: envelope.payload.riskLevel,
    matchedRule: envelope.payload.matchedRule,
    status: "CREATED",
    demoGeneration: envelope.demoGeneration,
    createdAt: now,
    updatedAt: now,
  };
  try { await repository.createIntervention(intervention, createAudit({
    interventionId: intervention.interventionId,
    eventType: "INTERVENTION_CREATED",
    actorType: "SYSTEM",
    correlationId: intervention.correlationId,
    workerId: intervention.workerId,
    hubId: intervention.hubId,
    demoGeneration: intervention.demoGeneration,
    details: { riskLevel: intervention.riskLevel, matchedRule: intervention.matchedRule, policyVersion: envelope.payload.policyVersion },
    occurredAt: now,
  })); } catch (error) {
    if (error instanceof AppError && error.code === "WORKER_INTERVENTION_ACTIVE") {
      metric("WorkerInterventionsSuppressed", 1, { operation: "CreateIntervention" });
      log("WARN", "WorkerInterventionSuppressed", {
        eventId: envelope.eventId,
        interventionId: intervention.interventionId,
        workerId: intervention.workerId,
        correlationId: intervention.correlationId,
      });
      return { ...input, creationOutcome: "WORKER_UNAVAILABLE" };
    }
    throw error;
  }
  metric("InterventionsCreated", 1, { operation: "CreateIntervention" });
  log("INFO", "CreateIntervention", { eventId: envelope.eventId, interventionId: intervention.interventionId, workerId: intervention.workerId, correlationId: intervention.correlationId });
  return { ...input, creationOutcome: "CREATED" };
};
