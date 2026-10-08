import type { CloudFormationCustomResourceEvent } from "aws-lambda";
import { DynamoRepository, loadEnvironment } from "@taapsaathi/shared";

export async function handler(event: CloudFormationCustomResourceEvent) {
  if (event.RequestType === "Delete") {
    return { PhysicalResourceId: "taapsaathi-demo-seed", Data: { retained: true } };
  }
  const now = new Date().toISOString();
  const result = await new DynamoRepository(loadEnvironment().TABLE_NAME).resetDemo(now);
  return {
    PhysicalResourceId: "taapsaathi-demo-seed",
    Data: { demoGeneration: result.generation, seededAt: now },
  };
}
