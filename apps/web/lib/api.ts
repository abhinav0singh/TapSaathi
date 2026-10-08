import {
  DashboardResponseSchema,
  HealthResponseSchema,
  DemoHeatSpikeResponseSchema,
  DemoResetResponseSchema,
} from "@taapsaathi/contracts";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://fkysuwgzb8.execute-api.ap-south-1.amazonaws.com";

async function apiRequest<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  init?: RequestInit
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...init?.headers,
      },
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
};
