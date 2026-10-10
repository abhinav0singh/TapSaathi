import { isDeepStrictEqual } from "node:util";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
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
import { createSeedState, DEMO_HUB_ID, type SeedState } from "./seed.js";

type DocumentClient = Pick<DynamoDBDocumentClient, "send">;
// DynamoDB DocumentClient accepts the complete native JavaScript value union.
// `any` is used only at this persistence boundary; domain values are validated by Zod.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbItem = Record<string, any>;

const GSI_NAME = "GSI1";

function isConditionalFailure(error: unknown): boolean {
  return error instanceof Error && [
    "ConditionalCheckFailedException",
    "TransactionCanceledException",
  ].includes(error.name);
}

function withoutKeys<T>(item: DbItem | undefined): T | undefined {
  if (!item) return undefined;
  const { PK: _pk, SK: _sk, GSI1PK: _gpk, GSI1SK: _gsk, entityType: _type, demoHubId: _hub, expiresAt: _ttl, ...value } = item;
  return value as T;
}

function workerItem(worker: Worker): DbItem {
  return {
    PK: `WORKER#${worker.workerId}`,
    SK: "PROFILE",
    GSI1PK: `HUB#${worker.hubId}`,
    GSI1SK: `STATE#${worker.state}#WORKER#${worker.workerId}`,
    entityType: "WORKER",
    demoHubId: worker.hubId,
    expiresAt: Math.floor(new Date(worker.updatedAt).getTime() / 1000) + 86400,
    ...worker,
  };
}

function taskItem(task: DeliveryTask): DbItem {
  return {
    PK: `TASK#${task.taskId}`,
    SK: "META",
    GSI1PK: `HUB#${task.hubId}`,
    GSI1SK: `TASK#${task.status}#${task.taskId}`,
    entityType: "TASK",
    demoHubId: task.hubId,
    ...task,
  };
}

function restPointItem(point: RestPoint): DbItem {
  return {
    PK: `RESTPOINT#${point.restPointId}`,
    SK: "META",
    GSI1PK: `HUB#${point.hubId}`,
    GSI1SK: `RESTPOINT#${point.restPointId}`,
    entityType: "RESTPOINT",
    demoHubId: point.hubId,
    ...point,
  };
}

function interventionItem(intervention: Intervention): DbItem {
  return {
    PK: `INTERVENTION#${intervention.interventionId}`,
    SK: "META",
    GSI1PK: `HUB#${intervention.hubId}`,
    GSI1SK: `INTERVENTION#${intervention.createdAt}#${intervention.interventionId}`,
    entityType: "INTERVENTION",
    demoHubId: intervention.hubId,
    ...intervention,
  };
}

function auditItem(audit: AuditEvent): DbItem {
  return {
    PK: `INTERVENTION#${audit.interventionId}`,
    SK: `EVENT#${audit.occurredAt}#${audit.auditEventId}`,
    entityType: "AUDIT_EVENT",
    demoHubId: audit.hubId,
    ...audit,
  };
}

export class DynamoRepository implements Repository {
  private readonly client: DocumentClient;

