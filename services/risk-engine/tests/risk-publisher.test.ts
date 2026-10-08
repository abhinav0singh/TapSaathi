import { describe, expect, it, vi } from "vitest";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { evaluateAndPublishObservation } from "../../shared/src/risk-publisher.js";
import { MemoryRepository } from "../../shared/src/memory-repository.js";

describe("shared scheduled/demo risk entry point", () => {
  it("publishes a HIGH decision to the custom bus", async () => {
    const repository = new MemoryRepository();
    await repository.resetDemo("2026-10-08T10:00:00.000Z");
    const send = vi.fn().mockResolvedValue({ FailedEntryCount: 0 });
    const result = await evaluateAndPublishObservation({
      observation: {
        schemaVersion: 1,
        observationId: "window-01",
        source: "DEMO_SIMULATOR",
        hubId: "hub-delhi-001",
        temperatureC: 45.2,
        relativeHumidity: 42,
        apparentTemperatureC: 49.1,
        officialHeatAlert: true,
        observedAt: "2026-10-08T10:01:00.000Z",
      },
      repository,
      eventBridge: { send } as never,
      eventBusName: "taapsaathi-events",
      maxContinuousMinutes: 60,
      correlationId: "corr-001",
      now: "2026-10-08T10:01:00.000Z",
    });
    expect(result.events).toHaveLength(1);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(PutEventsCommand);
    expect((send.mock.calls[0]?.[0] as PutEventsCommand).input.Entries?.[0]).toMatchObject({
      Source: "taapsaathi.risk-engine",
      DetailType: "HeatRiskRaised",
      EventBusName: "taapsaathi-events",
    });
  });
});
