import type { Handler } from "aws-lambda";
import { DynamoRepository, loadEnvironment, log, metric } from "@taapsaathi/shared";
import type { WorkflowState } from "./workflow-input.js";

export const handler: Handler<WorkflowState> = async (input) => {
  if (!input.taskId) return { ...input, reassignment: { status: "REASSIGNMENT_REQUIRED" } };
  const result = await new DynamoRepository(loadEnvironment().TABLE_NAME).reassignTask({
    interventionId: input.interventionId,
    generation: input.envelope.demoGeneration,
    workerId: input.envelope.payload.workerId,
    taskId: input.taskId,
    hubId: input.envelope.payload.hubId,
    now: new Date().toISOString(),
    correlationId: input.envelope.correlationId,
    preserveIntervention: input.deliveryHandling === "ESCALATION",
  });
  log("INFO", "ReassignDelivery", { interventionId: input.interventionId, workerId: input.envelope.payload.workerId, replacementWorkerId: result.replacementWorkerId, status: result.status, correlationId: input.envelope.correlationId });
  if (result.status === "REASSIGNED") metric("ReassignmentsSucceeded", 1, { operation: "ReassignDelivery" });
  return { ...input, reassignment: result };
};
