# TaapSaathi Test Plan

**Status:** Final release gate  
**Audience:** Every developer  
**Governing documents:** `PRD.md`, `Frontend_SSD.md`, and `Backend_SSD.md`  
**Purpose:** Prove that the one workflow shown to judges is real, deterministic, repeatable, accessible, and visibly powered by AWS.

## 1. Release rule

TaapSaathi is demo-ready only when the golden scenario passes twice consecutively on the deployed URL after two independent resets.

No developer may declare a feature complete because it works locally, appears in the UI, or exists in the repository. It is complete only when its acceptance test passes in the integrated environment.

## 2. Test priorities

| Priority | Meaning | Release rule |
| --- | --- | --- |
| P0 | Required for the judged workflow | Every P0 test must pass. |
| P1 | Valuable hardening | May be cut only after documenting the limitation. |
| P2 | Post-hackathon | Must not consume time before P0 completion. |

## 3. Test environments

### 3.1 Local unit environment

Used for pure functions, component tests, contract tests, and CDK assertions.

### 3.2 Deployed development environment

Used for EventBridge, Step Functions, DynamoDB, Location, Polly, API, Amplify, callback, timeout, and reset tests.

### 3.3 Recording environment

The exact deployed environment and seed data used for the final video. Do not deploy untested changes after the recording environment passes release gates.

## 4. Fixed demo data

Every reset must create exactly these logical entities. Identifiers may be namespaced by environment but must remain stable inside the demo.

### 4.1 Hub

| Field | Value |
| --- | --- |
| Hub ID | `hub-delhi-001` |
| Name | Delhi North Demo Hub |
| Time zone | `Asia/Kolkata` |

### 4.2 Workers

| Worker | Initial state | Active minutes | Active tasks | Language |
| --- | --- | ---: | ---: | --- |
| Ravi, `ravi-001` | `SAFE` | 75 | 1 | Hindi |
| Asha, `asha-001` | `SAFE` | 20 | 0 | English |
| Imran, `imran-001` | `CAUTION` | 50 | 0 | Hindi |

### 4.3 Task

| Field | Value |
| --- | --- |
| Task ID | `delivery-001` |
| Initial assignee | `ravi-001` |
| Initial status | `ASSIGNED` |

### 4.4 Rest points

Create exactly three seeded, clearly labelled demonstration rest points with coordinates near the demo riders. At least one Amazon Location scooter route must succeed.

### 4.5 Heat-spike fixture

```json
{
  "schemaVersion": 1,
  "source": "DEMO_SIMULATOR",
  "hubId": "hub-delhi-001",
  "temperatureC": 45.2,
  "relativeHumidity": 42,
  "apparentTemperatureC": 49.1,
  "officialHeatAlert": true,
  "observedAt": "<generated current timestamp>"
}
```

The fixture is designed to exercise the configured demo rule. It is not presented as a live Delhi observation.

## 5. Tooling

| Layer | Tool |
| --- | --- |
| TypeScript unit tests | Vitest |
| React component tests | React Testing Library |
| Contract validation | Shared Zod or JSON Schema plus Vitest |
| Infrastructure assertions | AWS CDK assertions |
| Browser E2E | Playwright |
| API smoke | TypeScript script or `curl` commands |
| AWS workflow evidence | AWS SDK, Step Functions execution history, DynamoDB reads, CloudWatch logs |
| Accessibility | Automated axe check if available plus manual keyboard and mobile review |

Testing tools must not become a project by themselves. If Playwright setup threatens the golden path, retain one small E2E test and execute the remaining release cases through the manual checklist.

## 6. Required automated test suites

```text
packages/contracts/tests/
services/risk-engine/tests/
services/intervention/tests/
services/demo/tests/
infra/test/
apps/web/tests/
e2e/
```

Recommended commands:

```bash
npm run typecheck
npm run lint
npm run test
npm run test:infra
npm run test:e2e
npm run smoke:deployed
```

The root README must contain the final working commands. Remove any command that is not actually configured.

## 7. Contract tests

### CT-001 Valid heat-risk event

**Priority:** P0  
**Given:** A complete `HeatRiskRaised` v1 payload  
**When:** The shared schema validates it  
**Then:** Validation succeeds without changing values.

### CT-002 Reject missing idempotency key

**Priority:** P0  
**Given:** A heat-risk event without `idempotencyKey`  
**When:** It is validated  
**Then:** Validation fails and the event is not published.

### CT-003 Reject unknown schema version

**Priority:** P0  
**Given:** `schemaVersion: 2`  
**When:** The v1 consumer validates it  
**Then:** It fails explicitly rather than accepting a potentially breaking payload.

