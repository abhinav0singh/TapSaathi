/**
 * Recorded runs of the deployed TaapSaathi workflow, copied from the public
 * audit trail (GET /events) on 10 October 2026 and kept in docs/GOLDEN_PATH_EVIDENCE.md.
 * Nothing here is generated: each step is an audit event the AWS workflow wrote.
 * Worker states change only at steps where the dashboard showed a change; between
 * those steps the previous observed state is carried forward.
 */
export type WorkerState = "SAFE" | "CAUTION" | "HIGH" | "RESTING" | "AWAITING_SUPERVISOR";
export type Actor = "SYSTEM" | "WORKER" | "SUPERVISOR";

export interface RecordedStep {
  at: string;
  event: string;
  actor: Actor;
  service: string;
  plain: string;
  rider: string;
  workers: { ravi: WorkerState; asha: WorkerState; imran: WorkerState };
  deliveryOwner: "Ravi" | "Asha";
}

export interface RecordedRun {
  id: "take-break" | "feel-unwell";
  title: string;
  summary: string;
  recordedOn: string;
  generation: number;
  steps: RecordedStep[];
}

const ADVICE = {
  stop: "Stop work and go to the shown demonstration rest point.",
  rest: "Your break is active. Rest and hydrate.",
  notified: "A supervisor has been notified. Stay in a safe place.",
  acknowledged: "Your supervisor acknowledged the alert. Rest in a safe place. You can resume work once you feel well enough.",
  safe: "Continue your shift and take regular breaks.",
  preparing: "Preparing your safety guidance...",
} as const;

const opening = { ravi: "HIGH", asha: "SAFE", imran: "CAUTION" } as const;

export const recordedRuns: RecordedRun[] = [
  {
    id: "take-break",
    title: "Rider takes a break",
    summary: "A heat reading starts an intervention, the rider takes a break, and the delivery moves to another rider.",
    recordedOn: "10 Oct 2026, 16:22 UTC",
    generation: 17,
    steps: [
      {
        at: "16:22:11", event: "INTERVENTION_CREATED", actor: "SYSTEM", service: "EventBridge + Step Functions",
        plain: "Policy heat-policy-v2 matched HEAT_THRESHOLD_WITH_ACTIVE_EXPOSURE from 45.2 C air and 49.1 C apparent temperature. No official alert was set; the readings decided.",
        rider: ADVICE.preparing, workers: { ...opening }, deliveryOwner: "Ravi",
      },
      {
        at: "16:22:13", event: "GUIDANCE_PREPARED", actor: "SYSTEM", service: "Amazon Location + Polly",
        plain: "A scooter route of 3,741 m (804 s) to a simulated rest point was calculated, and spoken guidance was created.",
        rider: ADVICE.stop, workers: { ...opening }, deliveryOwner: "Ravi",
      },
      {
        at: "16:22:14", event: "WORKER_RESPONSE_REQUESTED", actor: "SYSTEM", service: "Step Functions callback",
        plain: "The workflow pauses and waits up to 120 seconds for the rider to answer.",
        rider: ADVICE.stop, workers: { ...opening }, deliveryOwner: "Ravi",
      },
      {
        at: "16:23:12", event: "RESPONSE_ACCEPTED", actor: "WORKER", service: "API Gateway + Cognito",
        plain: "Ravi taps Take a break. The API checks the signed-in identity before accepting the response.",
        rider: ADVICE.stop, workers: { ...opening }, deliveryOwner: "Ravi",
      },
      {
        at: "16:23:13", event: "DELIVERY_REASSIGNED", actor: "SYSTEM", service: "DynamoDB transaction",
        plain: "delivery-001 moves from Ravi to Asha in one transaction, so the order is not lost.",
        rider: ADVICE.rest, workers: { ravi: "RESTING", asha: "SAFE", imran: "CAUTION" }, deliveryOwner: "Asha",
      },
      {
        at: "16:23:14", event: "INTERVENTION_COMPLETED", actor: "SYSTEM", service: "Step Functions",
        plain: "The workflow finishes with status COMPLETED. Ravi is resting and no intervention is left active.",
        rider: ADVICE.rest, workers: { ravi: "RESTING", asha: "SAFE", imran: "CAUTION" }, deliveryOwner: "Asha",
      },
    ],
  },
  {
    id: "feel-unwell",
    title: "Rider feels unwell",
    summary: "The rider reports symptoms, the delivery is secured, a supervisor acknowledges, and the rider resumes after confirming they feel well enough.",
    recordedOn: "10 Oct 2026, 16:40 UTC",
    generation: 20,
    steps: [
      {
        at: "16:40:35", event: "INTERVENTION_CREATED", actor: "SYSTEM", service: "EventBridge + Step Functions",
        plain: "Policy heat-policy-v2 matched HEAT_THRESHOLD_WITH_ACTIVE_EXPOSURE from the heat readings.",
        rider: ADVICE.preparing, workers: { ...opening }, deliveryOwner: "Ravi",
      },
      {
        at: "16:40:36", event: "GUIDANCE_PREPARED", actor: "SYSTEM", service: "Amazon Location + Polly",
        plain: "Route guidance and spoken instructions were prepared.",
        rider: ADVICE.stop, workers: { ...opening }, deliveryOwner: "Ravi",
      },
      {
        at: "16:40:45", event: "RESPONSE_ACCEPTED", actor: "WORKER", service: "API Gateway + Cognito",
        plain: "Ravi taps I feel unwell. This is a rider report, not a diagnosis.",
        rider: ADVICE.stop, workers: { ...opening }, deliveryOwner: "Ravi",
      },
      {
        at: "16:40:46", event: "DELIVERY_REASSIGNED", actor: "SYSTEM", service: "DynamoDB transaction",
        plain: "The delivery is secured with Asha before anyone is escalated to.",
        rider: ADVICE.stop, workers: { ...opening }, deliveryOwner: "Asha",
      },
      {
        at: "16:40:47", event: "SUPERVISOR_ESCALATED", actor: "SYSTEM", service: "Step Functions",
        plain: "A supervisor is asked to respond. TaapSaathi does not contact emergency services.",
        rider: ADVICE.notified, workers: { ravi: "AWAITING_SUPERVISOR", asha: "SAFE", imran: "CAUTION" }, deliveryOwner: "Asha",
      },
      {
        at: "16:41:12", event: "RESPONSE_ACCEPTED", actor: "SUPERVISOR", service: "API Gateway + Cognito",
        plain: "Neha acknowledges the escalation. This means a human took responsibility for follow-up; it is not a medical clearance.",
        rider: ADVICE.notified, workers: { ravi: "AWAITING_SUPERVISOR", asha: "SAFE", imran: "CAUTION" }, deliveryOwner: "Asha",
      },
      {
        at: "16:41:13", event: "INTERVENTION_COMPLETED", actor: "SYSTEM", service: "Step Functions",
        plain: "The workflow completes with status SUPERVISOR_RESPONDING.",
        rider: ADVICE.acknowledged, workers: { ravi: "AWAITING_SUPERVISOR", asha: "SAFE", imran: "CAUTION" }, deliveryOwner: "Asha",
      },
      {
        at: "16:41:22", event: "RIDER_RESUMED_WORK", actor: "WORKER", service: "API Gateway + DynamoDB",
        plain: "Ravi ticks that he feels well enough and resumes. The audit record notes the report and the self-declaration. The delivery stays with Asha.",
        rider: ADVICE.safe, workers: { ravi: "SAFE", asha: "SAFE", imran: "CAUTION" }, deliveryOwner: "Asha",
      },
    ],
  },
];
