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
## PR #35 Review #2 corrections

Base reviewed commit: `6a3495e`.

### F1 — Backend CI script mismatch

Updated `.github/workflows/backend.yml` to invoke
`npm run test:risk:policy` instead of the removed
`test:risk:zero-dependency` script.

### F2 — Operations audit freshness and availability

Added a dedicated operations audit hook that refreshes full audit history
every 15 seconds while the operations page remains mounted.

The operations impact cards now distinguish loading, unavailable,
and successfully loaded audit history. Zero counts are displayed only
after successful retrieval. Audit results remain isolated by demo
generation.

The existing shared `useAuditEvents` hook remains unchanged, preserving
Supervisor and RiderExperience acknowledgement polling.

### Local verification — 11 October 2026

All commands completed successfully:

- Contracts build: PASS
- Root typecheck: PASS
- Web typecheck: PASS
- Backend unit tests: PASS
- Infrastructure tests: PASS
- Full Vitest suite: PASS
- CDK synthesis: PASS
- State-machine definition verification: PASS
- Deterministic risk-policy tests: PASS, 3 tests
- Production web build: PASS
- Web tests: PASS, 5 files / 18 tests
- New operations audit regression tests: PASS, 6 tests
- Git diff whitespace check: PASS

The new tests cover polling beyond 12 attempts, cleanup, retry
scheduling, loading versus empty history, generation isolation,
unavailable history, and asynchronous fetch failure followed by recovery.

The polling and state-transition tests are unit-level evidence,
not a mounted React-hook or deployed-browser verification.

### Remaining verification

- Commit and push the corrections to PR #35.
- Confirm Backend and Web GitHub Actions checks pass on the new head.
- Record the new commit SHA and CI run IDs.
- Request Claude Review #3 only after both checks are green.

No AWS deployment verification is claimed for this change.

### PR #35 post-merge audit polling hardening

The operations-only audit poller now skips refresh requests while its tab is
hidden, keeps its overlap and unmount guards under direct regression tests, and
retains the last successful audit history with a visible stale marker after a
transient failure. This remains local UI behavior only; no deployed-browser or
AWS verification is claimed.

### PR #37 follow-up hardening

The Web workflow now executes the web Vitest suite, including the operations
audit regression tests. The operations audit poller skips hidden-tab interval
work and refreshes immediately when the tab becomes visible again. Its
visibility subscription is cleaned up on unmount.

The obsolete circular retry test was removed. Recovery is covered through the
real refresher and fetch paths instead. The operations timeline now repeats
the stale-history notice and also identifies unavailable audit history, so the
state is not confined to the impact card.

These are source and local-test changes only. No deployed-browser or AWS
verification is claimed.

Local verification for this follow-up passed: root typecheck; 155 backend unit
tests; 16 infrastructure tests; state-machine definition validation; 3
deterministic risk-policy tests; 5 web test files / 21 tests; and the
production web build. The Web GitHub Actions workflow also passed on the
reviewed PR head `24fb3b0` (run `38113699099`), including the web test step
added here.

### PR #38 follow-up review corrections

The cited Web CI evidence now identifies the reviewed PR head and run
accurately. The visibility-change DOM wiring was extracted into a
document-like helper and has direct regression coverage for subscription,
visible-tab refresh, and cleanup. Local verification after this correction
passed root typecheck, 5 web test files / 22 tests, and the production web
build. The Web GitHub Actions workflow also passed on the reviewed PR head
`297a7b9` (run `38114232259`).

No deployed-browser or AWS verification is claimed.

### Authenticated Phase 3 browser evidence — 11 October 2026

Fresh Cognito sessions were used against the hosted Amplify application. No
password, token, callback value, or signed audio URL was recorded in the
repository or this coordination log.

- An operator triggered a heat spike and observed Ravi's active intervention.
- Ravi used the Hindi active-intervention screen, loaded the protected audio
  element, selected `TAKE_BREAK`, and reached `RESTING` after the delivery was
  reassigned to Asha. The `RESTING` view was checked at a 375 × 812 viewport.
- In a separate run, Ravi selected `FEEL_UNWELL`; Neha acknowledged the
  supervisor request; Ravi completed the required self-declaration and
  returned to `SAFE`.
- An authenticated AWS Console session opened the detail and graph for the
  documented stale-callback execution (generations 32 to 33). This confirms
  console access, not a new workflow result.
- The final reset completed cleanly at generation 38 with zero active
  interventions, Ravi `SAFE`, and `delivery-001` assigned to Ravi.

**Evidence boundary:** all Phase 3 behavioral checks above were observed in
the hosted system. A submission-ready, redacted Step Functions graph image is
not stored in the repository. Capture it separately only if the submission
package requires a persistent artifact; do not include account metadata,
tokens, signed URLs, or callback secrets.

### Review correction: stale execution after reset