### CT-004 Frontend fixture parity

**Priority:** P0  
**Given:** Every frontend fixture  
**When:** It is parsed by the shared response schema  
**Then:** Validation succeeds.

### CT-005 Error-envelope parity

**Priority:** P0  
**Given:** Every documented `4xx` and `5xx` response fixture  
**When:** It is parsed  
**Then:** It contains `error.code`, `error.message`, and optional `requestId` only.

## 8. Risk-engine unit tests

### RE-001 Safe state

**Priority:** P0  
**Input:** No heat alert, no symptom, active duration below policy threshold  
**Expected:** `SAFE`, `NO_POLICY_MATCH`, `CONTINUE`.

### RE-002 Caution state

**Priority:** P0  
**Input:** Official heat alert true, exposure below threshold, no symptom  
**Expected:** `CAUTION`, `OFFICIAL_HEAT_ALERT`, `PREPARE_BREAK`.

### RE-003 High-risk state

**Priority:** P0  
**Input:** Official heat alert true, active duration at or above threshold, no symptom  
**Expected:** `HIGH`, `HEAT_ALERT_WITH_ACTIVE_EXPOSURE`, `TAKE_BREAK`.

### RE-004 Symptom override

**Priority:** P0  
**Input:** Conditions otherwise safe, symptom true  
**Expected:** `CRITICAL`, `WORKER_REPORTED_SYMPTOM`, `ESCALATE`.

### RE-005 Boundary duration

**Priority:** P0  
**Input:** Active duration one minute below, exactly at, and one minute above threshold  
**Expected:** Only exact and above trigger the high-risk duration condition.

### RE-006 Complete evidence

**Priority:** P0  
**Given:** Any decision  
**Expected:** Output evidence contains the input alert state, active minutes, configured threshold, and relevant environmental values.

### RE-007 Determinism

**Priority:** P0  
**Given:** The same input repeated 100 times  
**Expected:** Byte-equivalent decision output apart from explicitly excluded metadata.

## 9. Infrastructure tests

### INF-001 Required resources

**Priority:** P0  
**Then:** The synthesized CDK template contains the HTTP API, Lambda functions, DynamoDB table, custom event bus, Scheduler resource, Standard state machine, S3 bucket, and CloudWatch logs.

### INF-002 Event rule target

**Priority:** P0  
**Then:** The `HeatRiskRaised` EventBridge rule targets the intervention state machine.

### INF-003 DynamoDB protections

**Priority:** P0  
**Then:** TTL is enabled and the hub/status GSI exists.

### INF-004 S3 privacy

**Priority:** P0  
**Then:** Block Public Access is enabled for the audio bucket.

### INF-005 Lambda runtime

**Priority:** P0  
**Then:** Application Lambdas use `nodejs22.x`.

### INF-006 IAM scope

**Priority:** P1  
**Then:** API functions cannot publish arbitrary resources, the response handler can call only required Step Functions callbacks, and Polly/Location permissions are assigned only where used.

## 10. Event and workflow integration tests

### WF-001 Automatic schedule exists and is enabled

**Priority:** P0  
**Steps:** Inspect the deployed EventBridge Scheduler schedule.  
**Expected:** The schedule is enabled, targets the weather adapter, and has a five-minute rate.

### WF-002 Demo event enters through EventBridge

**Priority:** P0  
**Steps:** Reset; call `POST /demo/heat-spike`; retrieve execution history.  
**Expected:** Response is `202`; event source is `DEMO_SIMULATOR`; EventBridge starts one state-machine execution; the demo Lambda does not call `StartExecution` directly.

### WF-003 One event creates one intervention

**Priority:** P0  
**Steps:** Publish a valid unique event.  
**Expected:** One intervention and one idempotency lock exist; the workflow is waiting for the worker.

### WF-004 Duplicate event prevention

**Priority:** P0  
**Steps:** Publish the exact same event twice.  
**Expected:** Exactly one intervention exists; no task is reassigned twice; duplicate metric or audit entry exists.

### WF-005 Take-break branch

**Priority:** P0  
**Steps:** Trigger spike; wait for guidance; submit `TAKE_BREAK`.  
**Expected:** Callback succeeds once; Ravi becomes `RESTING`; `delivery-001` moves to Asha; workflow completes successfully.

### WF-006 Symptom branch

**Priority:** P0  
**Steps:** Trigger spike; submit `FEEL_UNWELL`.  
**Expected:** No normal reassignment-only completion; urgent supervisor action exists; workflow waits for supervisor.

### WF-007 Worker timeout branch

**Priority:** P0  
**Steps:** Trigger spike; do not respond until the configured demo timeout.  
**Expected:** Workflow enters supervisor escalation automatically.

