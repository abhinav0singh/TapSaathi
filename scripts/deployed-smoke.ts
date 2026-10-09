import { randomUUID } from "node:crypto";
import {
  CloudFormationClient,
  DescribeStacksCommand
} from "@aws-sdk/client-cloudformation";
import {
  SFNClient,
  ListExecutionsCommand,
  DescribeExecutionCommand
} from "@aws-sdk/client-sfn";
import { fromIni } from "@aws-sdk/credential-providers";

const apiUrl: string = (() => {
  const value = process.env["API_URL"];
  if (!value) {
    throw new Error("API_URL must be the real ApiUrl CDK output.");
  }
  return value;
})();
const operatorAccessToken: string = (() => {
  const value = process.env["OPERATOR_ACCESS_TOKEN"];
  if (!value) {
    throw new Error("OPERATOR_ACCESS_TOKEN must contain a current Cognito access token.");
  }
  return value;
})();
const workerAccessToken: string = (() => {
  const value = process.env["WORKER_ACCESS_TOKEN"];
  if (!value) {
    throw new Error("WORKER_ACCESS_TOKEN must contain Ravi's current Cognito access token.");
  }
  return value;
})();
const stackName = process.env["STACK_NAME"] ?? "TaapSaathiStack";
const profile = process.env["AWS_PROFILE"];
const region = process.env["AWS_REGION"] ?? "ap-south-1";

const startedAt = Date.now();

const clientConfig = {
  region,
  ...(profile ? { credentials: fromIni({ profile }) } : {})
};

const cloudFormation = new CloudFormationClient(clientConfig);
const stepFunctions = new SFNClient(clientConfig);

async function request(path: string, init?: RequestInit, accessToken?: string) {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${JSON.stringify(body)}`);
  return { status: response.status, body };
}

const reset = await request("/demo/reset", { method: "POST", body: "{}" }, operatorAccessToken);
const spike = await request("/demo/heat-spike", { method: "POST", body: "{}" }, operatorAccessToken);
const eventId = String(spike.body["eventId"]);
let interventionId = "";
for (let attempt = 0; attempt < 30; attempt += 1) {
  const dashboard = await request("/dashboard");
  const interventions = dashboard.body["activeInterventions"] as Array<{ interventionId: string; eventId: string; status: string }>;
  const found = interventions.find((item) => item.eventId === eventId);
  if (found?.status === "AWAITING_WORKER") { interventionId = found.interventionId; break; }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!interventionId) throw new Error("Workflow did not reach AWAITING_WORKER in 30 seconds.");
await request(
  `/interventions/${interventionId}/respond`,
  { method: "POST", body: JSON.stringify({ actorId: "ravi-001", actorType: "WORKER", action: "TAKE_BREAK", language: "hi", clientRequestId: randomUUID() }) },
  workerAccessToken
);
let complete = false;
for (let attempt = 0; attempt < 30; attempt += 1) {
  const dashboard = await request("/dashboard");
  const workers = dashboard.body["workers"] as Array<{ workerId: string; state: string }>;
  const tasks = dashboard.body["tasks"] as Array<{ taskId: string; assigneeId: string }>;
  if (workers.find((item) => item.workerId === "ravi-001")?.state === "RESTING" && tasks.find((item) => item.taskId === "delivery-001")?.assigneeId === "asha-001") { complete = true; break; }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!complete) throw new Error("Golden path did not produce the required reassignment.");

const stack = await cloudFormation.send(new DescribeStacksCommand({ StackName: stackName }));
const stateMachineArn = stack.Stacks?.[0]?.Outputs?.find((item) => item.OutputKey === "StateMachineArn")?.OutputValue;
if (!stateMachineArn) throw new Error("StateMachineArn is missing from real stack outputs.");
const listed = await stepFunctions.send(new ListExecutionsCommand({ stateMachineArn, maxResults: 20 }));
const execution = listed.executions?.find((item) => item.startDate !== undefined && item.startDate.getTime() >= startedAt - 5000);
if (!execution) throw new Error("Could not match the smoke run to a real Step Functions execution.");
let finalStatus = "RUNNING";
for (let attempt = 0; attempt < 30; attempt += 1) {
  const description = await stepFunctions.send(new DescribeExecutionCommand({ executionArn: execution.executionArn }));
  finalStatus = description.status ?? "UNKNOWN";
  if (finalStatus !== "RUNNING") break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (finalStatus !== "SUCCEEDED") throw new Error(`Execution ${execution.executionArn} ended with ${finalStatus}`);
console.info(JSON.stringify({ passed: true, reset: reset.body, spike: spike.body, interventionId, executionArn: execution.executionArn, executionStatus: finalStatus }, null, 2));
