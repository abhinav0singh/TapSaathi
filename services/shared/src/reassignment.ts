import type { Worker } from "@taapsaathi/contracts";

export function selectReplacementWorker(
  workers: Worker[],
  excludedWorkerId: string,
  maxDemoWorkload = 1,
): Worker | undefined {
  return workers
    .filter((worker) =>
      worker.workerId !== excludedWorkerId
      && worker.shiftActive
      && worker.state === "SAFE"
      && !worker.activeInterventionId
      && worker.activeTaskIds.length < maxDemoWorkload,
    )
    .sort((left, right) =>
      left.activeTaskIds.length - right.activeTaskIds.length
      || left.activeMinutes - right.activeMinutes
      || left.workerId.localeCompare(right.workerId),
    )[0];
}
