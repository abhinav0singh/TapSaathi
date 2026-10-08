import type {
  AuditEvent,
  DeliveryTask,
  HeatObservation,
  HeatRiskRaisedEnvelope,
  Intervention,
  ResponseAction,
  RestPoint,
  RouteView,
  Worker,
} from "@taapsaathi/contracts";
import type { SeedState } from "./seed.js";

export interface CallbackRecord {
  interventionId: string;
  actorType: "WORKER" | "SUPERVISOR";
  expectedActorId: string;
  taskToken: string;
  demoGeneration: number;
  expiresAt: number;
  consumedAt?: string;
  clientRequestId?: string;
  action?: ResponseAction;
}

export interface ConsumeCallbackInput {
  interventionId: string;
  actorType: "WORKER" | "SUPERVISOR";
  actorId: string;
  clientRequestId: string;
  action: ResponseAction;
  consumedAt: string;
}

export interface ConsumeCallbackResult {
  duplicate: boolean;
  taskToken?: string;
  acceptedAction: ResponseAction;
  acceptedAt: string;
}

export interface Repository {
  getDemoGeneration(): Promise<number>;
  resetDemo(now: string): Promise<{ generation: number; state: SeedState }>;
  getWorkers(hubId: string): Promise<Worker[]>;
  getTasks(hubId: string): Promise<DeliveryTask[]>;
  getRestPoints(hubId: string): Promise<RestPoint[]>;
  getWorker(workerId: string): Promise<Worker | undefined>;
  getIntervention(interventionId: string): Promise<Intervention | undefined>;
  listInterventions(hubId: string): Promise<Intervention[]>;
  listAuditEvents(after?: string, hubId?: string): Promise<{ events: AuditEvent[]; nextCursor: string | null }>;
  putObservation(observation: HeatObservation, generation: number): Promise<void>;
  claimRiskEvent(event: HeatRiskRaisedEnvelope, interventionId: string, expiresAt: number): Promise<boolean>;
  createIntervention(intervention: Intervention, audit: AuditEvent): Promise<void>;
  updateGuidance(input: { interventionId: string; generation: number; route: RouteView; audioKey?: string; audioLanguage?: "en" | "hi"; failure?: "GUIDANCE_ROUTE_FAILED" | "GUIDANCE_AUDIO_FAILED"; now: string; audit: AuditEvent }): Promise<void>;
  registerCallback(record: CallbackRecord, now: string, audit: AuditEvent): Promise<void>;
  consumeCallback(input: ConsumeCallbackInput): Promise<ConsumeCallbackResult>;
  releaseCallback(input: { interventionId: string; actorType: "WORKER" | "SUPERVISOR"; clientRequestId: string }): Promise<void>;
  finalizeCallback(input: { interventionId: string; actorType: "WORKER" | "SUPERVISOR"; clientRequestId: string }): Promise<void>;
  reassignTask(input: { interventionId: string; generation: number; workerId: string; taskId: string; hubId: string; now: string; correlationId: string }): Promise<{ replacementWorkerId?: string; status: "REASSIGNED" | "REASSIGNMENT_REQUIRED" }>;
  escalate(input: { interventionId: string; generation: number; reason: "FEEL_UNWELL" | "WORKER_TIMEOUT" | "NO_ELIGIBLE_WORKER"; now: string; audit: AuditEvent }): Promise<void>;
  complete(input: { interventionId: string; generation: number; status: Intervention["status"]; now: string; audit: AuditEvent }): Promise<void>;
}