Do not describe the stale-execution class as closed. The execution
`7163ff5c-97d8-c430-75eb-285cbd137cbc_cd3a54c8-133c-1b7a-ea48-d1174f22f0bb`
ended `FAILED` with `AppError: Intervention not found.` in
`CompleteSupervisorUnacknowledged` after a reset removed its old intervention.
It made no write to the new generation, but `DynamoRepository.complete` looks
up the intervention before comparing generations and therefore raises
`NotFoundError`, which the state machine does not catch as stale. Similar
lookup-first paths require review. Fix, test, deploy, and re-verify this in a
separate backend change; do not treat this documentation update as a fix.

The manually observed browser flows correlate to successful execution
`d33ed3c9-a765-b419-8abd-04139ac552f6_e46772c5-f792-2d9d-eee4-fb09b024c713`
(generation 36, operator/`TAKE_BREAK`) and
`648edea5-abd5-51b5-78ca-003d8647deeb_7fc910bf-9b3c-8931-abe2-7ada04eab9a9`
(generation 37, `FEEL_UNWELL`/supervisor acknowledgement). The Hindi,
audio-element, and mobile-viewport details remain manual observations, not
facts independently established by the Step Functions records.

### Release-baseline correction — 11 October 2026

The current reviewed source baseline is PR #35 merge
`a87a17b3bf4061582a0e14403782942d62301763`, which was deployed on 11 October
2026. PR #30 (`61836f8eb57580ba20d8c5708d5ad68c7ed123f1`) remains historical
production evidence for the protected-audio work, not the current release
baseline. The independently reviewed PR #35 suite was 31 Vitest files / 189
tests plus 3 standalone deterministic risk-policy tests; do not repeat the
superseded 180-test count as the current figure.

### Pending backend correction: stale missing intervention

The `codex/stale-missing-intervention` branch contains the separate source fix
for the known post-reset failure. `complete`, `escalate`, and `consumeCallback`
now compare their known execution generation with the current demo generation
when the intervention lookup is missing. An older execution raises
`StaleGenerationError` for the existing Step Functions stale catch; a missing
intervention in the current generation remains a `NotFoundError`.

`consumeCallback` now receives the persisted intervention generation from the
authenticated respond handler, rather than trusting client input. Adapter
regression tests cover all three repository operations; terminal Lambda tests
verify that stale errors propagate to the state-machine catch path; and the
respond-handler tests verify generation propagation and the `409`
stale-generation response without signaling Step Functions when the
intervention still exists. A callback for an intervention already removed by a
reset returns `404` from the respond handler's initial lookup, does not call
`consumeCallback`, and likewise does not signal Step Functions.

Local verification passed: root typecheck; 27 unit-test files / 166 tests; 16
infrastructure tests; CDK synth; and state-machine definition validation.
This branch has not been reviewed, merged, or deployed. The failed generation
26 execution remains a production limitation until an AWS owner deploys this
fix and a real stale-after-reset execution ARN is re-verified.

### PR #41 Sahara frontend review verification — 11 October 2026

Sahara is the approved public product name. Product-facing web copy and
documentation use Sahara; internal package names, repository URL, CloudFormation
stack name, and AWS resource identifiers deliberately remain TaapSaathi so the
existing deployed backend is not changed.

The PR contains frontend, documentation, and dependency-lockfile changes only;
it does not modify backend services, CDK infrastructure, or contracts. The
Sahara candidate was run locally against the deployed production API without
resetting the shared demo or triggering a heat spike.

- Clean install, root TypeScript typecheck, web typecheck, and production web
  build passed.
- Web Vitest suite passed: 7 files / 34 tests.
- Public production `GET /health`, `GET /dashboard`, and
  `GET /workers/ravi-001` each returned `200`; their responses contained no
  public audio URL, expiry, or storage key.
- Fresh Cognito sessions for the operator, Ravi, and Neha authenticated through
  the Sahara candidate. Operator `/ops` rendered the live map, rider roster,
  delivery assignment, and audit/context panels. Ravi's session rendered the
  identity-bound `/worker/ravi-001` view in both English and Hindi; requesting
  another worker path still displayed Ravi's identity-bound data. Neha's
  `/supervisor` view refreshed successfully and correctly reported no pending
  acknowledgement.
- No live intervention was active. Protected-audio playback, rider resume, and
  supervisor acknowledgement controls were therefore not exercised in this
  pass, avoiding any mutation of the shared demonstration.
- Responsive checks at 375 × 812 found and fixed two frontend-only header
  issues: the signed-in username no longer clips on mobile, and the header
  no longer widens the page when the supervisor navigation scrolls. The mobile
  document width is 375px for both operator and supervisor views.

**Evidence boundary:** these are local-candidate UI checks using real Cognito
and the deployed API, not an Amplify deployment of PR #41. No credential,
token, signed URL, or screenshot with account metadata is stored in the
repository. Active-flow evidence remains the recorded Phase 3 verification
described above.

### PR #41 follow-up: header rewrite, review fixes and responsive checks — 11 October 2026

