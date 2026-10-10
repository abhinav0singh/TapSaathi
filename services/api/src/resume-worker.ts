import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  ResumeWorkerAcceptedSchema,
  ResumeWorkerRequestSchema,
} from "@taapsaathi/contracts";
import {
  AppError,
  ConflictError,
  createAudit,
  DynamoRepository,
  errorResponse,
  json,
  loadEnvironment,
  loadRuntimeIdentityMapping,
  NotFoundError,
  parseJson,
  requestContext,
  requireActor,
} from "@taapsaathi/shared";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const context = requestContext(event);
  try {
    const workerId = event.pathParameters?.["workerId"];
    if (!workerId) throw new NotFoundError("Worker not found.");
    const body = parseJson(event, ResumeWorkerRequestSchema);

    requireActor(
      event,
      await loadRuntimeIdentityMapping(),
      "WORKER",
      body.actorId
    );
    if (workerId !== body.actorId) {
      throw new AppError(
        "ACTOR_MISMATCH",
        "A rider can only resume their own work status.",
        403
      );
    }

    const repository = new DynamoRepository(loadEnvironment().TABLE_NAME);
    const worker = await repository.getWorker(workerId);
    if (!worker) throw new NotFoundError("Worker not found.");
    // A rider can resume after a completed break, or after a supervisor
    // acknowledged their symptom report and the rider confirms they feel fit.
    const afterSymptom = worker.state === "AWAITING_SUPERVISOR";
    if (afterSymptom && body.selfDeclaredFit !== true) {
      throw new AppError(
        "FITNESS_CONFIRMATION_REQUIRED",
        "Confirm that you feel well enough before resuming work.",
        400
      );
    }
    const requiredStatus = afterSymptom ? "SUPERVISOR_RESPONDING" : "COMPLETED";
    const intervention = (await repository.listInterventions(worker.hubId))
      .filter((item) =>
        item.workerId === workerId
        && item.demoGeneration === worker.demoGeneration
        && item.status === requiredStatus
        && Boolean(item.replacementWorkerId)
      )
      .sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt))[0];
    if (!intervention) {
      throw new ConflictError(
        "COMPLETED_BREAK_NOT_FOUND",
        "No completed break or acknowledged supervisor response could be verified."
      );
    }

    const resumedAt = new Date().toISOString();
    const result = await repository.resumeWorker({
      workerId,
      generation: worker.demoGeneration,
      interventionId: intervention.interventionId,
      clientRequestId: body.clientRequestId,
      fromState: afterSymptom ? "AWAITING_SUPERVISOR" : "RESTING",
      now: resumedAt,
      audit: createAudit({
        auditEventId: `audit-resume-${body.clientRequestId}`,
        interventionId: intervention.interventionId,
        eventType: "RIDER_RESUMED_WORK",
        actorId: workerId,
        actorType: "WORKER",
        correlationId: intervention.correlationId,
        workerId,
        hubId: worker.hubId,
        demoGeneration: worker.demoGeneration,
        details: {
          previousState: afterSymptom ? "AWAITING_SUPERVISOR" : "RESTING",
          newState: "SAFE",
          afterSymptomReport: afterSymptom,
          selfDeclaredFit: afterSymptom ? true : null,
          activeMinutesResetTo: 0,
          deliveryRemainsWith: intervention.replacementWorkerId,
          clientRequestId: body.clientRequestId,
        },
        occurredAt: resumedAt,
      }),
    });

    return json(200, ResumeWorkerAcceptedSchema.parse({
      workerId,
      status: "RESUMED",
      resumedAt: result.resumedAt,
      clientRequestId: body.clientRequestId,
    }), context.correlationId);
  } catch (error) {
    return errorResponse(error, context.requestId);
  }
};
