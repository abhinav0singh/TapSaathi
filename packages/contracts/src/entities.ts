import { z } from "zod";

export const IsoDateSchema = z.string().datetime({ offset: true });
export const LanguageSchema = z.enum(["en", "hi"]);
export const RiskStateSchema = z.enum([
  "SAFE",
  "CAUTION",
  "HIGH",
  "CRITICAL",
  "RESTING",
  "AWAITING_SUPERVISOR",
]);
export const WorkerActionSchema = z.enum(["TAKE_BREAK", "FEEL_UNWELL"]);
export const SupervisorActionSchema = z.literal("SUPERVISOR_ACK");
export const ResponseActionSchema = z.union([WorkerActionSchema, SupervisorActionSchema]);

export const PositionSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

export const LineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(PositionSchema).min(2),
});

export const RouteViewSchema = z.object({
  provider: z.enum(["AMAZON_LOCATION", "STRAIGHT_LINE_FALLBACK"]),
  available: z.boolean(),
  distanceMeters: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative().nullable(),
  restPointId: z.string().min(1),
  restPointName: z.string().min(1),
  geometry: LineStringSchema,
  generatedAt: IsoDateSchema,
});

export const WorkerSchema = z.object({
  workerId: z.string().min(1),
  hubId: z.string().min(1),
  name: z.string().min(1),
  language: LanguageSchema,
  state: RiskStateSchema,
  activeMinutes: z.number().int().nonnegative(),
  activeTaskIds: z.array(z.string()),
  activeInterventionId: z.string().optional(),
  position: PositionSchema,
  shiftId: z.string().min(1),
  shiftActive: z.boolean(),
  demoGeneration: z.number().int().nonnegative(),
  updatedAt: IsoDateSchema,
});

export const DeliveryTaskSchema = z.object({
  taskId: z.string().min(1),
  hubId: z.string().min(1),
  assigneeId: z.string().nullable(),
  status: z.enum(["ASSIGNED", "REASSIGNMENT_REQUIRED", "COMPLETED"]),
  demoGeneration: z.number().int().nonnegative(),
  updatedAt: IsoDateSchema,
});

export const RestPointSchema = z.object({
  restPointId: z.string().min(1),
  hubId: z.string().min(1),
  name: z.string().min(1),
  position: PositionSchema,
  simulated: z.literal(true),
  demoGeneration: z.number().int().nonnegative(),
  updatedAt: IsoDateSchema,
});

export const InterventionStatusSchema = z.enum([
  "CREATED",
  "GUIDANCE_READY",
  "AWAITING_WORKER",
  "REASSIGNING",
  "RESTING",
  "AWAITING_SUPERVISOR",
  "SUPERVISOR_RESPONDING",
  "SUPERVISOR_UNACKNOWLEDGED",
  "REASSIGNMENT_REQUIRED",
  "COMPLETED",
  "FAILED",
  "DUPLICATE",
]);

export const InterventionSchema = z.object({
  interventionId: z.string().min(1),
  eventId: z.string().min(1),
  correlationId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  workerId: z.string().min(1),
  hubId: z.string().min(1),
  taskId: z.string().optional(),
  riskLevel: z.enum(["HIGH", "CRITICAL"]),
  matchedRule: z.string().min(1),
  status: InterventionStatusSchema,
  route: RouteViewSchema.optional(),
  audioKey: z.string().optional(),
  audioLanguage: LanguageSchema.optional(),
  guidanceFailure: z.enum(["GUIDANCE_ROUTE_FAILED", "GUIDANCE_AUDIO_FAILED"]).optional(),
  replacementWorkerId: z.string().optional(),
  escalationReason: z.enum(["FEEL_UNWELL", "WORKER_TIMEOUT", "NO_ELIGIBLE_WORKER"]).optional(),
  demoGeneration: z.number().int().nonnegative(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
  completedAt: IsoDateSchema.optional(),
});

export const AuditEventSchema = z.object({
  auditEventId: z.string().min(1),
  interventionId: z.string().min(1),
  eventType: z.string().min(1),
  actorId: z.string().optional(),
  actorType: z.enum(["SYSTEM", "WORKER", "SUPERVISOR"]).default("SYSTEM"),
  correlationId: z.string().min(1),
  workerId: z.string().min(1),
  hubId: z.string().min(1),
  demoGeneration: z.number().int().nonnegative(),
  details: z.record(z.string(), z.unknown()).default({}),
  occurredAt: IsoDateSchema,
});

export type Language = z.infer<typeof LanguageSchema>;
export type RiskState = z.infer<typeof RiskStateSchema>;
export type ResponseAction = z.infer<typeof ResponseActionSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type RouteView = z.infer<typeof RouteViewSchema>;
export type Worker = z.infer<typeof WorkerSchema>;
export type DeliveryTask = z.infer<typeof DeliveryTaskSchema>;
export type RestPoint = z.infer<typeof RestPointSchema>;
export type Intervention = z.infer<typeof InterventionSchema>;
export type InterventionStatus = z.infer<typeof InterventionStatusSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;