The header notes above describe the `ead3a1b` fix. Commit `d6f8585` then split the navigation into
page links and account controls, so on a phone the brand and **Sign out** share the first row, the
signed-in username is hidden below the `sm` breakpoint, and the page links scroll inside their own
row. The `overflow-x-hidden` on the header from `ead3a1b` is no longer present. The current
suite is 35 files / 216 tests, not the 7 files / 34 tests quoted above.

A code review of the branch then produced ten findings, all frontend-only and all fixed:

- The supervisor desk opened a modal sheet when a case was clicked on a laptop (the backdrop and
  focus trap appeared with the content hidden). The sheet now opens only below the `lg` breakpoint.
- The operations map re-fitted and redrew on every poll, undoing the operator's pan and zoom. It now
  redraws only when a rider's state or position or a route changes, and re-fits only when the set
  of riders or routes changes.
- Map markers and tooltips are built from DOM text, not HTML strings, so names from the backend are
  never parsed as markup.
- The supervisor fact "Active before alert" showed the live active minutes; it is now "Active time now".
- The Cognito session is read once per load and shared (`components/useIdentity.ts`) instead of once
  per component.
- The unused toast and tooltip providers were removed, together with the `sonner` and `next-themes`
  dependencies.
- The language switch and the recorded-run picker are `aria-pressed` toggle buttons instead of tabs
  with no panels, and the audio control no longer nests block elements inside a button.
- Hindi text no longer inherits the global negative letter-spacing.

**Evidence boundary:** responsive layout was checked at 375, 768 and 1440 px against a local
production build using a read-only proxy of the deployed API, signed out. The signed-in header on a
phone after `d6f8585` and every authenticated action (rider reply, resume, supervisor
acknowledgment) still need a manual pass with the demo accounts. No Amplify deployment of PR #41
has been checked. No credential or token is recorded here.

### PR #41 follow-up: public documentation brand assets — 11 October 2026

The previous README GIFs and unused login screenshots visibly displayed the former TaapSaathi
product name. They were removed from the submission materials. The README now uses two
repository-native Sahara SVG diagrams for the product overview and intervention loop. This is a
documentation-only branding correction: it does not change any application, backend,
infrastructure, contract, deployment, or verification evidence.

### Pending frontend-only follow-up: terminal supervisor state — 11 October 2026

Read-only production inspection on the PR #41 baseline found demo generation
38 with Ravi in `AWAITING_SUPERVISOR`, no `activeInterventionId`, no active
interventions, and `delivery-001` assigned to Asha. The audit trail for the
same generation ends the earlier Ravi intervention as
`SUPERVISOR_UNACKNOWLEDGED`; it is not a currently running heat alert.

The focused frontend follow-up derives that terminal outcome in one helper and
uses it consistently in the operations stage panel, roster, map marker, and
rider view. It labels the situation as an outstanding supervisor follow-up,
not a live alert or success state. Ravi may not resume until the backend's
existing supervisor-acknowledgement rule permits it. The test suite includes
this exact no-active-intervention / unacknowledged-terminal-outcome
combination and generation isolation. Local QA against the read-only deployed
API confirmed the operations and rider views at 1440px and 375px without
horizontal overflow. No reset, heat spike, authentication action, deployment,
or backend/infrastructure/contract change was performed.

### Frontend-only product/walkthrough separation — 11 October 2026

The public landing page is being changed from a collection of product links and
a recorded-run route into Sahara's sole no-login interactive walkthrough. Its
scenario state is local and deterministic: heat risk, rider choice, delivery
ownership, supervisor follow-up, phone view, map, and audit list all derive
from the same client-side state. It does not import the API client or auth
code, and cannot reset, spike, read, or mutate the deployment-backed sandbox.

The public `/demo` recorded-run route, navigation item, login-page link, and
recorded-run fixtures are removed. The authenticated operations workspace no
longer exposes reset or heat-spike buttons; it is labelled as deployment-backed
sandbox data and is explicitly separate from the landing-page walkthrough.
The README, judge guide, frontend specification, and product requirements now
describe this boundary and no longer present `/demo` or an Operations reset as
the public product walkthrough.
Backend demo endpoints remain unchanged for controlled engineering and test
work. The requested two-role authorization migration (remove `OPERATOR` and
allow `SUPERVISOR` to operate protected demo controls) is deliberately not
claimed here: it requires a separately reviewed backend, Cognito, CDK, test,
and deployment change.

Local verification on the final frontend branch passed `npm run typecheck`,
`npx vitest run apps/web` (8 files / 36 tests), and
`npm run build --workspace=@taapsaathi/web`. The production build route table
contains `/`, `/login`, `/ops`, `/supervisor`, and `/worker/[workerId]`; it no
longer contains `/demo`. A source audit found no web-client calls to
`api.heatSpike` or `api.reset`, and no public reset/spike/recorded-run UI
strings. Local browser QA checked the landing walkthrough at desktop width and
375px: both legal decision paths update the illustrated map, Ravi phone,
delivery owner, and audit list from the same scenario state, with no horizontal
overflow. This is local frontend verification only—no deployment, AWS action,
or shared sandbox mutation was performed.
