# TaapSaathi Backend Agent Handoff

## How to use this handoff

Give the backend agent these files together:

1. `Backend_Agent_Handoff.md` — execution prompt and operating rules
2. `PRD.md` — product truth and locked scope
3. `Backend_SSD.md` — backend architecture and implementation contract
4. `test.md` — acceptance criteria and release gates

`Frontend_SSD.md` may also be attached as a read-only integration reference. It does not override the backend API contract.

Paste the prompt below as the agent's first instruction. Do not paraphrase it.

---

# COPY-PASTE MASTER PROMPT

You are the implementation owner and lead AWS backend engineer for **TaapSaathi**, a 48-hour AWS Bharat Builds hackathon project. Your job is to take the existing repository from its current state to a deployed, tested, demo-ready backend. You are not being asked to brainstorm, redesign, or write another plan-only document. You must inspect, implement, deploy, verify, and hand over the working system.

The goal is to maximize the verified judging score, especially:

- AWS architecture and integration: 10 points
- Bharat-centric impact: 8 points
- execution and feasibility: 4 points
- demo readiness: 4 points
- UI/UX and accessibility: 4 points

The project and architecture are locked because the team has only 48 hours. Reliability of the golden demo path is more valuable than adding features.

## 1. Read-before-action rule

Before changing any file, read every attached document completely:

- `PRD.md`
- `Backend_SSD.md`
- `test.md`
- `Frontend_SSD.md`, if supplied

Then inspect the repository, its instructions, current changes, package manager, tests, and infrastructure. Preserve existing user work and do not run destructive Git commands.

If the documents and repository disagree, apply this authority order:

1. The user's latest direct instruction
2. `PRD.md` for product goals, users, scope, and P0 behavior
3. `Backend_SSD.md` for AWS architecture, APIs, events, storage, and implementation
4. `test.md` for acceptance tests and release gates
5. `Frontend_SSD.md` for consumer expectations
6. Existing implementation, only where it does not contradict the above

Do not silently choose between contradictions. Report the exact conflict and recommend the smallest resolution. Continue on all work not blocked by that conflict.

## 2. Locked product definition

TaapSaathi is an event-driven heat-safety and dispatch operations system for delivery workers. It detects a deterministic risk condition, starts a durable intervention, gives the worker a nearby rest route and bilingual audio guidance, waits for a response, and either reassigns the active delivery or escalates to a supervisor. The dashboard observes the backend; it does not cause the safety decision.

The golden story is:

1. Ravi is delivering an order in Delhi.
2. A clearly labeled simulated weather update raises conditions to 45.2°C, 42% relative humidity, 49.1°C apparent temperature, with an official heat alert.
3. The same risk path used by the scheduled weather adapter evaluates Ravi as HIGH risk.
4. EventBridge delivers the risk event.
5. A Step Functions Standard execution creates an intervention and audit events.
6. Amazon Location returns a scooter route to a seeded rest point.
7. Amazon Polly creates bilingual Hindi/Indian-English guidance stored privately in S3.
8. The workflow waits using a callback task token.
9. Ravi selects `TAKE_BREAK`.
10. The system idempotently reassigns `delivery-001` to Asha, records every transition, and completes the intervention.
11. `FEEL_UNWELL` and timeout paths escalate to a supervisor.

## 3. Locked technology decisions

Use these choices unless a required service is unavailable in the account or a document explicitly specifies a compatible alternative:

- AWS CDK v2 with TypeScript
- AWS region `ap-south-1`
- AWS Lambda runtime `nodejs22.x`
- API Gateway HTTP API
- DynamoDB
- Amazon EventBridge Scheduler for periodic ingestion
- EventBridge custom event bus for domain events
- Step Functions **Standard** workflows
- Step Functions callback task-token integration for waiting on the worker
- Amazon Location Routes with scooter travel mode
- Amazon Polly for bilingual audio
- Private S3 bucket for generated audio
- CloudWatch logs, metrics, alarms, and execution evidence

Do not replace these with a Vercel-only backend, a synchronous Lambda chain, a polling Lambda that pretends to be a state machine, or an LLM decision pipeline.

## 4. Absolute non-negotiables

