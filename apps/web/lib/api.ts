import {
  DashboardResponseSchema,
  HealthResponseSchema,
  DemoHeatSpikeResponseSchema,
  DemoResetResponseSchema,
  EventsResponseSchema,
  WorkerViewResponseSchema,
  WorkerAudioResponseSchema,
  RespondRequestSchema,
  RespondAcceptedSchema,
  ResumeWorkerAcceptedSchema,
  ResumeWorkerRequestSchema,
} from "@taapsaathi/contracts";

import type { AuditEvent, RespondRequest, ResumeWorkerRequest } from "@taapsaathi/contracts";
import { getAccessToken } from "@/lib/auth";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://fkysuwgzb8.execute-api.ap-south-1.amazonaws.com";

async function apiRequest<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  init?: RequestInit,
  authenticated = false,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");

    if (init?.method?.toUpperCase() === "POST" || authenticated) {
      const accessToken = await getAccessToken();
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers,
    });

    const body: unknown = await response.json();

    if (!response.ok) {
      const error =
        typeof body === "object" &&
        body !== null &&
        "error" in body
          ? (body as { error?: { message?: string } }).error?.message
          : undefined;

      throw new Error(error ?? `API request failed: ${response.status}`);
    }

    return schema.parse(body);
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  dashboard: () =>
    apiRequest("/dashboard", DashboardResponseSchema),

  health: () =>
    apiRequest("/health", HealthResponseSchema),

  heatSpike: () =>
    apiRequest("/demo/heat-spike", DemoHeatSpikeResponseSchema, {
      method: "POST",
      body: "{}",
    }),

  reset: () =>
    apiRequest("/demo/reset", DemoResetResponseSchema, {
      method: "POST",
      body: "{}",
    }),

  worker: (workerId: string) =>
    apiRequest(
      `/workers/${encodeURIComponent(workerId)}`,
      WorkerViewResponseSchema
    ),

  workerAudio: (workerId: string) =>
    apiRequest(
      `/workers/${encodeURIComponent(workerId)}/audio`,
      WorkerAudioResponseSchema,
      undefined,
      true,
    ),

  eventsPage: (after?: string) =>
    apiRequest(
      `/events${after ? `?after=${encodeURIComponent(after)}` : ""}`,
      EventsResponseSchema
    ),

  async allEvents(): Promise<AuditEvent[]> {
    const events: AuditEvent[] = [];
    let after: string | undefined;

    for (let page = 0; page < 20; page += 1) {
      const result = await this.eventsPage(after);
      events.push(...result.events);
      if (!result.nextCursor) return events;
      if (result.nextCursor === after) throw new Error("Audit history did not advance.");
      after = result.nextCursor;
    }

    throw new Error("Audit history is too long to verify safely.");
  },

  respond: (interventionId: string, request: RespondRequest) => {
    const validated = RespondRequestSchema.parse(request);

    return apiRequest(
      `/interventions/${encodeURIComponent(interventionId)}/respond`,
      RespondAcceptedSchema,
      {
        method: "POST",
        body: JSON.stringify(validated),
      }
    );
  },

  resumeWorker: (workerId: string, request: ResumeWorkerRequest) => {
    const validated = ResumeWorkerRequestSchema.parse(request);

    return apiRequest(
      `/workers/${encodeURIComponent(workerId)}/resume`,
      ResumeWorkerAcceptedSchema,
      {
        method: "POST",
        body: JSON.stringify(validated),
      }
    );
  },
};
