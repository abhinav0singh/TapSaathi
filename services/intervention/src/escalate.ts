import type { Handler } from "aws-lambda";
import { createAudit, DynamoRepository, loadEnvironment, metric } from "@taapsaathi/shared";
import type { WorkflowState } from "./workflow-input.js";

export const handler: Handler<WorkflowState> = async (input) => {
  const reason = input.timeout ? "WORKER_TIMEOUT" : input.reassignment?.status === "REASSIGNMENT_REQUIRED" ? "NO_ELIGIBLE_WORKER" : "FEEL_UNWELL";
  const now = new Date().toISOString();
  await new DynamoRepository(loadEnvironment().TABLE_NAME).escalate({
    interventionId: input.interventionId,
    generation: input.envelope.demoGeneration,
    reason,
    now,
    audit: createAudit({ interventionId: input.interventionId, eventType: "SUPERVISOR_ESCALATED", actorType: "SYSTEM", correlationId: input.envelope.correlationId, workerId: input.envelope.payload.workerId, hubId: input.envelope.payload.hubId, demoGeneration: input.envelope.demoGeneration, details: { reason }, occurredAt: now }),
  });
  metric("SupervisorEscalations", 1, { operation: "EscalateSupervisor" });
  return input;
};