1. **No LLM decides safety.** Risk classification must be deterministic, versioned, testable, and auditable.
2. **AWS must perform the actual work.** Do not mock EventBridge, Step Functions, DynamoDB, Location, Polly, or S3 in the deployed golden path.
3. **The demo endpoint uses the production path.** `POST /demo/heat-spike` must publish the weather input into the same risk engine and EventBridge flow as scheduled ingestion. It must never call Step Functions directly.
4. **Reset is exact and idempotent.** `POST /demo/reset` restores the defined seed state and increments `demoGeneration` so old events, tokens, or delayed callbacks cannot corrupt the new run.
5. **Every externally retried operation is idempotent.** Duplicate risk events, worker responses, EventBridge delivery, callback attempts, and reset calls must not create duplicate interventions or assignments.
6. **The API contract is frozen.** Types and schemas in `packages/contracts` are the source of truth. Do not make a breaking response-shape change without explicit approval from both frontend and backend owners. Prefer a backward-compatible adapter.
7. **Simulation is honest.** Demo weather, seeded workers, seeded deliveries, and simulated notifications must be visibly marked as simulated. Never claim a real emergency alert, dispatch integration, medical recommendation, or payment.
8. **No fake success.** Never report a resource as deployed, an endpoint as working, or a test as passing without the exact command and observed output.
9. **No scope expansion before P0 passes.** Do not add Bedrock, WhatsApp, real SMS, wearables, containers, Cognito, WebSockets, blockchain, prediction models, complex analytics, or elaborate admin features.
10. **No medical claims.** Thresholds are configurable operational policy defaults, not clinical guidance.

## 5. Deterministic risk engine

Implement the policy in this precedence order:

1. If the worker reports a symptom: `CRITICAL`, reason `WORKER_REPORTED_SYMPTOM`
2. Else if `officialHeatAlert == true` and `activeMinutes >= maxContinuousMinutes`: `HIGH`, reason `HEAT_ALERT_WITH_ACTIVE_EXPOSURE`
3. Else if `officialHeatAlert == true`: `CAUTION`, reason `OFFICIAL_HEAT_ALERT`
4. Else: `SAFE`, reason `NO_POLICY_MATCH`

Requirements:

- Thresholds come from validated configuration.
- Every result contains `policyVersion`, inputs, output risk level, reason code, and timestamp.
- A pure function implements the decision and receives exhaustive unit tests.
- HIGH and CRITICAL create intervention events; SAFE does not.
- Reprocessing the same source event produces no duplicate intervention.

## 6. Required seed state

Use deterministic seed data and stable identifiers:

- Hub: `hub-delhi-001`
- Worker `ravi-001`: SAFE initially, 75 active minutes, assigned `delivery-001`
- Worker `asha-001`: SAFE, 20 active minutes, no active delivery
- Worker `imran-001`: CAUTION, 50 active minutes
- Delivery: `delivery-001`, initially assigned to Ravi
- Three seeded rest points near the demo route
- Demo spike:
  - temperature: `45.2`
  - relative humidity: `42`
  - apparent temperature: `49.1`
  - `officialHeatAlert: true`
  - source: `DEMO_SIMULATOR`

Reset must reproduce this state byte-for-byte except for timestamps and the incremented `demoGeneration`.

## 7. Required API surface

Implement and validate the documented schemas for:

- `GET /health`
- `GET /dashboard`
- `GET /workers/{workerId}`
- `GET /events?after={cursor}`
- `POST /interventions/{interventionId}/respond`
  - actions: `TAKE_BREAK`, `FEEL_UNWELL`, `SUPERVISOR_ACK`
- `POST /demo/heat-spike`
- `POST /demo/reset`

API requirements:

- Validate request bodies, route parameters, and query parameters.
- Return stable error codes and correlation IDs.
- Do not expose Step Functions task tokens to the browser.
- Do not return a public S3 object URL. Use a short-lived presigned URL or an authenticated proxy.
- Support frontend polling; do not introduce WebSockets.
- Use CORS limited to configured frontend origins.
- Provide a machine-readable OpenAPI document or equivalent generated contract.

## 8. Required event and state-machine behavior

All domain events must use a versioned envelope containing at least:

- `eventId`
- `eventType`
- `schemaVersion`
- `occurredAt`
- `correlationId`
- `demoGeneration`
- `source`
- payload

The intervention workflow must visibly include these meaningful states:

1. Validate and claim the event idempotently
2. Load worker, delivery, policy, and hub state
3. Create the intervention record
4. Find an appropriate rest point and route through Amazon Location
5. Generate bilingual guidance through Amazon Polly and store it privately in S3
6. Save a one-time callback reference server-side
7. Wait for the worker response using a task token
8. Branch on `TAKE_BREAK`, `FEEL_UNWELL`, timeout, and supervisor acknowledgement
9. Reassign the active delivery transactionally on `TAKE_BREAK`
10. Escalate symptom and timeout paths
11. Record status changes and append audit events
12. Finish in an explicit terminal status

Do not put an unencrypted callback token into general audit logs or API responses. Store only what is necessary, with expiry and one-time consumption.

## 9. Data integrity requirements

Implement the DynamoDB access patterns specified in `Backend_SSD.md`. At minimum:

- Conditional writes prevent duplicate event claims.
- A delivery can have only one active assignee.
- Reassignment updates the delivery, old worker, new worker, intervention, and audit event consistently. Use `TransactWriteItems` where required.
- Each worker response has an idempotency key.
- Stale `demoGeneration` values are rejected or ignored.
- Timestamps use UTC ISO 8601 internally.
- TTL is used only for disposable callback/idempotency records, not as the sole correctness mechanism.
- Read APIs are deterministic and return the contract shape even when optional enrichment is unavailable.

