import { describe, expect, it } from "vitest";
import type { Worker } from "@taapsaathi/contracts";
import { selectReplacementWorker } from "../../shared/src/reassignment.js";

const base = (workerId: string, activeMinutes: number, tasks: string[] = []): Worker => ({
  workerId,
  hubId: "hub-delhi-001",
  name: workerId,
  language: "en",
  state: "SAFE",
  activeMinutes,
  activeTaskIds: tasks,
  position: [77.2, 28.6],
  shiftId: `shift-${workerId}`,
  shiftActive: true,
  demoGeneration: 1,
  updatedAt: "2026-10-08T10:00:00.000Z",
});

describe("replacement selection", () => {
  it("TA-001 selects Asha and excludes caution workers", () => {
    expect(selectReplacementWorker([
      base("ravi-001", 75, ["delivery-001"]),
      base("asha-001", 20),
      { ...base("imran-001", 10), state: "CAUTION" },
    ], "ravi-001")?.workerId).toBe("asha-001");
  });

  it("TA-002 excludes a worker with an active intervention", () => {
    expect(selectReplacementWorker([
      { ...base("asha-001", 10), activeInterventionId: "int-urgent" },
      base("zoya-001", 20),
    ], "ravi-001")?.workerId).toBe("zoya-001");
  });

  it("TA-003 uses stable workerId tie-breaking", () => {
    expect(selectReplacementWorker([base("zoya-001", 20), base("asha-001", 20)], "ravi-001")?.workerId).toBe("asha-001");
  });

  it("TA-005 returns no worker when every candidate is ineligible", () => {
    expect(selectReplacementWorker([
      { ...base("asha-001", 10), activeTaskIds: ["delivery-002"] },
      { ...base("imran-001", 20), state: "CAUTION" },
    ], "ravi-001")).toBeUndefined();
  });
});
