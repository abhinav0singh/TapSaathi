import type { Handler } from "aws-lambda";
import { DynamoRepository, loadEnvironment } from "@taapsaathi/shared";
import type { WorkflowState } from "./workflow-input.js";

export const handler: Handler<WorkflowState> = async (input) => {
  const repository = new DynamoRepository(loadEnvironment().TABLE_NAME);
  const [worker, tasks] = await Promise.all([
    repository.getWorker(input.envelope.payload.workerId),
    repository.getTasks(input.envelope.payload.hubId),
  ]);
  if (!worker) throw new Error("Worker not found for risk event");
  const task = tasks.find((candidate) => candidate.assigneeId === worker.workerId && candidate.status === "ASSIGNED");
  return {
    ...input,
    ...(task ? { taskId: task.taskId } : {}),
    workerLanguage: worker.language,
    workerPosition: worker.position,
  };
};