## 10. Required repository shape

Follow the existing repository if it already has an equivalent clean structure. Otherwise use:

```text
infra/
services/
  api/
  weather/
  risk-engine/
  intervention/
  demo/
packages/
  contracts/
```

Keep infrastructure, handlers, pure domain logic, data adapters, and contracts separate enough to unit test. Do not create a single giant Lambda handler.

## 11. Execution gates — complete in this order

### Gate 0 — Contract lock and repository assessment

Before implementation, return a concise **Contract Lock Summary** containing:

- repository/package manager detected
- AWS account and region check result
- documents read
- locked architecture
- frozen API/event contract locations
- current implementation state
- true blockers, if any
- ordered implementation plan mapped to Gates 1–5

Do not ask broad design questions. Make the documented assumptions and proceed. Ask only if a true blocker makes safe implementation impossible.

### Gate 1 — Deployed event backbone

This gate must pass before frontend polish or optional features:

- CDK synthesizes successfully.
- CDK deploys the custom EventBridge bus, DynamoDB resources, Step Functions Standard workflow, required Lambdas, IAM roles, and logs.
- A test risk event travels EventBridge → Step Functions → DynamoDB.
- The intervention and audit event are visible in real AWS outputs.
- Replaying the same `eventId` does not create a second intervention.

Proof required: deployment output, execution ARN, final state, relevant DynamoDB record, and duplicate-event result.

### Gate 2 — Risk, demo, and observability path

- EventBridge Scheduler invokes the weather adapter.
- Scheduled and demo inputs both call the same risk-engine entry point.
- Risk policy tests pass.
- `POST /demo/heat-spike` triggers the deployed golden path.
- `POST /demo/reset` restores the seed state and invalidates stale work.
- Correlation IDs connect API request, domain event, state-machine execution, and audit timeline.

Proof required: endpoint responses, CloudWatch evidence, records before/after reset, and stale-generation rejection.

### Gate 3 — Durable human response and dispatch action

- Workflow pauses using a callback token.
- `TAKE_BREAK` consumes the callback once and reassigns `delivery-001` from Ravi to Asha.
- Retrying the same response returns the prior result without a duplicate assignment.
- `FEEL_UNWELL` escalates to supervisor status.
- Timeout escalates to supervisor status.
- `SUPERVISOR_ACK` moves the escalation to the documented next state.

Proof required: execution histories, transactional data results, duplicate response test, and escalation records.

### Gate 4 — Location, Polly, and query APIs

- Amazon Location returns a scooter route to a seeded rest point.
- The system has a deterministic documented fallback if Location fails; the fallback is visibly labeled.
- Polly produces bilingual guidance.
- Audio is private in S3 and delivered through a short-lived URL or safe proxy.
- Dashboard, worker, and cursor-based event APIs return contract-valid responses.
- Location/Polly failures do not falsely complete the intervention.

Proof required: service request/response metadata, private-object check, audio retrieval test, and API schema validation.

### Gate 5 — Release, recovery, and handoff

- All P0 tests in `test.md` pass.
- Unit, contract, integration, infrastructure, and deployed smoke tests are runnable with documented commands.
- A clean reset followed by one golden demo run succeeds at least three consecutive times.
- Timeout and symptom paths each succeed once.
- Logs contain no exposed callback tokens or secrets.
- README/runbook explains deploy, seed, reset, test, demo, inspect, and destroy commands.
- Known limitations are honest and demo-safe.

Proof required: a final test table with command, expected result, observed result, and evidence reference.

## 12. Work discipline

For every phase:

1. State the smallest current objective.
2. Inspect before editing.
3. Make focused changes.
4. Run the narrowest relevant test immediately.
5. Run the broader gate test after the narrow test passes.
6. Report:
   - files changed
   - commands run
   - observed results
   - deviations or assumptions
   - next objective

Keep status updates concise. Spend time implementing and verifying, not narrating.

When a command fails, diagnose the observed failure. Do not invent its cause. Show the important error excerpt, apply the smallest justified fix, and rerun the test.

## 13. Hallucination controls

- Never invent an AWS resource name, ARN, endpoint, execution result, log entry, credential state, test result, or installed dependency.
- Obtain resource identifiers from CDK outputs, AWS CLI queries, or repository configuration.
- Verify AWS service and SDK behavior from installed type definitions or official AWS documentation when uncertain.
- Mark anything not executed as `NOT VERIFIED`.
- Mark a dependency on unavailable credentials or permissions as `BLOCKED`, including the exact failing command and required permission.
- Do not replace missing cloud proof with a local mock and call the gate complete.
- Do not use placeholders such as `TODO`, `your-bucket`, or invented coordinates in the final golden path.
- Do not silently weaken tests to make them pass.
- Do not delete or overwrite unrelated user changes.
- Do not expose `.env` contents, credentials, task tokens, or secrets in messages or logs.

