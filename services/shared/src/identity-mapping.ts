import { z } from "zod";
import { AppError } from "./errors.js";

const IdentitySchema = z.discriminatedUnion("role", [
  z.strictObject({
    role: z.literal("OPERATOR"),
  }),
  z.strictObject({
    role: z.literal("WORKER"),
    actorId: z.enum(["ravi-001", "asha-001", "imran-001"]),
  }),
  z.strictObject({
    role: z.literal("SUPERVISOR"),
    actorId: z.literal("supervisor-neha-001"),
  }),
]);

const CognitoSubjectSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  "Invalid Cognito subject identifier"
);

const MappingSchema = z.record(
  CognitoSubjectSchema,
  IdentitySchema
);

export type DemoIdentityMapping = z.infer<typeof MappingSchema>;

export function loadIdentityMapping(
  source: NodeJS.ProcessEnv = process.env
): DemoIdentityMapping {
  const raw = source["DEMO_IDENTITY_MAPPING"];

  if (!raw) {
    throw new AppError(
      "IDENTITY_MAPPING_UNAVAILABLE",
      "Demo identity configuration is unavailable.",
      500
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError(
      "IDENTITY_MAPPING_INVALID",
      "Demo identity configuration is invalid.",
      500
    );
  }

  const result = MappingSchema.safeParse(parsed);

  if (!result.success || Object.keys(result.data).length === 0) {
    throw new AppError(
      "IDENTITY_MAPPING_INVALID",
      "Demo identity configuration is invalid.",
      500
    );
  }

  return result.data;
}
