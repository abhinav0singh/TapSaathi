import { z } from "zod";
import {
  AuditEventSchema,
  DeliveryTaskSchema,
  InterventionSchema,
  IsoDateSchema,
  LanguageSchema,
  ResponseActionSchema,
  RouteViewSchema,
  WorkerSchema,
} from "./entities.js";

/** The intervention view safe to return from the public worker route. */
export const PublicInterventionSchema = InterventionSchema.omit({ audioKey: true });

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    requestId: z.string().min(1).optional(),
  }).strict(),
}).strict();

export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.literal("taapsaathi-api"),
  time: IsoDateSchema,
  dependencies: z.record(z.string(), z.enum(["ok", "error"])).optional(),
});

export const DashboardResponseSchema = z.object({
  hub: z.object({
    hubId: z.literal("hub-delhi-001"),
    name: z.string(),
    timeZone: z.literal("Asia/Kolkata"),
    simulated: z.literal(true),
  }),
  demoGeneration: z.number().int().nonnegative(),
  summary: z.object({
    safe: z.number().int().nonnegative(),
    caution: z.number().int().nonnegative(),
    intervention: z.number().int().nonnegative(),
    awaitingSupervisor: z.number().int().nonnegative(),
  }),
  workers: z.array(WorkerSchema),
  tasks: z.array(DeliveryTaskSchema),
  activeInterventions: z.array(InterventionSchema),
  recentEvents: z.array(AuditEventSchema),
  nextCursor: z.string().nullable(),
  updatedAt: IsoDateSchema,
});

export const WorkerViewResponseSchema = z.object({
  worker: WorkerSchema,
  instruction: z.string(),
  intervention: PublicInterventionSchema.optional(),
  route: RouteViewSchema.optional(),
  audioUrl: z.string().url().optional(),
  audioExpiresAt: IsoDateSchema.optional(),
  simulated: z.literal(true),
  updatedAt: IsoDateSchema,
});

/** A short-lived audio URL, returned only to the authenticated rider it concerns. */
export const WorkerAudioResponseSchema = z.object({
  audioUrl: z.string().url(),
  audioExpiresAt: IsoDateSchema,
});

export const EventsQuerySchema = z.object({
  after: z.string().max(2048).optional(),
}).strict();

export const EventsResponseSchema = z.object({
  events: z.array(AuditEventSchema),
  nextCursor: z.string().nullable(),
});

export const RespondRequestSchema = z.object({
  actorId: z.string().min(1),
  actorType: z.enum(["WORKER", "SUPERVISOR"]),
  action: ResponseActionSchema,
  language: LanguageSchema.optional(),
  clientRequestId: z.string().uuid(),
}).superRefine((value, context) => {
  if (value.actorType === "WORKER" && value.action === "SUPERVISOR_ACK") {
    context.addIssue({ code: "custom", message: "Worker cannot submit supervisor action", path: ["action"] });
  }
  if (value.actorType === "SUPERVISOR" && value.action !== "SUPERVISOR_ACK") {
    context.addIssue({ code: "custom", message: "Supervisor action must be SUPERVISOR_ACK", path: ["action"] });
  }
});

export const RespondAcceptedSchema = z.object({
  interventionId: z.string(),
  action: ResponseActionSchema,
  status: z.literal("ACCEPTED"),
  acceptedAt: IsoDateSchema,
  clientRequestId: z.string().uuid(),
});

export const ResumeWorkerRequestSchema = z.object({
  actorId: z.string().min(1),
  clientRequestId: z.string().uuid(),
  // Required when resuming after a reported symptom: the rider states they feel well enough.
  selfDeclaredFit: z.literal(true).optional(),
}).strict();

export const ResumeWorkerAcceptedSchema = z.object({
  workerId: z.string().min(1),
  status: z.literal("RESUMED"),
  resumedAt: IsoDateSchema,
  clientRequestId: z.string().uuid(),
});

export const DemoHeatSpikeRequestSchema = z.object({}).strict().optional();
export const DemoResetRequestSchema = z.object({}).strict().optional();
export const DemoHeatSpikeResponseSchema = z.object({
  eventId: z.string(),
  source: z.literal("DEMO_SIMULATOR"),
  correlationId: z.string(),
  demoGeneration: z.number().int().nonnegative(),
  acceptedAt: IsoDateSchema,
  simulated: z.literal(true),
});

export const DemoResetResponseSchema = z.object({
  status: z.literal("RESET_COMPLETE"),
  demoGeneration: z.number().int().positive(),
  counts: z.object({
    workers: z.literal(3),
    tasks: z.literal(1),
    restPoints: z.literal(3),
    activeInterventions: z.literal(0),
  }),
  resetAt: IsoDateSchema,
  simulated: z.literal(true),
});

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;
export type WorkerViewResponse = z.infer<typeof WorkerViewResponseSchema>;
export type RespondRequest = z.infer<typeof RespondRequestSchema>;
export type ResumeWorkerRequest = z.infer<typeof ResumeWorkerRequestSchema>;
