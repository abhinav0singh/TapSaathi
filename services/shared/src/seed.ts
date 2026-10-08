import type { DeliveryTask, RestPoint, Worker } from "@taapsaathi/contracts";

export const DEMO_HUB_ID = "hub-delhi-001";

export interface SeedState {
  workers: Worker[];
  tasks: DeliveryTask[];
  restPoints: RestPoint[];
}

export function createSeedState(demoGeneration: number, now: string): SeedState {
  return {
    workers: [
      {
        workerId: "ravi-001",
        hubId: DEMO_HUB_ID,
        name: "Ravi",
        language: "hi",
        state: "SAFE",
        activeMinutes: 75,
        activeTaskIds: ["delivery-001"],
        position: [77.209, 28.6139],
        shiftId: "shift-demo-001",
        shiftActive: true,
        demoGeneration,
        updatedAt: now,
      },
      {
        workerId: "asha-001",
        hubId: DEMO_HUB_ID,
        name: "Asha",
        language: "en",
        state: "SAFE",
        activeMinutes: 20,
        activeTaskIds: [],
        position: [77.212, 28.616],
        shiftId: "shift-demo-002",
        shiftActive: true,
        demoGeneration,
        updatedAt: now,
      },
      {
        workerId: "imran-001",
        hubId: DEMO_HUB_ID,
        name: "Imran",
        language: "hi",
        state: "CAUTION",
        activeMinutes: 50,
        activeTaskIds: [],
        position: [77.205, 28.611],
        shiftId: "shift-demo-003",
        shiftActive: true,
        demoGeneration,
        updatedAt: now,
      },
    ],
    tasks: [{
      taskId: "delivery-001",
      hubId: DEMO_HUB_ID,
      assigneeId: "ravi-001",
      status: "ASSIGNED",
      demoGeneration,
      updatedAt: now,
    }],
    restPoints: [
      { restPointId: "rest-001", hubId: DEMO_HUB_ID, name: "Demonstration Water Point — Connaught Place", position: [77.2167, 28.6315], simulated: true, demoGeneration, updatedAt: now },
      { restPointId: "rest-002", hubId: DEMO_HUB_ID, name: "Demonstration Shade Point — Mandi House", position: [77.234, 28.6258], simulated: true, demoGeneration, updatedAt: now },
      { restPointId: "rest-003", hubId: DEMO_HUB_ID, name: "Demonstration Rest Point — India Gate", position: [77.2295, 28.6129], simulated: true, demoGeneration, updatedAt: now },
    ],
  };
}
