import * as fs from "node:fs";
import * as path from "node:path";

const assemblyDirectory = path.resolve("cdk.out");
if (!fs.existsSync(assemblyDirectory)) {
  throw new Error("cdk.out is missing. Run npm run synth first.");
}
const templateFile = fs.readdirSync(assemblyDirectory).find((name) => name.endsWith(".template.json"));
if (!templateFile) throw new Error("No synthesized CloudFormation template found.");
const template = JSON.parse(fs.readFileSync(path.join(assemblyDirectory, templateFile), "utf8")) as {
  Resources: Record<string, { Type: string; Properties?: { DefinitionString?: unknown; StateMachineType?: string } }>;
};
const machine = Object.values(template.Resources).find((resource) => resource.Type === "AWS::StepFunctions::StateMachine");
if (!machine) throw new Error("State machine resource is missing.");
if (machine.Properties?.StateMachineType !== "STANDARD") throw new Error("State machine is not Standard.");
const encoded = JSON.stringify(machine.Properties.DefinitionString);
const requiredStates = [
  "AcquireIdempotencyLock",
  "LoadWorkerDeliveryPolicyHub",
  "CreateIntervention",
  "PrepareGuidanceWithLocationAndPolly",
  "AwaitWorkerResponse",
  "BranchOnWorkerResponse",
  "ReassignActiveDeliveryTransactionally",
  "MarkRiderResting",
  "EscalateSupervisor",
  "AwaitSupervisorAcknowledgement",
  "InterventionFinished",
];
for (const state of requiredStates) {
  if (!encoded.includes(state)) throw new Error(`State machine is missing ${state}`);
}
if (!encoded.includes("waitForTaskToken")) throw new Error("Worker callback is not using the task-token integration.");
console.info(JSON.stringify({ valid: true, type: "STANDARD", requiredStates }, null, 2));
