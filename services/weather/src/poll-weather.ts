import { randomUUID } from "node:crypto";
import type { Handler } from "aws-lambda";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { HeatObservationSchema } from "@taapsaathi/contracts";
import { DynamoRepository, evaluateAndPublishObservation, loadEnvironment, log } from "@taapsaathi/shared";

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
  };
}

async function observation(mode: string, hubId: string, now: string) {
  if (mode === "live") {
    const endpoint = process.env["WEATHER_ENDPOINT"] ?? "https://api.open-meteo.com/v1/forecast?latitude=28.6139&longitude=77.2090&current=temperature_2m,relative_humidity_2m,apparent_temperature&timezone=UTC";
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
    const data = await response.json() as OpenMeteoResponse;
    return HeatObservationSchema.parse({
      schemaVersion: 1,
      observationId: `live-${randomUUID()}`,
      source: "LIVE_WEATHER",
      hubId,
      temperatureC: data.current?.temperature_2m,
      relativeHumidity: data.current?.relative_humidity_2m,
      apparentTemperatureC: data.current?.apparent_temperature,
      officialHeatAlert: false,
      observedAt: now,
    });
  }
  return HeatObservationSchema.parse({
    schemaVersion: 1,
    observationId: `cached-${now.slice(0, 16)}`,
    source: "CACHED_WEATHER",
    hubId,
    temperatureC: 34,
    relativeHumidity: 38,
    apparentTemperatureC: 36,
    officialHeatAlert: false,
    observedAt: now,
  });
}

export const handler: Handler = async () => {
  const environment = loadEnvironment();
  if (!environment.EVENT_BUS_NAME) throw new Error("EVENT_BUS_NAME is required");
  const now = new Date().toISOString();
  try {
    const result = await evaluateAndPublishObservation({
      observation: await observation(process.env["WEATHER_MODE"] ?? "cached", environment.DEMO_HUB_ID, now),
      repository: new DynamoRepository(environment.TABLE_NAME),
      eventBridge: new EventBridgeClient({}),
      eventBusName: environment.EVENT_BUS_NAME,
      maxContinuousMinutes: environment.MAX_CONTINUOUS_MINUTES,
      correlationId: randomUUID(),
      now,
    });
    log("INFO", "WeatherPoll", { eventCount: result.events.length, source: process.env["WEATHER_MODE"] ?? "cached" });
    return { processed: true, eventCount: result.events.length };
  } catch (error) {
    log("ERROR", "WeatherPollFailed", { errorName: error instanceof Error ? error.name : "Unknown" });
    throw error;
  }
};
