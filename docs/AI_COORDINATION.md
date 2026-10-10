# AI coordination log

This file is the shared handoff for Codex and Claude. Update it in the same
change as any work that alters scope, verification, deployment status, or the
next safe action. It is a coordination record, not evidence of deployment.

## Current change

- **Merged/deployed commit:** `61836f8eb57580ba20d8c5708d5ad68c7ed123f1`
- **Purpose:** PR #30 deployed; preserve its evidence boundary while preparing
  the remaining Phase 3 workflow verification.
- **Deployment status:** CloudFormation `UPDATE_COMPLETE`; Amplify `SUCCEED`.
  The Amplify CORS origin is preserved and the demo reset is clean with zero
  active interventions.

## What changed

1. Polly guidance now addresses the worker receiving the intervention instead
   of always addressing Ravi. Audio cache keys vary with the personalized text.
2. The public `GET /workers/{workerId}` response no longer returns a signed S3
   audio URL.
3. `GET /workers/{workerId}/audio` is a new Cognito-JWT-protected route. Its
   handler uses the server-side SSM identity mapping and only returns a
   five-minute URL to the matching `WORKER` identity.
4. The rider UI requests audio only from that protected route when the signed-in
   worker owns the active intervention. Signed-out visitors retain the public,
   read-only rider preview without audio playback.
5. README and project/verification status docs now separate recorded v2 proof
   from AWS scenarios that must be re-verified under v2.
6. Direct handler tests now prove worker-audio authorization fails before any
   DynamoDB read or URL signing for a missing JWT, a mismatched worker, and an
   unavailable identity mapping.
7. Both public intervention views (`GET /workers/{workerId}` and
   `GET /dashboard`) now omit the private `audioKey`; their handlers strip it
   before serialization and their contracts omit it as defense in depth. The
   rider UI uses the protected audio route whenever an intervention is present.
8. The audio success test asserts the exact S3 bucket/key and the 300-second
   signing lifetime, so a wrong-object regression fails the test.
9. Worker-audio handler tests also reject mapped non-workers, unmapped
   subjects, and missing role groups before reads or signing. They cover both
   no-active-intervention and no-audio-key 404s without signing. A missing
   `AUDIO_BUCKET_NAME` now returns a 500 configuration error, rather than
   disguising an operator-fixable deployment fault as an absent resource.
10. OpenAPI, runbook, and design/test documents now state that public worker
    and dashboard views omit private audio data, while the rider-specific audio
    endpoint requires a matching JWT and returns configuration failures as 500.
11. `WorkerAudioFunction` now receives the SSM identity-mapping parameter name
    and least-privilege `ssm:GetParameter` permission in CDK. The public worker
    contract no longer permits audio URL fields; those remain exclusive to the
    rider-specific audio response.

## Local verification run by Codex

The deployed release was verified with:

- `npm run typecheck` — PASS
- `npm run test:unit` — PASS, 180 tests
- `npm run test:infra` — PASS, 16 tests
- `npm run synth` — PASS
- `npm run verify:definition` — PASS
- `npm run build --workspace=@taapsaathi/web` — PASS

The CDK commands emit existing deprecation warnings for `logRetention` and
Step Functions `timeout`; these are not release blockers for this change.

## Deployed PR #30 evidence

- Matching rider audio access returned `200`; operator, supervisor, and
  cross-rider requests returned `403`.
- The signed Polly audio downloaded successfully.
- Public worker and dashboard APIs exposed no audio URL, expiry, or storage
  key; all main pages returned `200`.
- One immediate reset returned `500` while a workflow was finishing; retry
  succeeded and the final state is clean. This is not reset-isolation proof.

## Phase 3 review checklist

**Preflight (10 October 2026):** production `/health` returned `ok` and the
public dashboard reported demo generation 22 with zero active interventions.
The approved AWS verification profile authenticated successfully. No
state-changing Phase 3 scenario has run in this session because fresh Cognito
access tokens for the operator, Ravi, and Neha are not present; do not place
tokens in this file, the repository, or chat evidence.

1. Record deployed proof for break then rider resume, symptom escalation then
   supervisor acknowledgement and self-declared resume, timeout, duplicate
   event, and stale callback after reset.
2. Capture execution ARNs, queried deployed records, or browser/API evidence
   for every scenario before marking it verified.
3. Investigate the transient reset `500` before treating reset isolation as
   verified.

## Next action after deploy: Phase 3

Run and record a clean v2 verification sequence: take-break then rider resume;
symptom report then supervisor acknowledgment then self-declared resume; timeout
escalation; duplicate-event replay; stale callback after reset; and real JWT
negative checks. Capture Step Functions execution ARNs and graph screenshots.

## Working rules

- Keep simulated data visibly labelled; do not make medical claims or imply an
  automatic emergency call.
- Do not commit passwords, Cognito tokens, task tokens, or signed URLs.
- Preserve the public read-only demo while keeping action and audio access
  identity-bound.
- R3 and R4 from Claude's review are implemented. A missing audio bucket is a
  500 configuration error because it needs operator remediation, while a
  missing intervention or audio key remains a rider-visible 404.
- Update this file when either agent changes the above state.
