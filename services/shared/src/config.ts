import { z } from "zod";

const EnvironmentSchema = z.object({
  TABLE_NAME: z.string().min(1),
  EVENT_BUS_NAME: z.string().min(1).optional(),
  STATE_MACHINE_ARN: z.string().min(1).optional(),
  AUDIO_BUCKET_NAME: z.string().min(1).optional(),
  MAX_CONTINUOUS_MINUTES: z.coerce.number().int().positive().default(60),
  WORKER_RESPONSE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(120),
  SUPERVISOR_RESPONSE_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(120),
  DEMO_HUB_ID: z.string().default("hub-delhi-001"),
  FRONTEND_ORIGINS: z.string().default("http://localhost:3000"),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  return EnvironmentSchema.parse(source);
}
