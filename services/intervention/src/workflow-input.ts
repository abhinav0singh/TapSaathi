import { HeatRiskRaisedEnvelopeSchema, type HeatRiskRaisedEnvelope } from "@taapsaathi/contracts";

export interface WorkflowState {
  envelope: HeatRiskRaisedEnvelope;
  interventionId: string;
  duplicate: boolean;
  taskId?: string;
  workerLanguage?: "en" | "hi";
  workerPosition?: [number, number];
  action?: "TAKE_BREAK" | "FEEL_UNWELL" | "SUPERVISOR_ACK";
  timeout?: unknown;
  reassignment?: { replacementWorkerId?: string; status: "REASSIGNED" | "REASSIGNMENT_REQUIRED" };
}

export function parseEventBridgeInput(input: unknown): HeatRiskRaisedEnvelope {
  if (input && typeof input === "object" && "detail" in input) {
    return HeatRiskRaisedEnvelopeSchema.parse((input as { detail: unknown }).detail);
  }
  return HeatRiskRaisedEnvelopeSchema.parse(input);
}