### WF-008 Supervisor acknowledgement

**Priority:** P0  
**Steps:** Reach escalation; submit `SUPERVISOR_ACK`.  
**Expected:** Callback succeeds once; final state is `SUPERVISOR_RESPONDING`; audit timeline records actor and time.

### WF-009 Repeated callback

**Priority:** P0  
**Steps:** Submit the same worker or supervisor response twice.  
**Expected:** First request is accepted; second returns `409 ALREADY_RESPONDED`; workflow state does not change twice.

### WF-010 Invalid actor

**Priority:** P0  
**Steps:** Submit worker action with another worker id or supervisor action from worker type.  
**Expected:** Request is rejected and task token remains usable by the valid actor.

### WF-011 Old-generation callback after reset

**Priority:** P0  
**Steps:** Start an intervention; reset; submit the pre-reset response.  
**Expected:** Request is rejected as stale and the new seed state remains unchanged.

### WF-012 Workflow failure visibility

**Priority:** P1  
**Steps:** Deny or mock one optional dependency failure.  
**Expected:** Workflow records a clear failure or documented fallback; UI never reports false success.

## 11. Guidance integration tests

### GD-001 Amazon Location route

**Priority:** P0  
**Steps:** Trigger the golden path.  
**Expected:** At least one successful scooter route is returned; destination is one of the seeded rest points; distance, duration, and geometry are persisted.

### GD-002 Route selects shortest successful duration

**Priority:** P0  
**Given:** More than one successful rest-point route  
**Expected:** Selected point has the shortest returned duration.

### GD-003 Route-provider failure

**Priority:** P1  
**Steps:** Simulate Location failure.  
**Expected:** Workflow records `GUIDANCE_ROUTE_FAILED`; UI shows destination without falsely claiming an AWS-calculated route.

### GD-004 Hindi Polly audio

**Priority:** P0  
**Steps:** Trigger Ravi's Hindi intervention.  
**Expected:** Polly creates playable audio; language and message correspond to the displayed recommendation.

### GD-005 Audio cache

**Priority:** P1  
**Steps:** Request the same language/message twice.  
**Expected:** Second request returns the cached object without another synthesis call where observable.

### GD-006 Audio privacy

**Priority:** P0  
**Expected:** Bucket is private; only the matching JWT-authenticated rider receives a short-lived usable URL from `GET /workers/{workerId}/audio`; public dashboard and worker responses expose neither signed URLs nor `audioKey`; direct unauthenticated bucket listing is impossible.

## 12. Reassignment tests

### TA-001 Select safe worker

**Priority:** P0  
**Given:** Asha is safe with zero tasks and Imran is caution with zero tasks  
**Expected:** Asha receives `delivery-001`.

### TA-002 Exclude active intervention

**Priority:** P0  
**Given:** A candidate has an urgent active intervention  
**Expected:** Candidate is excluded.

### TA-003 Tie-breaker

**Priority:** P0  
**Given:** Two safe candidates have equal tasks and active minutes  
**Expected:** Stable `workerId` ordering selects the same candidate every time.

### TA-004 Concurrent reassignment

**Priority:** P1  
**Steps:** Invoke reassignment twice for the same task.  
**Expected:** Conditional update permits one winner; task has one assignee.

### TA-005 No eligible worker

**Priority:** P0  
**Expected:** Task becomes `REASSIGNMENT_REQUIRED`; supervisor sees the problem; workflow does not report successful reassignment.

## 13. Reset tests

### RS-001 Exact seed state

**Priority:** P0  
**Steps:** Mutate every demo entity; call reset.  
**Expected:** Three workers, one assigned task, three rest points, no active intervention, and the expected initial states exist.

### RS-002 Reset idempotency

**Priority:** P0  
**Steps:** Call reset twice.  
**Expected:** Both complete safely; final state is identical; no duplicate seed items.

### RS-003 Concurrent reset protection

**Priority:** P1  
**Steps:** Submit two reset requests concurrently.  
**Expected:** One runs; the other returns `409 RESET_IN_PROGRESS` or an equivalent safe response.

### RS-004 Scope protection

**Priority:** P0  
**Given:** A non-demo item exists  
**When:** Demo reset runs  
**Expected:** The non-demo item is unchanged.

### RS-005 Reset verification

**Priority:** P0  
**Expected:** Reset returns success only after reading and validating the final seed state.

## 14. API tests

### API-001 Health

**Priority:** P0  
**Expected:** `GET /health` returns `200`, service name, status, and current timestamp.

### API-002 Dashboard schema