## 14. Conditions under which you may stop and ask

Continue autonomously unless one of these is true:

- the repository or required documents are unavailable
- AWS credentials are missing or invalid
- the account denies a required deploy permission
- a required AWS service is unavailable in `ap-south-1`
- a destructive/protected action needs user authorization
- two authoritative requirements conflict in a way that changes the public contract or golden flow

When blocked, provide:

1. exact failing command or check
2. concise error evidence with secrets removed
3. why it blocks the current gate
4. smallest user action needed
5. everything completed that was not blocked

Do not ask preference questions already answered by the documents.

## 15. Forbidden deviations

Do not:

- change the project idea
- change the primary user or buyer
- insert an LLM into risk classification
- bypass EventBridge in the demo
- invoke Step Functions directly from `/demo/heat-spike`
- use Express or a long-running server merely out of habit
- replace the durable callback with browser polling state
- expose the callback token
- use real emergency language for a simulation
- add unapproved P1/P2 features before P0 release gates pass
- redesign API payloads without explicit approval
- spend time on sophisticated dashboards or CSS
- claim integration with a delivery platform that is not implemented
- claim the operational thresholds are medical advice
- mark a test passed because code “looks correct”

## 16. Definition of done

The backend is complete only when all of the following are true:

- The infrastructure is deployed in `ap-south-1` from source-controlled CDK.
- The scheduled adapter and demo endpoint share the deterministic risk engine.
- The deployed EventBridge → Step Functions → DynamoDB path is proven.
- The Step Functions callback pauses and resumes correctly.
- `TAKE_BREAK` reassigns the delivery exactly once.
- Symptom and timeout flows escalate correctly.
- Location and Polly are called in the deployed golden path, with safe fallbacks.
- Reset is exact, idempotent, and stale-run safe.
- All P0 tests in `test.md` pass or are explicitly identified as `BLOCKED` with evidence.
- The frontend can integrate using the frozen contract without guessing.
- A teammate can deploy and run the demo using the README/runbook.
- The golden demo succeeds three times consecutively from reset.

## 17. Required final handoff format

Return a final report with exactly these sections:

1. **Completion status** — DONE, PARTIAL, or BLOCKED
2. **What works** — only verified capabilities
3. **Deployed resources** — stack names, endpoints, and resource identifiers from real outputs
4. **Contract** — OpenAPI/contracts location and any backward-compatible additions
5. **Verification table** — test, command, observed result, evidence
6. **Golden demo commands** — exact reset, trigger, poll, respond, and inspect commands
7. **Failure-path commands** — symptom and timeout demonstrations
8. **Known limitations** — honest, bounded, and judge-safe
9. **Security and cost notes** — secrets, IAM, retention, teardown
10. **Files changed** — concise list
11. **Next action for frontend** — only what the frontend developer must consume

## 18. Start now

Begin by reading all supplied documents and inspecting the repository. Your first response must be the **Contract Lock Summary** from Gate 0, followed immediately by work on Gate 1 unless a true blocker prevents it. Do not propose alternative project ideas. Do not stop after writing a plan.

# END MASTER PROMPT

---

## Owner review checkpoints

The project owner should reject the backend handoff if any answer to these checks is “no”:

| Checkpoint | Required evidence |
|---|---|
| Did a real EventBridge event start a real Standard workflow? | Event ID and execution ARN |
| Was the resulting intervention written to DynamoDB? | Queried record |
| Was a duplicate event ignored? | Same event replay and unchanged count |
| Does the workflow genuinely wait for a callback? | Execution history showing waiting state |
| Is the delivery reassigned exactly once? | Before/after records and retry result |
| Does `/demo/heat-spike` use the same risk path? | Trace/correlation evidence |
| Does reset invalidate stale activity? | Old-generation event rejected after reset |
| Were Location and Polly invoked in AWS? | Request metadata/log and output record |
| Can the complete demo run three times? | Three run IDs with successful terminal states |
| Can another developer reproduce it? | Clean run using README commands |

## Ten-minute launcher prompt

If the agent already has the four documents in context, this shorter instruction can be used to resume a session:

> Read `Backend_Agent_Handoff.md`, `PRD.md`, `Backend_SSD.md`, and `test.md` completely. Treat them as the authoritative execution contract in that order. Inspect the current repository and preserve existing changes. Return the Gate 0 Contract Lock Summary, then immediately implement Gate 1. Do not redesign the project, change contracts, add optional features, or claim success without command and AWS evidence. Continue through Gates 1–5 unless a true blocker listed in the handoff occurs.
