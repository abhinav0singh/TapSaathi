import type { Handler } from "aws-lambda";
import type { InterventionStatus } from "@taapsaathi/contracts";
import { createAudit, DynamoRepository, loadEnvironment } from "@taapsaathi/shared";
import type { WorkflowState } from "./workflow-input.js";

interface Input extends WorkflowState { terminalStatus: InterventionStatus }

export const handler: Handler<Input> = async (input) => {
  const now = new Date().toISOString();
  await new DynamoRepository(loadEnvironment().TABLE_NAME).complete({
    interventionId: input.interventionId,
    generation: input.envelope.demoGeneration,
    status: input.terminalStatus,
    now,
    audit: createAudit({ interventionId: input.interventionId, eventType: "INTERVENTION_COMPLETED", actorType: "SYSTEM", correlationId: input.envelope.correlationId, workerId: input.envelope.payload.workerId, hubId: input.envelope.payload.hubId, demoGeneration: input.envelope.demoGeneration, details: { terminalStatus: input.terminalStatus }, occurredAt: now }),
  });
  return input;
};