**Priority:** P0  
**Expected:** `GET /dashboard` returns a contract-valid response with all three workers after reset.

### API-003 Unknown worker

**Priority:** P0  
**Expected:** `GET /workers/unknown` returns structured `404`, not an empty success.

### API-004 Invalid response body

**Priority:** P0  
**Expected:** Invalid action or missing actor returns structured `400` and does not advance workflow.

### API-005 CORS

**Priority:** P0  
**Expected:** Deployed frontend origin succeeds; unsupported origins do not receive permissive production claims.

### API-006 Sensitive-data exclusion

**Priority:** P0  
**Expected:** No API response contains Step Functions task tokens, secrets, internal stack traces, or private bucket paths.

### API-007 Throttling

**Priority:** P1  
**Expected:** Excessive demo requests are bounded and do not create unlimited workflow executions.

## 15. Frontend component and integration tests

### UI-001 Render every state

**Priority:** P0  
**Expected:** Every state has text, icon, and color; no state depends on color alone.

### UI-002 Rider mobile viewport

**Priority:** P0  
**Viewport:** 360 by 800  
**Expected:** No horizontal scroll; actions visible and at least 48 pixels high.

### UI-003 Hindi switch

**Priority:** P0  
**Expected:** Essential rider copy changes to reviewed Hindi; selected preference survives refresh.

### UI-004 Audio replay

**Priority:** P0  
**Expected:** Replay control plays the backend URL, reports failure accessibly, and never blocks visual action buttons.

### UI-005 Submit once

**Priority:** P0  
**Steps:** Rapidly tap **Take break** twice.  
**Expected:** Button disables after first tap; only one logical response is accepted.

### UI-006 Polling transition

**Priority:** P0  
**Expected:** Rider and supervisor screens move from safe to high risk without manual refresh.

### UI-007 Stale data

**Priority:** P0  
**Steps:** Fail two polling calls.  
**Expected:** Last good data remains visible with a stale warning; no false state transition occurs.

### UI-008 Map failure

**Priority:** P0  
**Expected:** Destination name, distance, audio, and actions remain usable when tiles fail.

### UI-009 Keyboard access

**Priority:** P0  
**Expected:** All controls are reachable with Tab, focus is visible, and Enter/Space activates buttons.

### UI-010 Demo labels

**Priority:** P0  
**Expected:** Simulated trigger and demonstration rest points are visibly labelled.

## 16. Golden end-to-end test

### E2E-001 Break and reassignment

**Priority:** P0

1. Open the deployed `/ops` in a signed-out browser.
2. Open `/worker/ravi-001` in a mobile viewport.
3. Reset the demo.
4. Confirm Ravi is safe and owns `delivery-001`.
5. Trigger the simulated heat spike.
6. Confirm the operations dashboard shows one active intervention.
7. Confirm the rider page shows the Hindi break recommendation.
8. Play the audio.
9. Confirm a route and rest-point summary appear.
10. Select **Take break**.
11. Confirm Ravi becomes resting.
12. Confirm Asha receives `delivery-001`.
13. Confirm the audit timeline contains the trigger, guidance, response, and reassignment.
14. Confirm the Step Functions execution succeeded.

**Pass condition:** All steps succeed without manual database edits, console-triggered Lambda runs, page reloads, or hidden repair actions.

### E2E-002 Symptom and escalation

**Priority:** P0

1. Reset.
2. Trigger the simulated heat spike.
3. Select **I feel unwell**.
4. Confirm the dashboard shows urgent supervisor action.
5. Select **I am responding**.
6. Confirm final state and audit events.

**Pass condition:** The workflow reaches `SUPERVISOR_RESPONDING` and does not falsely claim an emergency call.

### E2E-003 Timeout escalation

**Priority:** P0

1. Reset.
2. Trigger the simulated heat spike.
3. Provide no rider response.
4. Wait for the configured demo timeout.
5. Confirm supervisor escalation appears automatically.

**Pass condition:** No human or test script manually invokes the escalation handler.

## 17. Non-functional tests

### NF-001 Alert latency

**Priority:** P1  
**Target:** The rider UI reflects the demo high-risk event within ten seconds under normal hackathon conditions.

### NF-002 API latency

**Priority:** P1  
**Target:** Cached dashboard and worker reads complete within two seconds for the demo dataset.

### NF-003 Cold-start tolerance

**Priority:** P0  
**Expected:** The first demo run after inactivity completes without timeout. Warm the environment only through documented normal requests before recording.

### NF-004 Recovery after refresh

**Priority:** P0  
**Expected:** Refreshing either page reconstructs current state from the backend.

### NF-005 Privacy

