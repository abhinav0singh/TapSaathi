# TaapSaathi - Post-Critique Engineering Progress

**Updated:** 9 October 2026
**Milestone:** Backend reliability hardening
**Status:** Implemented locally; AWS redeployment pending

## Executive summary

Following an external technical review, we investigated the
backend's intervention concurrency, worker state consistency,
workflow suppression, and test coverage.

The review identified two interventions created for Ravi within
seconds of each other and a worker profile that remained linked
to a completed intervention.

We reproduced the underlying worker-ownership problems using
automated regression tests and implemented targeted corrections.

These changes have not yet been deployed to AWS.

## 1. Problems identified

### Concurrent interventions

The backend previously protected individual idempotency keys
but did not enforce exclusive intervention ownership per worker.

Two distinct risk events could therefore create overlapping
interventions for the same worker.

### Terminal worker ownership

Completed interventions could leave an activeInterventionId
on the worker profile.

This caused inconsistencies between the operations dashboard
and rider experience.

### DynamoDB error classification

Different transaction failures were previously grouped into
generic intervention conflicts.

This risked confusing worker-ownership conflicts with stale
demo generations or infrastructure failures.

### Missing workflow suppression handling

A worker-ownership conflict could cause an unexpected Step
Functions failure instead of following a controlled outcome.

## 2. Implemented corrections

### Worker-level exclusivity

Added worker ownership and eligibility checks to both
DynamoRepository and MemoryRepository.

The DynamoDB check executes inside the intervention-creation
transaction.

### Precise transaction classification

Added cancellation-reason inspection to distinguish:

- Worker eligibility conflicts
- Stale demo generations
- Intervention-record conflicts
- Unrelated infrastructure failures
- Ambiguous transaction cancellations

### Controlled workflow suppression

The CreateIntervention Lambda now returns an internal
creationOutcome:

- CREATED
- WORKER_UNAVAILABLE

The Step Functions workflow routes CREATED to guidance and
WORKER_UNAVAILABLE to a controlled terminal state.

Unexpected outcomes enter an explicit failure state.

### Terminal ownership reconciliation

Completion now reconciles activeInterventionId without
automatically marking an unsafe worker SAFE.

Conditional DynamoDB operations protect against overwriting
ownership belonging to another intervention.

### Regression coverage

Added tests covering:

- Concurrent intervention creation
- Duplicate intervention IDs
- Supervisor timeout safety state
- Terminal ownership reconciliation
- DynamoDB transaction cancellation classification
- Ownership race rejection
- Creation Lambda error propagation
- Structural Step Functions transitions

## 3. Verification evidence

Observed before the latest additional regression test:

- Full Vitest suite: 59/59 PASS
- Test files: 13
- TypeScript: PASS
- CDK synthesis: PASS
- State-machine definition validation: PASS
- Structural workflow test: PASS

Additional verification:

- DynamoDB adapter suite: 10/10 PASS
- Idempotency throttling regression: PASS

The complete suite must be rerun after the latest test addition
before claiming a new full-suite total.

These results are local development evidence, not GitHub CI
or live AWS execution evidence.

## 4. Remaining work

### Backend

- Implement durable INTERVENTION_SUPPRESSED audit persistence.
- Verify suppression audit idempotency and stale-generation safety.
- Complete remaining idempotency cancellation edge-case review.
- Run final complete regression suite.

### AWS

- Review CDK deployment diff.
- Deploy updated backend.
- Verify worker exclusivity against real DynamoDB.
- Verify controlled Step Functions suppression.
- Execute and record the Take Break golden path.
- Capture execution ARNs and audit evidence.

### Frontend and presentation

- Verify the production frontend build.
- Host the frontend for external judges.
- Complete map integration and usability testing.
- Record a demonstration video.
- Update release evidence with real AWS results.

## 5. Verification boundaries

The AWS backend was deployed before this hardening milestone.

The changes described in this document are currently local
source-code improvements.

Passing mocked DynamoDB tests does not establish successful
execution against deployed AWS resources.

The suppressed-event workflow currently emits logs and metrics,
but dedicated durable suppression audit persistence remains
unfinished.

Do not describe the concurrency issue as fixed in production
until redeployment and live verification are complete.

## 6. Guidance for external reviewers

Review these files:

- services/shared/src/dynamo-repository.ts
- services/shared/src/memory-repository.ts
- services/shared/tests/dynamo-repository.test.ts
- services/shared/tests/dynamo-completion.test.ts
- services/demo/tests/intervention-concurrency.test.ts
- services/intervention/src/create.ts
- services/intervention/tests/create-intervention.test.ts
- services/intervention/src/workflow-input.ts
- infra/lib/taapsaathi-stack.ts
- infra/test/stack.test.ts

Evaluate the implementation against the original frozen
contracts and the remaining deployment-verification gates.

Do not infer production readiness from local test results.
