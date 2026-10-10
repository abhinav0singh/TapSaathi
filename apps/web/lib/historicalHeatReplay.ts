import { evaluateHeatPolicy } from "@taapsaathi/contracts";

/** Fixed Open-Meteo archive reanalysis value; never a browser-side fetch or live reading. */
export const delhiHistoricalReplay = { requestedLocation: "Delhi, India (28.6139, 77.2090)", gridPoint: "28.576448, 77.186780", observedAt: "2024-05-29T13:00:00+05:30", retrievedAt: "2026-10-11", temperatureC: 45.6, apparentTemperatureC: 44.6, relativeHumidity: 12, sourceName: "Open-Meteo Historical Weather API", sourceUrl: "https://archive-api.open-meteo.com/v1/archive?latitude=28.6139&longitude=77.2090&start_date=2024-05-29&end_date=2024-05-29&hourly=temperature_2m,relative_humidity_2m,apparent_temperature&timezone=Asia%2FKolkata" } as const;
const replayInput = { officialHeatAlert: false, temperatureC: delhiHistoricalReplay.temperatureC, apparentTemperatureC: delhiHistoricalReplay.apparentTemperatureC, relativeHumidity: delhiHistoricalReplay.relativeHumidity, maxContinuousMinutes: 60, symptomReported: false, policyVersion: "heat-policy-v2", evaluatedAt: delhiHistoricalReplay.observedAt } as const;
export const delhiArchiveWeatherDecision = evaluateHeatPolicy({ ...replayInput, activeMinutes: 0 });
export const delhiHistoricalDecision = evaluateHeatPolicy({ ...replayInput, activeMinutes: 60 });
