import { describe, expect, it } from "vitest";
import { delhiArchiveWeatherDecision, delhiHistoricalDecision, delhiHistoricalReplay } from "./historicalHeatReplay";

describe("Delhi historical replay", () => {
  it("keeps the archive reading and exposure assumption explicit", () => {
    expect(delhiHistoricalReplay).toMatchObject({ temperatureC: 45.6, apparentTemperatureC: 44.6, relativeHumidity: 12, gridPoint: "28.576448, 77.186780" });
    expect(delhiArchiveWeatherDecision).toMatchObject({ state: "CAUTION", matchedRule: "HEAT_THRESHOLD", recommendedAction: "PREPARE_BREAK" });
    expect(delhiHistoricalDecision).toMatchObject({
      state: "HIGH",
      matchedRule: "HEAT_THRESHOLD_WITH_ACTIVE_EXPOSURE",
      recommendedAction: "TAKE_BREAK",
      policyVersion: "heat-policy-v2",
    });
  });
});
