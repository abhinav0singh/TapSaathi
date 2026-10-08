import { describe, expect, it } from "vitest";
import type { Worker } from "@taapsaathi/contracts";
import { processObservation } from "../src/process-observation.js";

const now = "2026-10-08T10:00:00.000Z";
const worker: Worker = {
  workerId: "ravi-001",
  hubId: "hub-delhi-001",
  name: "Ravi",
  language: "hi",
  state: "SAFE",
  activeMinutes: 75,
  activeTaskIds: ["delivery-001"],
  position: [77.209, 28.6139],
  shiftId: "shift-demo-001",
  shiftActive: true,
  demoGeneration: 3,
  updatedAt: now,
};

describe("shared observation processor", () => {
  it("emits one versioned event for high risk", () => {
    const result = processObservation({
      schemaVersion: 1,
      observationId: "window-01",
      source: "DEMO_SIMULATOR",
      hubId: "hub-delhi-001",
      temperatureC: 45.2,
      relativeHumidity: 42,
      apparentTemperatureC: 49.1,
      officialHeatAlert: true,
      observedAt: now,
    }, {
      workers: [worker],
      demoGeneration: 3,
      maxContinuousMinutes: 60,
      correlationId: "corr-001",
      now,
      idFactory: () => "fixed",
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      eventId: "evt-fixed",
      demoGeneration: 3,
      payload: {
        workerId: "ravi-001",
        idempotencyKey: "shift-demo-001#ravi-001#g3#window-01",
      },
    });
  });

  it("does not emit an intervention event for safe conditions", () => {
    const result = processObservation({
      schemaVersion: 1,
      observationId: "baseline-01",
      source: "CACHED_WEATHER",
      hubId: "hub-delhi-001",
      temperatureC: 32,
      relativeHumidity: 35,
      apparentTemperatureC: 33,
      officialHeatAlert: false,
      observedAt: now,
    }, { workers: [worker], demoGeneration: 3, maxContinuousMinutes: 60, now });
    expect(result.events).toEqual([]);
  });
});
