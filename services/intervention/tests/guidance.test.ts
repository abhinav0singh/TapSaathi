import { describe, expect, it } from "vitest";
import type { RouteView } from "@taapsaathi/contracts";
import { selectShortestSuccessfulRoute } from "../src/guidance.js";

const route = (restPointId: string, durationSeconds: number): RouteView => ({
  provider: "AMAZON_LOCATION",
  available: true,
  distanceMeters: durationSeconds * 10,
  durationSeconds,
  restPointId,
  restPointName: restPointId,
  geometry: { type: "LineString", coordinates: [[77.2, 28.6], [77.21, 28.61]] },
  generatedAt: "2026-10-08T10:00:00.000Z",
});

describe("guidance route selection", () => {
  it("GD-002 selects the shortest successful duration", () => {
    expect(selectShortestSuccessfulRoute([route("slow", 300), route("fast", 120), route("medium", 180)])?.restPointId).toBe("fast");
  });
});
