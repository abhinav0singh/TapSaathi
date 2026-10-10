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

**Live verification (11 October 2026):** fresh Cognito sessions for the
operator, Ravi, and Neha were created in process and discarded without writing
tokens to disk or evidence. Three clean `TAKE_BREAK` then rider-resume runs
passed on generations 23–25. Each used an `AMAZON_LOCATION` route, returned
protected rider audio, reassigned `delivery-001` to Asha, completed its real
Step Functions execution, returned Ravi to `SAFE` with zero active minutes, and
left the reassigned delivery with Asha. A `FEEL_UNWELL` run on generation 28
also passed through Neha's acknowledgement and Ravi's audited self-declared
resume. Missing-token reset returned `401`, worker-token reset and rider
impersonation returned `403`, same-request replay remained idempotent, and a
new response after consumption returned `409`. All resets in this sequence
succeeded on the first attempt. The final reset produced generation 29 with
zero active interventions, Ravi `SAFE`, and `delivery-001` assigned to Ravi.

1. Complete the three-role browser/mobile evidence and close issue #8.
2. Capture Step Functions graph and browser screenshots without exposing AWS
   account identifiers, Cognito tokens, passwords, or signed URLs.
3. Keep the final demo state clean. The recorded evidence sequence ended at
   generation 34; a later public review snapshot observed generation 36 with
   zero active interventions, Ravi `SAFE`, and `delivery-001` assigned to
   Ravi. That snapshot is a readiness baseline, not additional scenario proof.

**Browser-evidence progress (11 October 2026):** an existing authenticated Ravi
worker session was checked at a 375 × 812 viewport. The clean `SAFE` worker
screen rendered correctly in English and Hindi; the visible identity remained
Ravi and the Hindi view localized the heading, response-status notice,
emergency CTA, and simulation disclosure. This is a responsive clean-state
baseline captured in the review session, not proof of an active intervention,
audio greeting, operator action, or supervisor acknowledgement. Chrome did not
have an authenticated AWS Console session, so no Step Functions graph was
captured. Do not mark the remaining browser/mobile or graph criteria complete
until an authenticated, redacted evidence capture covers the active flows.

## Next action after deploy: Phase 3

Complete the three-role browser evidence for issue #8 at desktop and mobile
viewports, capture the successful Step Functions graph screenshots, and then
move to the real-weather replay and demo-video rehearsal.

## Phase 4 implementation in progress

The Phase 4 branch introduces a fixed, clearly labelled Delhi historical
reanalysis value from Open-Meteo's archive (29 May 2024, 13:00 IST) and
evaluates it through the same deterministic `heat-policy-v2` evaluator used by
the backend. The weather-only result is `CAUTION`; its displayed `HIGH` result
assumes the demo rider has reached the 60-minute continuous-exposure limit. It
is not a live reading or an official alert. The operations view also derives only
operational timings (trigger-to-reassignment and trigger-to-response) and
counts from audit records in the currently displayed generation; it makes no
claim about wellbeing or medical outcomes. Local verification passed: root
typecheck; 155 unit tests; 16 infrastructure tests; state-machine validation;
the deterministic-policy test; and the production web build.

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
