import type {
  AuditEvent,
  DeliveryTask,
  HeatObservation,
  HeatRiskRaisedEnvelope,
  Intervention,
  RestPoint,
  Worker,
} from "@taapsaathi/contracts";
import { ConflictError, NotFoundError, StaleGenerationError } from "./errors.js";
import { selectReplacementWorker } from "./reassignment.js";
import type {
  CallbackRecord,
  ConsumeCallbackInput,
  ConsumeCallbackResult,
  Repository,
} from "./repository.js";
import { createSeedState, type SeedState } from "./seed.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryRepository implements Repository {
  private generation = 0;
  private workers = new Map<string, Worker>();
  private tasks = new Map<string, DeliveryTask>();
  private restPoints = new Map<string, RestPoint>();
  private interventions = new Map<string, Intervention>();
  private auditEvents: AuditEvent[] = [];
  private callbacks = new Map<string, CallbackRecord>();
  private locks = new Set<string>();
  private observations: HeatObservation[] = [];

  public async getDemoGeneration(): Promise<number> {
    return this.generation;
  }

  public async resetDemo(now: string): Promise<{ generation: number; state: SeedState }> {
    this.generation += 1;
    const state = createSeedState(this.generation, now);
    this.workers = new Map(state.workers.map((worker) => [worker.workerId, clone(worker)]));
    this.tasks = new Map(state.tasks.map((task) => [task.taskId, clone(task)]));
    this.restPoints = new Map(state.restPoints.map((point) => [point.restPointId, clone(point)]));
    this.interventions.clear();
    this.auditEvents = [];
    this.callbacks.clear();
    this.locks.clear();
    this.observations = [];
    return { generation: this.generation, state: clone(state) };
  }

  public async getWorkers(hubId: string): Promise<Worker[]> {
    return [...this.workers.values()].filter((worker) => worker.hubId === hubId).map(clone);
  }

  public async getTasks(hubId: string): Promise<DeliveryTask[]> {
    return [...this.tasks.values()].filter((task) => task.hubId === hubId).map(clone);
  }

  public async getRestPoints(hubId: string): Promise<RestPoint[]> {
    return [...this.restPoints.values()].filter((point) => point.hubId === hubId).map(clone);
  }

  public async getWorker(workerId: string): Promise<Worker | undefined> {
    const worker = this.workers.get(workerId);
    return worker ? clone(worker) : undefined;
  }

  public async getIntervention(interventionId: string): Promise<Intervention | undefined> {
    const intervention = this.interventions.get(interventionId);
    return intervention ? clone(intervention) : undefined;
  }

  public async listInterventions(hubId: string): Promise<Intervention[]> {
    return [...this.interventions.values()].filter((item) => item.hubId === hubId).map(clone);
  }

  public async listAuditEvents(after?: string, hubId?: string): Promise<{ events: AuditEvent[]; nextCursor: string | null }> {
    const ordered = this.auditEvents.filter((event) => !hubId || event.hubId === hubId).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const offset = after ? Number(Buffer.from(after, "base64url").toString("utf8")) : 0;
    const events = ordered.slice(Number.isFinite(offset) ? offset : 0, (Number.isFinite(offset) ? offset : 0) + 50).map(clone);
    const nextOffset = (Number.isFinite(offset) ? offset : 0) + events.length;
    return { events, nextCursor: nextOffset < ordered.length ? Buffer.from(String(nextOffset)).toString("base64url") : null };
  }

  public async putObservation(observation: HeatObservation, generation: number): Promise<void> {
    this.ensureGeneration(generation);
    this.observations.push(clone(observation));
  }

  public async claimRiskEvent(event: HeatRiskRaisedEnvelope, _interventionId: string, _expiresAt: number): Promise<boolean> {
    this.ensureGeneration(event.demoGeneration);
    if (this.locks.has(event.payload.idempotencyKey)) return false;
    this.locks.add(event.payload.idempotencyKey);
    return true;
  }

  public async createIntervention(intervention: Intervention, audit: AuditEvent): Promise<void> {
    this.ensureGeneration(intervention.demoGeneration);

    if (this.interventions.has(intervention.interventionId)) {
      throw new ConflictError("INTERVENTION_EXISTS", "Intervention already exists.");
    }

    const worker = this.workers.get(intervention.workerId);

    if (!worker) {
      throw new NotFoundError("Worker not found.");
    }

    if (
      worker.activeInterventionId ||
      !["SAFE", "CAUTION"].includes(worker.state)
    ) {
      throw new ConflictError(
        "WORKER_INTERVENTION_ACTIVE",
        "Worker already has an active or unresolved safety intervention."
      );
    }

    this.interventions.set(intervention.interventionId, clone(intervention));
    this.auditEvents.push(clone(audit));

    this.workers.set(worker.workerId, {
      ...worker,
      state: intervention.riskLevel,
      activeInterventionId: intervention.interventionId,
      updatedAt: intervention.updatedAt,
    });
  }

  public async recordSuppressedRiskEvent(audit: AuditEvent): Promise<void> {
    this.ensureGeneration(audit.demoGeneration);

    const existing = this.auditEvents.find(
      (event) => event.auditEventId === audit.auditEventId
    );

    if (existing) {
      if (JSON.stringify(existing) === JSON.stringify(audit)) {
        return;
      }

      throw new ConflictError(
        "SUPPRESSION_AUDIT_CONFLICT",
        "A different audit event already uses this ID."
      );
    }

    this.auditEvents.push(clone(audit));
  }
  public async updateGuidance(input: Parameters<Repository["updateGuidance"]>[0]): Promise<void> {
    const intervention = this.requiredIntervention(input.interventionId, input.generation);
    this.interventions.set(input.interventionId, {
      ...intervention,
      route: clone(input.route),
      ...(input.audioKey ? { audioKey: input.audioKey } : {}),
      ...(input.audioLanguage ? { audioLanguage: input.audioLanguage } : {}),
      ...(input.failure ? { guidanceFailure: input.failure } : {}),
      status: "GUIDANCE_READY",
      updatedAt: input.now,
    });
    this.auditEvents.push(clone(input.audit));
  }

  public async registerCallback(record: CallbackRecord, now: string, audit: AuditEvent): Promise<void> {
    this.ensureGeneration(record.demoGeneration);
    const key = this.callbackKey(record.interventionId, record.actorType);
    if (this.callbacks.has(key)) throw new ConflictError("CALLBACK_EXISTS", "Callback is already registered.");
    this.callbacks.set(key, clone(record));
    const intervention = this.requiredIntervention(record.interventionId, record.demoGeneration);
    const status = record.actorType === "WORKER" ? "AWAITING_WORKER" : "AWAITING_SUPERVISOR";
    this.interventions.set(record.interventionId, { ...intervention, status, updatedAt: now });
    this.auditEvents.push(clone(audit));
  }

  public async consumeCallback(input: ConsumeCallbackInput): Promise<ConsumeCallbackResult> {
    const intervention = this.interventions.get(input.interventionId);
    if (!intervention) throw new NotFoundError("Intervention not found.");
    this.ensureGeneration(intervention.demoGeneration);
    const key = this.callbackKey(input.interventionId, input.actorType);
    const callback = this.callbacks.get(key);
    if (!callback) throw new ConflictError("WRONG_WORKFLOW_STATE", "Intervention is not awaiting this response.");
    if (callback.expectedActorId !== input.actorId) throw new ConflictError("INVALID_ACTOR", "Actor is not authorized for this response.");
    if (callback.expiresAt < Math.floor(Date.now() / 1000)) throw new ConflictError("CALLBACK_EXPIRED", "The response window has expired.");
    if (callback.consumedAt) {
      if (callback.clientRequestId === input.clientRequestId && callback.action === input.action) {
        return { duplicate: true, acceptedAction: callback.action, acceptedAt: callback.consumedAt };
      }
      throw new ConflictError("ALREADY_RESPONDED", "This intervention already has a response.");
    }
    this.callbacks.set(key, { ...callback, consumedAt: input.consumedAt, clientRequestId: input.clientRequestId, action: input.action });
    this.auditEvents.push({ auditEventId: `audit-response-${input.clientRequestId}`, interventionId: input.interventionId, eventType: "RESPONSE_ACCEPTED", actorId: input.actorId, actorType: input.actorType, correlationId: intervention.correlationId, workerId: intervention.workerId, hubId: intervention.hubId, demoGeneration: intervention.demoGeneration, details: { action: input.action, clientRequestId: input.clientRequestId }, occurredAt: input.consumedAt });
    return { duplicate: false, taskToken: callback.taskToken, acceptedAction: input.action, acceptedAt: input.consumedAt };
  }

  public async releaseCallback(input: { interventionId: string; actorType: "WORKER" | "SUPERVISOR"; clientRequestId: string }): Promise<void> {
    const key = this.callbackKey(input.interventionId, input.actorType);
    const callback = this.callbacks.get(key);
    if (callback?.clientRequestId === input.clientRequestId) {
      const { consumedAt: _consumedAt, clientRequestId: _requestId, action: _action, ...released } = callback;
      this.callbacks.set(key, released);
      this.auditEvents = this.auditEvents.filter((event) => event.auditEventId !== `audit-response-${input.clientRequestId}`);
    }
  }

  public async finalizeCallback(input: { interventionId: string; actorType: "WORKER" | "SUPERVISOR"; clientRequestId: string }): Promise<void> {
    const key = this.callbackKey(input.interventionId, input.actorType);
    const callback = this.callbacks.get(key);
    if (callback?.clientRequestId === input.clientRequestId) this.callbacks.set(key, { ...callback, taskToken: "[CONSUMED]" });
  }

  public async reassignTask(input: Parameters<Repository["reassignTask"]>[0]): Promise<{ replacementWorkerId?: string; status: "REASSIGNED" | "REASSIGNMENT_REQUIRED" }> {
    this.ensureGeneration(input.generation);
    const intervention = this.requiredIntervention(input.interventionId, input.generation);
    const task = this.tasks.get(input.taskId);
    if (!task || task.assigneeId !== input.workerId || task.status !== "ASSIGNED") {
      throw new ConflictError("TASK_OWNERSHIP_CHANGED", "Task is no longer assigned to the expected worker.");
    }
    const replacement = selectReplacementWorker(await this.getWorkers(input.hubId), input.workerId);
    if (!replacement) {
      this.tasks.set(task.taskId, { ...task, assigneeId: null, status: "REASSIGNMENT_REQUIRED", updatedAt: input.now });
      const original = this.workers.get(input.workerId);
      if (original) {
        this.workers.set(original.workerId, {
          ...original,
          activeTaskIds: original.activeTaskIds.filter((id) => id !== task.taskId),
          updatedAt: input.now,
        });
      }
      this.interventions.set(intervention.interventionId, { ...intervention, status: "REASSIGNMENT_REQUIRED", escalationReason: "NO_ELIGIBLE_WORKER", updatedAt: input.now });
      return { status: "REASSIGNMENT_REQUIRED" };
    }
    const original = this.workers.get(input.workerId);
    if (!original) throw new NotFoundError("Original worker not found.");
    this.tasks.set(task.taskId, { ...task, assigneeId: replacement.workerId, updatedAt: input.now });
    this.workers.set(original.workerId, input.preserveIntervention
      ? { ...original, activeTaskIds: original.activeTaskIds.filter((id) => id !== task.taskId), updatedAt: input.now }
      : { ...original, state: "RESTING", activeTaskIds: original.activeTaskIds.filter((id) => id !== task.taskId), activeInterventionId: undefined, updatedAt: input.now });
    this.workers.set(replacement.workerId, { ...replacement, activeTaskIds: [...replacement.activeTaskIds, task.taskId], updatedAt: input.now });
    this.interventions.set(intervention.interventionId, input.preserveIntervention
      ? { ...intervention, replacementWorkerId: replacement.workerId, updatedAt: input.now }
      : { ...intervention, status: "RESTING", replacementWorkerId: replacement.workerId, updatedAt: input.now });
    this.auditEvents.push({ auditEventId: `audit-reassign-${input.interventionId}`, interventionId: input.interventionId, eventType: "DELIVERY_REASSIGNED", actorType: "SYSTEM", correlationId: input.correlationId, workerId: input.workerId, hubId: input.hubId, demoGeneration: input.generation, details: { taskId: input.taskId, replacementWorkerId: replacement.workerId }, occurredAt: input.now });
    return { status: "REASSIGNED", replacementWorkerId: replacement.workerId };
  }

  public async escalate(input: Parameters<Repository["escalate"]>[0]): Promise<void> {
    const intervention = this.requiredIntervention(input.interventionId, input.generation);
    this.interventions.set(input.interventionId, { ...intervention, status: "AWAITING_SUPERVISOR", escalationReason: input.reason, updatedAt: input.now });
    const worker = this.workers.get(intervention.workerId);
    if (worker) this.workers.set(worker.workerId, { ...worker, state: "AWAITING_SUPERVISOR", updatedAt: input.now });
    this.auditEvents.push(clone(input.audit));
  }

  public async complete(input: Parameters<Repository["complete"]>[0]): Promise<void> {
    const intervention = this.requiredIntervention(input.interventionId, input.generation);
    const worker = this.workers.get(intervention.workerId);

    this.interventions.set(input.interventionId, {
      ...intervention,
      status: input.status,
      updatedAt: input.now,
      completedAt: input.now,
    });

    if (worker?.activeInterventionId === input.interventionId) {
      const { activeInterventionId: _previous, ...rest } = worker;

      this.workers.set(worker.workerId, {
        ...rest,
        updatedAt: input.now,
      });
    }

    this.auditEvents.push(clone(input.audit));
  }

  public async resumeWorker(input: Parameters<Repository["resumeWorker"]>[0]): Promise<{ duplicate: boolean; resumedAt: string }> {
    this.ensureGeneration(input.generation);
    const existing = this.auditEvents.find(
      (event) => event.auditEventId === `audit-resume-${input.clientRequestId}`
    );
    if (existing) return { duplicate: true, resumedAt: existing.occurredAt };

    const worker = this.workers.get(input.workerId);
    if (!worker) throw new NotFoundError("Worker not found.");
    if (worker.state !== input.fromState || worker.activeInterventionId) {
      throw new ConflictError(
        "WORKER_NOT_RESTING",
        "This rider is not currently eligible to resume work."
      );
    }

    this.workers.set(worker.workerId, {
      ...worker,
      state: "SAFE",
      activeMinutes: 0,
      updatedAt: input.now,
    });
    this.auditEvents.push(clone(input.audit));
    return { duplicate: false, resumedAt: input.now };
  }

  private ensureGeneration(generation: number): void {
    if (generation !== this.generation) throw new StaleGenerationError();
  }

  private requiredIntervention(id: string, generation: number): Intervention {
    this.ensureGeneration(generation);
    const intervention = this.interventions.get(id);
    if (!intervention) throw new NotFoundError("Intervention not found.");
    return intervention;
  }

  private callbackKey(id: string, actor: string): string {
    return `${id}#${actor}`;
  }
}