  public constructor(
    private readonly tableName: string,
    client?: DocumentClient,
  ) {
    this.client = client ?? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  public async getDemoGeneration(): Promise<number> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: "CONFIG#DEMO", SK: "GENERATION" },
      ConsistentRead: true,
    }));
    return Number(result.Item?.["value"] ?? 0);
  }

  public async resetDemo(now: string): Promise<{ generation: number; state: SeedState }> {
    const lockExpiresAt = Math.floor(Date.now() / 1000) + 90;
    try {
      await this.client.send(new PutCommand({
        TableName: this.tableName,
        Item: { PK: `RESET#${DEMO_HUB_ID}`, SK: "LOCK", expiresAt: lockExpiresAt, createdAt: now },
        ConditionExpression: "attribute_not_exists(PK) OR expiresAt < :nowEpoch",
        ExpressionAttributeValues: { ":nowEpoch": Math.floor(Date.now() / 1000) },
      }));
    } catch (error) {
      if (isConditionalFailure(error)) throw new ConflictError("RESET_IN_PROGRESS", "A demo reset is already running.");
      throw error;
    }

    try {
      const generationResult = await this.client.send(new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: "CONFIG#DEMO", SK: "GENERATION" },
        UpdateExpression: "SET #value = if_not_exists(#value, :zero) + :one, updatedAt = :now",
        ExpressionAttributeNames: { "#value": "value" },
        ExpressionAttributeValues: { ":zero": 0, ":one": 1, ":now": now },
        ReturnValues: "ALL_NEW",
      }));
      const generation = Number(generationResult.Attributes?.["value"]);

      let lastKey: Record<string, unknown> | undefined;
      do {
        const page = await this.client.send(new ScanCommand({
          TableName: this.tableName,
          ProjectionExpression: "PK, SK",
          FilterExpression: "demoHubId = :hub",
          ExpressionAttributeValues: { ":hub": DEMO_HUB_ID },
          ExclusiveStartKey: lastKey,
        }));
        const items = page.Items ?? [];
        for (let offset = 0; offset < items.length; offset += 25) {
          const batch = items.slice(offset, offset + 25);
          if (batch.length > 0) {
            await this.batchWrite(batch.map((item) => ({ DeleteRequest: { Key: { PK: item["PK"], SK: item["SK"] } } })));
          }
        }
        lastKey = page.LastEvaluatedKey;
      } while (lastKey);

      const state = createSeedState(generation, now);
      const shifts = state.workers.map((worker) => ({
        PK: `WORKER#${worker.workerId}`,
        SK: `SHIFT#${worker.shiftId}`,
        GSI1PK: `HUB#${worker.hubId}`,
        GSI1SK: `SHIFT#${now}#${worker.shiftId}`,
        entityType: "SHIFT",
        demoHubId: worker.hubId,
        workerId: worker.workerId,
        shiftId: worker.shiftId,
        hubId: worker.hubId,
        active: true,
        startedAt: now,
        demoGeneration: generation,
        expiresAt: Math.floor(new Date(now).getTime() / 1000) + 86400,
      }));
      const items = [
        ...state.workers.map(workerItem),
        ...state.tasks.map(taskItem),
        ...state.restPoints.map(restPointItem),
        ...shifts,
      ];
      await this.batchWrite(items.map((Item) => ({ PutRequest: { Item } })));

      const [workers, tasks, restPoints, interventions] = await Promise.all([
        this.getWorkers(DEMO_HUB_ID),
        this.getTasks(DEMO_HUB_ID),
        this.getRestPoints(DEMO_HUB_ID),
        this.listInterventions(DEMO_HUB_ID),
      ]);
      const ravi = workers.find((worker) => worker.workerId === "ravi-001");
      const asha = workers.find((worker) => worker.workerId === "asha-001");
      const imran = workers.find((worker) => worker.workerId === "imran-001");
      const delivery = tasks.find((task) => task.taskId === "delivery-001");
      if (
        workers.length !== 3
        || tasks.length !== 1
        || restPoints.length !== 3
        || interventions.length !== 0
        || ravi?.state !== "SAFE"
        || ravi?.activeMinutes !== 75
        || asha?.state !== "SAFE"
        || asha?.activeMinutes !== 20
        || imran?.state !== "CAUTION"
        || imran?.activeMinutes !== 50
        || delivery?.assigneeId !== "ravi-001"
        || delivery?.status !== "ASSIGNED"
      ) {
        throw new Error("Reset verification failed");
      }
      return { generation, state };
    } finally {
      await this.client.send(new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: `RESET#${DEMO_HUB_ID}`, SK: "LOCK" },
      }));
    }
  }

  public async getWorkers(hubId: string): Promise<Worker[]> {
    return this.queryHub<Worker>(hubId, "STATE#");
  }

  public async getTasks(hubId: string): Promise<DeliveryTask[]> {
    return this.queryHub<DeliveryTask>(hubId, "TASK#");
  }

  public async getRestPoints(hubId: string): Promise<RestPoint[]> {
    return this.queryHub<RestPoint>(hubId, "RESTPOINT#");
  }

  public async getWorker(workerId: string): Promise<Worker | undefined> {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { PK: `WORKER#${workerId}`, SK: "PROFILE" }, ConsistentRead: true }));
    return withoutKeys<Worker>(result.Item);
  }

  public async getIntervention(interventionId: string): Promise<Intervention | undefined> {
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { PK: `INTERVENTION#${interventionId}`, SK: "META" }, ConsistentRead: true }));
    return withoutKeys<Intervention>(result.Item);
  }

  public async listInterventions(hubId: string): Promise<Intervention[]> {
    return this.queryHub<Intervention>(hubId, "INTERVENTION#");
  }

  public async listAuditEvents(after?: string, hubId?: string): Promise<{ events: AuditEvent[]; nextCursor: string | null }> {
    let offset = 0;
    if (after) {
      try { offset = Number(Buffer.from(after, "base64url").toString("utf8")); }
      catch { throw new ConflictError("INVALID_CURSOR", "Event cursor is invalid."); }
    }
    if (!Number.isInteger(offset) || offset < 0) throw new ConflictError("INVALID_CURSOR", "Event cursor is invalid.");
    const all: AuditEvent[] = [];
    let lastKey: Record<string, unknown> | undefined;
    do {
      const result = await this.client.send(new ScanCommand({
        TableName: this.tableName,
        FilterExpression: hubId ? "entityType = :type AND demoHubId = :hub" : "entityType = :type",
        ExpressionAttributeValues: { ":type": "AUDIT_EVENT", ...(hubId ? { ":hub": hubId } : {}) },
        ExclusiveStartKey: lastKey,
      }));
      all.push(...(result.Items ?? []).map((item) => withoutKeys<AuditEvent>(item)!));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);
    all.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.auditEventId.localeCompare(b.auditEventId));
    const events = all.slice(offset, offset + 50);
    const nextOffset = offset + events.length;
    return {
      events,
      nextCursor: nextOffset < all.length ? Buffer.from(String(nextOffset)).toString("base64url") : null,
    };
  }

  public async putObservation(observation: HeatObservation, generation: number): Promise<void> {
    await this.assertGeneration(generation);
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `HUB#${observation.hubId}`,
        SK: `WEATHER#${observation.observedAt}#${observation.observationId}`,
        entityType: "WEATHER",
        demoHubId: observation.hubId,
        ...observation,
        demoGeneration: generation,
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
      },
    }));
  }

  public async claimRiskEvent(event: HeatRiskRaisedEnvelope, interventionId: string, expiresAt: number): Promise<boolean> {
    try {
      await this.client.send(new TransactWriteCommand({
        TransactItems: [
          {
            ConditionCheck: {
              TableName: this.tableName,
              Key: { PK: "CONFIG#DEMO", SK: "GENERATION" },
              ConditionExpression: "#value = :generation",
              ExpressionAttributeNames: { "#value": "value" },
              ExpressionAttributeValues: { ":generation": event.demoGeneration },
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: {
                PK: `IDEMPOTENCY#${event.payload.idempotencyKey}`,
                SK: "LOCK",
                entityType: "IDEMPOTENCY",
                demoHubId: event.payload.hubId,
                eventId: event.eventId,
                interventionId,
                demoGeneration: event.demoGeneration,
                expiresAt,
              },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      }));
      return true;
    } catch (error) {
      if (!isConditionalFailure(error)) throw error;
      const currentGeneration = await this.getDemoGeneration();
      if (currentGeneration !== event.demoGeneration) throw new StaleGenerationError();
      return false;
    }
  }

  public async createIntervention(intervention: Intervention, audit: AuditEvent): Promise<void> {
    try {
      await this.client.send(new TransactWriteCommand({
        TransactItems: [
          this.generationCheck(intervention.demoGeneration),
          { Put: { TableName: this.tableName, Item: interventionItem(intervention), ConditionExpression: "attribute_not_exists(PK)" } },
          { Put: { TableName: this.tableName, Item: auditItem(audit), ConditionExpression: "attribute_not_exists(PK)" } },
          {
            Update: {
              TableName: this.tableName,
              Key: { PK: `WORKER#${intervention.workerId}`, SK: "PROFILE" },
              UpdateExpression: "SET #state = :risk, GSI1SK = :gsi, activeInterventionId = :interventionId, updatedAt = :now",
              ConditionExpression: "demoGeneration = :generation AND attribute_not_exists(activeInterventionId) AND (#state = :safe OR #state = :caution)",
              ExpressionAttributeNames: { "#state": "state" },
              ExpressionAttributeValues: { ":risk": intervention.riskLevel, ":gsi": `STATE#${intervention.riskLevel}#WORKER#${intervention.workerId}`, ":interventionId": intervention.interventionId, ":now": intervention.updatedAt, ":generation": intervention.demoGeneration, ":safe": "SAFE", ":caution": "CAUTION" },
            },
          },
        ],
      }));
    } catch (error) {
      const reasons =
        error instanceof Error &&
        error.name === "TransactionCanceledException" &&
        "CancellationReasons" in error &&
        Array.isArray(error.CancellationReasons)
          ? error.CancellationReasons
          : undefined;

      const conditionalFailure =
        reasons !== undefined &&
        reasons.some(
          (reason) =>
            reason !== null &&
            typeof reason === "object" &&
            "Code" in reason &&
            reason.Code === "ConditionalCheckFailed"
        ) &&
        reasons.every(
          (reason) =>
            reason !== null &&
            typeof reason === "object" &&
            "Code" in reason &&
            (reason.Code === "None" ||
              reason.Code === "ConditionalCheckFailed")
        );

      if (conditionalFailure && reasons?.length === 4) {
        const failedIndexes = reasons.flatMap((reason, index) =>
          reason?.Code === "ConditionalCheckFailed" ? [index] : []
        );

        if (failedIndexes.length === 1) {
          switch (failedIndexes[0]) {
            case 0:
              throw new StaleGenerationError();

            case 3:
              throw new ConflictError(
                "WORKER_INTERVENTION_ACTIVE",
                "Worker is not eligible for a new intervention."
              );

            case 1:
            case 2:
              throw new ConflictError(
                "INTERVENTION_CREATE_CONFLICT",
                "Intervention record could not be created."
              );
          }
        }
      }

      throw error;
    }
  }

  public async recordSuppressedRiskEvent(audit: AuditEvent): Promise<void> {
    const key = {
      PK: `INTERVENTION#${audit.interventionId}`,
      SK: `EVENT#SUPPRESSED#${audit.auditEventId}`,
    };

    try {
      await this.client.send(new TransactWriteCommand({
        TransactItems: [
          this.generationCheck(audit.demoGeneration),
          {
            Put: {
              TableName: this.tableName,
              Item: {
                ...auditItem(audit),
                ...key,
              },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      }));
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.name !== "TransactionCanceledException"
      ) {
        throw error;
      }

      const reasons =
        "CancellationReasons" in error &&
        Array.isArray(error.CancellationReasons)
          ? error.CancellationReasons
          : undefined;

      const codes = reasons?.map((reason) =>
        reason && typeof reason === "object" && "Code" in reason
          ? reason.Code
          : undefined
      );

      if (
        codes?.length !== 2 ||
        !codes.every((code) =>
          code === "None" || code === "ConditionalCheckFailed"
        )
      ) {
        throw error;
      }

      if (
        codes[0] === "ConditionalCheckFailed" &&
        codes[1] === "None"
      ) {
        throw new StaleGenerationError();
      }

      if (
        codes[0] !== "None" ||
        codes[1] !== "ConditionalCheckFailed"
      ) {
        throw error;
      }

      const existing = await this.client.send(new GetCommand({
        TableName: this.tableName,
        Key: key,
        ConsistentRead: true,
      }));

      if (!existing.Item) {
        throw error;
      }

      const storedAudit = withoutKeys<AuditEvent>(existing.Item);

      if (!isDeepStrictEqual(storedAudit, audit)) {
        throw new ConflictError(
          "SUPPRESSION_AUDIT_CONFLICT",
          "A different audit event already uses this ID."
        );
      }

      const currentGeneration = await this.getDemoGeneration();

      if (currentGeneration !== audit.demoGeneration) {
        throw new StaleGenerationError();
      }
    }
  }
  public async updateGuidance(input: Parameters<Repository["updateGuidance"]>[0]): Promise<void> {
    const names: Record<string, string> = { "#status": "status", "#route": "route" };
    const values: Record<string, unknown> = { ":status": "GUIDANCE_READY", ":route": input.route, ":now": input.now, ":generation": input.generation };
    const sets = ["#status = :status", "#route = :route", "updatedAt = :now"];
    if (input.audioKey) { sets.push("audioKey = :audioKey"); values[":audioKey"] = input.audioKey; }
    if (input.audioLanguage) { sets.push("audioLanguage = :audioLanguage"); values[":audioLanguage"] = input.audioLanguage; }
    if (input.failure) { sets.push("guidanceFailure = :failure"); values[":failure"] = input.failure; }
    await this.client.send(new TransactWriteCommand({
      TransactItems: [
        this.generationCheck(input.generation),
        { Update: { TableName: this.tableName, Key: { PK: `INTERVENTION#${input.interventionId}`, SK: "META" }, UpdateExpression: `SET ${sets.join(", ")}`, ConditionExpression: "demoGeneration = :generation", ExpressionAttributeNames: names, ExpressionAttributeValues: values } },
        { Put: { TableName: this.tableName, Item: auditItem(input.audit), ConditionExpression: "attribute_not_exists(PK)" } },
      ],
    }));
  }

  public async registerCallback(record: CallbackRecord, now: string, audit: AuditEvent): Promise<void> {
    const status = record.actorType === "WORKER" ? "AWAITING_WORKER" : "AWAITING_SUPERVISOR";
    try {
      await this.client.send(new TransactWriteCommand({
        TransactItems: [
          this.generationCheck(record.demoGeneration),
          { Put: { TableName: this.tableName, Item: { PK: `INTERVENTION#${record.interventionId}`, SK: `CALLBACK#${record.actorType}`, entityType: "CALLBACK", demoHubId: DEMO_HUB_ID, ...record }, ConditionExpression: "attribute_not_exists(PK)" } },
          { Update: { TableName: this.tableName, Key: { PK: `INTERVENTION#${record.interventionId}`, SK: "META" }, UpdateExpression: "SET #status = :status, updatedAt = :now", ConditionExpression: "demoGeneration = :generation", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":status": status, ":now": now, ":generation": record.demoGeneration } } },
          { Put: { TableName: this.tableName, Item: auditItem(audit), ConditionExpression: "attribute_not_exists(PK)" } },
        ],
      }));
    } catch (error) {
      if (isConditionalFailure(error)) throw new ConflictError("CALLBACK_EXISTS", "Callback is already registered or stale.");
      throw error;
    }
  }

  public async consumeCallback(input: ConsumeCallbackInput): Promise<ConsumeCallbackResult> {
    const intervention = await this.getIntervention(input.interventionId);
    if (!intervention) throw new NotFoundError("Intervention not found.");
    await this.assertGeneration(intervention.demoGeneration);
    const key = { PK: `INTERVENTION#${input.interventionId}`, SK: `CALLBACK#${input.actorType}` };
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: key, ConsistentRead: true }));
    const callback = result.Item as (CallbackRecord & DbItem) | undefined;
    if (!callback) throw new ConflictError("WRONG_WORKFLOW_STATE", "Intervention is not awaiting this response.");
    if (callback.expectedActorId !== input.actorId) throw new ConflictError("INVALID_ACTOR", "Actor is not authorized for this response.");
    if (callback.expiresAt < Math.floor(Date.now() / 1000)) throw new ConflictError("CALLBACK_EXPIRED", "The response window has expired.");
    if (callback.consumedAt) {
      if (callback.clientRequestId === input.clientRequestId && callback.action === input.action) {
        return { duplicate: true, acceptedAction: callback.action, acceptedAt: callback.consumedAt };
      }
      throw new ConflictError("ALREADY_RESPONDED", "This intervention already has a response.");
    }
    const audit: AuditEvent = { auditEventId: `audit-response-${input.clientRequestId}`, interventionId: input.interventionId, eventType: "RESPONSE_ACCEPTED", actorId: input.actorId, actorType: input.actorType, correlationId: intervention.correlationId, workerId: intervention.workerId, hubId: intervention.hubId, demoGeneration: intervention.demoGeneration, details: { action: input.action, clientRequestId: input.clientRequestId }, occurredAt: input.consumedAt };
    try {
      await this.client.send(new TransactWriteCommand({ TransactItems: [
        this.generationCheck(intervention.demoGeneration),
        { Update: { TableName: this.tableName, Key: key, UpdateExpression: "SET consumedAt = :at, clientRequestId = :requestId, #action = :action", ConditionExpression: "attribute_not_exists(consumedAt) AND demoGeneration = :generation AND expiresAt >= :nowEpoch", ExpressionAttributeNames: { "#action": "action" }, ExpressionAttributeValues: { ":at": input.consumedAt, ":requestId": input.clientRequestId, ":action": input.action, ":generation": intervention.demoGeneration, ":nowEpoch": Math.floor(Date.now() / 1000) } } },
        { Put: { TableName: this.tableName, Item: auditItem(audit), ConditionExpression: "attribute_not_exists(PK)" } },
      ] }));
    } catch (error) {
      if (isConditionalFailure(error)) throw new ConflictError("ALREADY_RESPONDED", "This intervention already has a response.");
      throw error;
    }
    return { duplicate: false, taskToken: callback.taskToken, acceptedAction: input.action, acceptedAt: input.consumedAt };
  }

  public async releaseCallback(input: { interventionId: string; actorType: "WORKER" | "SUPERVISOR"; clientRequestId: string }): Promise<void> {
    const events = await this.client.send(new QueryCommand({ TableName: this.tableName, KeyConditionExpression: "PK = :pk AND begins_with(SK, :event)", FilterExpression: "auditEventId = :audit", ExpressionAttributeValues: { ":pk": `INTERVENTION#${input.interventionId}`, ":event": "EVENT#", ":audit": `audit-response-${input.clientRequestId}` } }));
    const auditRecord = events.Items?.[0];
    await this.client.send(new TransactWriteCommand({ TransactItems: [
      { Update: { TableName: this.tableName, Key: { PK: `INTERVENTION#${input.interventionId}`, SK: `CALLBACK#${input.actorType}` }, UpdateExpression: "REMOVE consumedAt, clientRequestId, #action", ConditionExpression: "clientRequestId = :requestId", ExpressionAttributeNames: { "#action": "action" }, ExpressionAttributeValues: { ":requestId": input.clientRequestId } } },
      ...(auditRecord ? [{ Delete: { TableName: this.tableName, Key: { PK: auditRecord["PK"], SK: auditRecord["SK"] } } }] : []),
    ] }));
  }

  public async finalizeCallback(input: { interventionId: string; actorType: "WORKER" | "SUPERVISOR"; clientRequestId: string }): Promise<void> {
    await this.client.send(new UpdateCommand({ TableName: this.tableName, Key: { PK: `INTERVENTION#${input.interventionId}`, SK: `CALLBACK#${input.actorType}` }, UpdateExpression: "REMOVE taskToken", ConditionExpression: "clientRequestId = :requestId", ExpressionAttributeValues: { ":requestId": input.clientRequestId } }));
  }

  public async reassignTask(input: Parameters<Repository["reassignTask"]>[0]): Promise<{ replacementWorkerId?: string; status: "REASSIGNED" | "REASSIGNMENT_REQUIRED" }> {
    await this.assertGeneration(input.generation);
    const workers = await this.getWorkers(input.hubId);
    const replacement = selectReplacementWorker(workers, input.workerId);
    const original = workers.find((worker) => worker.workerId === input.workerId);
    if (!original) throw new NotFoundError("Original worker not found.");
    const remainingTaskIds = original.activeTaskIds.filter((id) => id !== input.taskId);
    if (!replacement) {
      await this.client.send(new TransactWriteCommand({ TransactItems: [
        this.generationCheck(input.generation),
        { Update: { TableName: this.tableName, Key: { PK: `TASK#${input.taskId}`, SK: "META" }, UpdateExpression: "SET assigneeId = :none, #status = :status, GSI1SK = :gsi, updatedAt = :now", ConditionExpression: "assigneeId = :worker AND #status = :assigned AND demoGeneration = :generation", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":none": null, ":status": "REASSIGNMENT_REQUIRED", ":gsi": `TASK#REASSIGNMENT_REQUIRED#${input.taskId}`, ":now": input.now, ":worker": input.workerId, ":assigned": "ASSIGNED", ":generation": input.generation } } },
        { Update: { TableName: this.tableName, Key: { PK: `WORKER#${input.workerId}`, SK: "PROFILE" }, UpdateExpression: "SET activeTaskIds = :remaining, updatedAt = :now", ConditionExpression: "demoGeneration = :generation", ExpressionAttributeValues: { ":remaining": remainingTaskIds, ":now": input.now, ":generation": input.generation } } },
        { Update: { TableName: this.tableName, Key: { PK: `INTERVENTION#${input.interventionId}`, SK: "META" }, UpdateExpression: "SET #status = :status, escalationReason = :reason, updatedAt = :now", ConditionExpression: "demoGeneration = :generation", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":status": "REASSIGNMENT_REQUIRED", ":reason": "NO_ELIGIBLE_WORKER", ":now": input.now, ":generation": input.generation } } },
      ] }));
      return { status: "REASSIGNMENT_REQUIRED" };
    }
    const audit: AuditEvent = { auditEventId: `audit-reassign-${input.interventionId}`, interventionId: input.interventionId, eventType: "DELIVERY_REASSIGNED", actorType: "SYSTEM", correlationId: input.correlationId, workerId: input.workerId, hubId: input.hubId, demoGeneration: input.generation, details: { taskId: input.taskId, replacementWorkerId: replacement.workerId }, occurredAt: input.now };
    try {
      await this.client.send(new TransactWriteCommand({ TransactItems: [
        this.generationCheck(input.generation),
        { Update: { TableName: this.tableName, Key: { PK: `TASK#${input.taskId}`, SK: "META" }, UpdateExpression: "SET assigneeId = :replacement, updatedAt = :now", ConditionExpression: "assigneeId = :worker AND #status = :assigned AND demoGeneration = :generation", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":replacement": replacement.workerId, ":now": input.now, ":worker": input.workerId, ":assigned": "ASSIGNED", ":generation": input.generation } } },
        { Update: { TableName: this.tableName, Key: { PK: `WORKER#${input.workerId}`, SK: "PROFILE" }, ...(input.preserveIntervention ? { UpdateExpression: "SET activeTaskIds = :remaining, updatedAt = :now", ConditionExpression: "demoGeneration = :generation AND activeInterventionId = :interventionId", ExpressionAttributeValues: { ":remaining": remainingTaskIds, ":now": input.now, ":generation": input.generation, ":interventionId": input.interventionId } } : { UpdateExpression: "SET #state = :resting, GSI1SK = :gsi, activeTaskIds = :remaining, updatedAt = :now REMOVE activeInterventionId", ConditionExpression: "demoGeneration = :generation AND activeInterventionId = :interventionId", ExpressionAttributeNames: { "#state": "state" }, ExpressionAttributeValues: { ":resting": "RESTING", ":gsi": `STATE#RESTING#WORKER#${input.workerId}`, ":remaining": remainingTaskIds, ":now": input.now, ":generation": input.generation, ":interventionId": input.interventionId } }) } },
        { Update: { TableName: this.tableName, Key: { PK: `WORKER#${replacement.workerId}`, SK: "PROFILE" }, UpdateExpression: "SET activeTaskIds = list_append(if_not_exists(activeTaskIds, :empty), :task), updatedAt = :now", ConditionExpression: "#state = :safe AND demoGeneration = :generation", ExpressionAttributeNames: { "#state": "state" }, ExpressionAttributeValues: { ":empty": [], ":task": [input.taskId], ":now": input.now, ":safe": "SAFE", ":generation": input.generation } } },
        { Update: { TableName: this.tableName, Key: { PK: `INTERVENTION#${input.interventionId}`, SK: "META" }, ...(input.preserveIntervention ? { UpdateExpression: "SET replacementWorkerId = :replacement, updatedAt = :now", ConditionExpression: "demoGeneration = :generation", ExpressionAttributeValues: { ":replacement": replacement.workerId, ":now": input.now, ":generation": input.generation } } : { UpdateExpression: "SET #status = :resting, replacementWorkerId = :replacement, updatedAt = :now", ConditionExpression: "demoGeneration = :generation", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":resting": "RESTING", ":replacement": replacement.workerId, ":now": input.now, ":generation": input.generation } }) } },
        { Put: { TableName: this.tableName, Item: auditItem(audit), ConditionExpression: "attribute_not_exists(PK)" } },
      ] }));
    } catch (error) {
      if (isConditionalFailure(error)) throw new ConflictError("TASK_OWNERSHIP_CHANGED", "Task is no longer assigned to the expected worker.");
      throw error;
    }
    return { status: "REASSIGNED", replacementWorkerId: replacement.workerId };
  }

  public async escalate(input: Parameters<Repository["escalate"]>[0]): Promise<void> {
    const intervention = await this.getIntervention(input.interventionId);
    if (!intervention) throw new NotFoundError("Intervention not found.");
    await this.client.send(new TransactWriteCommand({ TransactItems: [
      this.generationCheck(input.generation),
      { Update: { TableName: this.tableName, Key: { PK: `INTERVENTION#${input.interventionId}`, SK: "META" }, UpdateExpression: "SET #status = :status, escalationReason = :reason, updatedAt = :now", ConditionExpression: "demoGeneration = :generation", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":status": "AWAITING_SUPERVISOR", ":reason": input.reason, ":now": input.now, ":generation": input.generation } } },
      { Update: { TableName: this.tableName, Key: { PK: `WORKER#${intervention.workerId}`, SK: "PROFILE" }, UpdateExpression: "SET #state = :state, GSI1SK = :gsi, updatedAt = :now", ConditionExpression: "demoGeneration = :generation", ExpressionAttributeNames: { "#state": "state" }, ExpressionAttributeValues: { ":state": "AWAITING_SUPERVISOR", ":gsi": `STATE#AWAITING_SUPERVISOR#WORKER#${intervention.workerId}`, ":now": input.now, ":generation": input.generation } } },
      { Put: { TableName: this.tableName, Item: auditItem(input.audit), ConditionExpression: "attribute_not_exists(PK)" } },
    ] }));
  }

  public async complete(input: Parameters<Repository["complete"]>[0]): Promise<void> {
    const intervention = await this.getIntervention(input.interventionId);
    if (!intervention) throw new NotFoundError("Intervention not found.");
    if (intervention.demoGeneration !== input.generation) throw new StaleGenerationError();

    const worker = await this.getWorker(intervention.workerId);
    if (!worker) throw new NotFoundError("Worker not found.");
    if (worker.demoGeneration !== input.generation) throw new StaleGenerationError();

    const workerOperation = worker.activeInterventionId === input.interventionId
      ? {
          Update: {
            TableName: this.tableName,
            Key: { PK: `WORKER#${intervention.workerId}`, SK: "PROFILE" },
            UpdateExpression: "SET updatedAt = :now REMOVE activeInterventionId",
            ConditionExpression: "demoGeneration = :generation AND activeInterventionId = :interventionId",
            ExpressionAttributeValues: {
              ":generation": input.generation,
              ":interventionId": input.interventionId,
              ":now": input.now,
            },
          },
        }
      : {
          ConditionCheck: {
            TableName: this.tableName,
            Key: { PK: `WORKER#${intervention.workerId}`, SK: "PROFILE" },
            ConditionExpression: worker.activeInterventionId
              ? "demoGeneration = :generation AND activeInterventionId = :observed"
              : "demoGeneration = :generation AND attribute_not_exists(activeInterventionId)",
            ExpressionAttributeValues: {
              ":generation": input.generation,
              ...(worker.activeInterventionId
                ? { ":observed": worker.activeInterventionId }
                : {}),
            },
          },
        };

    await this.client.send(new TransactWriteCommand({
      TransactItems: [
        this.generationCheck(input.generation),
        {
          Update: {
            TableName: this.tableName,
            Key: { PK: `INTERVENTION#${input.interventionId}`, SK: "META" },
            UpdateExpression: "SET #status = :status, updatedAt = :now, completedAt = :now",
            ConditionExpression: "demoGeneration = :generation AND attribute_not_exists(completedAt)",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: {
              ":status": input.status,
              ":now": input.now,
              ":generation": input.generation,
            },
          },
        },
        workerOperation,
        {
          Put: {
            TableName: this.tableName,
            Item: auditItem(input.audit),
            ConditionExpression: "attribute_not_exists(PK)",
          },
        },
      ],
    }));
  }

  public async resumeWorker(input: Parameters<Repository["resumeWorker"]>[0]): Promise<{ duplicate: boolean; resumedAt: string }> {
    await this.assertGeneration(input.generation);
    const requestKey = {
      PK: `RESUME#${input.workerId}`,
      SK: `REQUEST#${input.clientRequestId}`,
    };

    try {
      await this.client.send(new TransactWriteCommand({
        TransactItems: [
          this.generationCheck(input.generation),
          {
            Update: {
              TableName: this.tableName,
              Key: { PK: `WORKER#${input.workerId}`, SK: "PROFILE" },
              UpdateExpression: "SET #state = :safe, GSI1SK = :gsi, activeMinutes = :zero, updatedAt = :now",
              ConditionExpression: "demoGeneration = :generation AND #state = :from AND attribute_not_exists(activeInterventionId)",
              ExpressionAttributeNames: { "#state": "state" },
              ExpressionAttributeValues: {
                ":safe": "SAFE",
                ":from": input.fromState,
                ":gsi": `STATE#SAFE#WORKER#${input.workerId}`,
                ":zero": 0,
                ":now": input.now,
                ":generation": input.generation,
              },
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: auditItem(input.audit),
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Put: {
              TableName: this.tableName,
              Item: {
                ...requestKey,
                entityType: "RESUME_REQUEST",
                workerId: input.workerId,
                interventionId: input.interventionId,
                clientRequestId: input.clientRequestId,
                demoGeneration: input.generation,
                resumedAt: input.now,
                expiresAt: Math.floor(new Date(input.now).getTime() / 1000) + 86400,
              },
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      }));
      return { duplicate: false, resumedAt: input.now };
    } catch (error) {
      if (!isConditionalFailure(error)) throw error;
      const previous = await this.client.send(new GetCommand({
        TableName: this.tableName,
        Key: requestKey,
        ConsistentRead: true,
      }));
      if (
        previous.Item?.["demoGeneration"] === input.generation
        && previous.Item?.["interventionId"] === input.interventionId
      ) {
        return { duplicate: true, resumedAt: String(previous.Item?.["resumedAt"] ?? input.now) };
      }
      throw new ConflictError(
        "WORKER_NOT_RESTING",
        "This rider is not currently eligible to resume work."
      );
    }
  }

  private async queryHub<T>(hubId: string, prefix: string): Promise<T[]> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: GSI_NAME,
      KeyConditionExpression: "GSI1PK = :hub AND begins_with(GSI1SK, :prefix)",
      ExpressionAttributeValues: { ":hub": `HUB#${hubId}`, ":prefix": prefix },
    }));
    return (result.Items ?? []).map((item) => withoutKeys<T>(item)!);
  }

  private generationCheck(generation: number) {
    return {
      ConditionCheck: {
        TableName: this.tableName,
        Key: { PK: "CONFIG#DEMO", SK: "GENERATION" },
        ConditionExpression: "#value = :generation",
        ExpressionAttributeNames: { "#value": "value" },
        ExpressionAttributeValues: { ":generation": generation },
      },
    };
  }

  private async assertGeneration(generation: number): Promise<void> {
    if (await this.getDemoGeneration() !== generation) throw new StaleGenerationError();
  }

  private async batchWrite(requests: Array<{ PutRequest?: { Item: DbItem }; DeleteRequest?: { Key: DbItem } }>): Promise<void> {
    let pending = requests;
    for (let attempt = 0; attempt < 5 && pending.length > 0; attempt += 1) {
      const result = await this.client.send(new BatchWriteCommand({ RequestItems: { [this.tableName]: pending } }));
      pending = (result.UnprocessedItems?.[this.tableName] ?? []) as typeof pending;
    }
    if (pending.length > 0) throw new Error(`DynamoDB left ${pending.length} reset writes unprocessed`);
  }
}