**Priority:** P0  
**Expected:** Location/callback items contain TTL; logs and browser network responses contain no task tokens.

### NF-006 Signed-out access

**Priority:** P0  
**Expected:** The deployed judge URL and final YouTube link open in signed-out sessions.

## 18. Failure-injection checklist

Run after the golden path works:

- invalid heat-spike payload;
- duplicated event;
- Location failure;
- Polly failure;
- no eligible replacement rider;
- worker response after timeout;
- callback repeated;
- reset during active intervention;
- frontend polling interruption;
- map-tile failure.

For every injected failure, verify that the UI shows the truth and the audit trail records what failed. A graceful, honest partial result is better than fake success.

## 19. Traceability matrix

| PRD requirement | Primary tests |
| --- | --- |
| PRD-001 Dashboard | API-002, UI-001, UI-006, E2E-001 |
| PRD-002 Rider view | UI-002, UI-003, UI-004, UI-009 |
| PRD-003 Automatic path | WF-001, E2E-003 |
| PRD-004 Demo heat spike | WF-002, UI-010 |
| PRD-005 Deterministic policy | RE-001 through RE-007 |
| PRD-006 Event routing | INF-002, WF-002 |
| PRD-007 Workflow | WF-003 through WF-011 |
| PRD-008 Guidance | GD-001 through GD-006 |
| PRD-009 Reassignment | TA-001 through TA-005, E2E-001 |
| PRD-010 Escalation | WF-006 through WF-008, E2E-002, E2E-003 |
| PRD-011 Audit timeline | WF-003 through WF-008, E2E-001 |
| PRD-012 Idempotency | WF-004, WF-009, TA-004 |
| PRD-013 Reset | RS-001 through RS-005 |
| PRD-014 Deployment | NF-006, E2E-001 |
| PRD-015 Observability | WF-002, WF-012, release checklist |

## 20. Test execution schedule

| Deadline | Required evidence |
| --- | --- |
| Hour 4 | Contract tests and risk tests run locally. |
| Hour 8 | CDK tests pass; one EventBridge event creates one intervention. |
| Hour 14 | Dashboard reads deployed API; UI component tests pass. |
| Hour 20 | Worker callback and duplicate-response tests pass. |
| Hour 24 | E2E-001 passes once. |
| Hour 30 | Location, Polly, and escalation tests pass. |
| Hour 34 | E2E-001, E2E-002, and E2E-003 pass after reset. |
| Hour 38 | Failure-injection and signed-out checks complete. |
| Hour 40 | Release candidate frozen. |
| Hour 44 | Backup recording verified. |

## 21. Defect severity

| Severity | Examples | Rule |
| --- | --- | --- |
| Blocker | Deployment unavailable, workflow cannot start, reset corrupts state, duplicate reassignment | Stop all optional work and fix. |
| Critical | Rider cannot respond, escalation fails, route/audio falsely reported, task token exposed | Must fix before recording. |
| Major | Timeline misses evidence, Hindi copy incorrect, map unavailable without fallback | Fix before release if P0 impact. |
| Minor | Spacing, nonessential animation, small desktop visual issue | Fix only after all P0 tests pass. |

## 22. Pre-recording release checklist

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] Unit and contract tests pass.
- [ ] CDK synthesis and assertions pass.
- [ ] Deployed health endpoint is green.
- [ ] EventBridge Scheduler is enabled.
- [ ] Reset produces exact seed state.
- [ ] Break/reassignment scenario passes twice.
- [ ] Symptom/escalation scenario passes.
- [ ] Timeout escalation passes.
- [ ] Duplicate event does not duplicate work.
- [ ] Hindi audio is understandable.
- [ ] Amazon Location route is present.
- [ ] No task token appears in browser or logs.
- [ ] UI works at 360 by 800.
- [ ] UI works at 1366 by 768.
- [ ] Map failure fallback remains usable.
- [ ] Simulated data is labelled.
- [ ] CloudWatch and Step Functions evidence is ready to show.
- [ ] Signed-out application and video links work.
- [ ] Backup recording exists before final visual changes.

## 23. Final release report

Before recording, create a short table in the README:

| Gate | Result | Evidence |
| --- | --- | --- |
| Golden break path | Pass or fail | execution id or screenshot path |
| Symptom escalation | Pass or fail | execution id or screenshot path |
| Timeout escalation | Pass or fail | execution id or screenshot path |
| Duplicate protection | Pass or fail | test output |
| Reset repeatability | Pass or fail | test output |
| Mobile accessibility | Pass or fail | viewport screenshot |
| Signed-out access | Pass or fail | verification date and time |

Never mark a gate as passed without executing it against the release candidate.

