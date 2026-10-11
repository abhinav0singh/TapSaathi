# Verification status

**Verified:** 11 October 2026  
**Current source baseline:** `a87a17b3bf4061582a0e14403782942d62301763` (PR #35 merge)  
**Current backend deployment:** confirmed 11 October 2026 after the PR #35 merge  
**Historical production evidence:** PR #30 (`61836f8eb57580ba20d8c5708d5ad68c7ed123f1`)  
**AWS region:** `ap-south-1`

## Current release state

PR #30 is deployed and the protected-audio authorization checks passed in production. Current v2 evidence includes three repeatable take-break/resume runs, one symptom/escalation/acknowledgement/resume run, callback idempotency, duplicate EventBridge delivery, both callback timeouts, real Cognito/JWT negative checks, and manually observed authenticated browser flows for the operator, worker, and supervisor roles. One stale execution after reset is known to fail when its intervention has already been removed; it cannot corrupt the new generation but requires a separate backend fix.

## Local and CI verification

| Check | Result |
| --- | --- |
| Backend TypeScript | PASS |
| Vitest suite | PASS — 31 files / 189 tests |
| Standalone deterministic risk-policy tests | PASS — 3 tests |
| CDK synthesis | PASS |
| Step Functions definition validator | PASS |
| Next.js production build | PASS |
| GitHub Backend workflow on `main` | PASS |
| GitHub Web workflow on `main` | PASS |

The 11 October release baseline passed root and web typecheck, 31 Vitest files / 189 tests, 3 standalone deterministic risk-policy tests, 16 infrastructure tests, CDK synthesis, state-machine definition validation, and the production web build. Backend and Web CI were green for the reviewed PR #35 head. PR #30 remains the historical deployment baseline for the protected-audio production evidence.

## Deployed AWS verification

| Scenario | Result | Key observation |
| --- | --- | --- |
| `TAKE_BREAK` and rider resume | PASS | Three runs on generations 23–25; delivery moved from Ravi to Asha, Ravi entered `RESTING`, then returned to `SAFE` with zero active minutes while the delivery stayed with Asha |
| `FEEL_UNWELL`, acknowledgement, and rider resume | PASS | Generation 28; delivery secured, Neha acknowledged, Ravi self-declared fit and returned to `SAFE`; execution succeeded |
| Protected rider audio | PASS | Ravi `200`; operator, supervisor, and cross-rider requests `403`; signed Polly audio downloaded successfully |
| Public audio privacy | PASS | Public worker and dashboard responses exposed no audio URL, expiry, or storage key |
| Hosted pages and CORS | PASS | All main pages returned `200`; Amplify origin remained configured |
| Worker and supervisor timeout | PASS | Generation 31 secured and reassigned the delivery, escalated once, timed out unacknowledged, and completed successfully |
| Duplicate callback | PASS | Same `clientRequestId` replay returned the accepted result; a new request after consumption returned `409` |
| Duplicate EventBridge delivery | PASS | Generation 30 produced two successful executions but exactly one intervention creation and one delivery reassignment |
| Wrong-role and missing-token requests | PASS | Missing-token reset returned `401`; worker-token reset and rider impersonation returned `403` |
| Reset during an in-flight intervention | PARTIAL | Generation 32 was reset to 33 while waiting; that stale execution succeeded without altering the clean generation. A separate post-reset stale execution later failed when its intervention record was absent; see the known limitation in AWS verification evidence |

Detailed identifiers and the verification boundary are recorded in [AWS verification evidence](AWS_VERIFICATION_EVIDENCE.md).

## Public deployment

- Frontend: <https://main.d6hf0wv24qbik.amplifyapp.com>
- Amplify `main`: build `SUCCEED`; all main pages returned HTTP `200`
- API: <https://fkysuwgzb8.execute-api.ap-south-1.amazonaws.com>
- CloudFormation stack: `TaapSaathiStack` — `UPDATE_COMPLETE`

The recorded evidence sequence ended with a reset to generation 34 with zero active interventions, Ravi `SAFE`, and `delivery-001` assigned to Ravi. A later public review snapshot observed generation 36 in the same clean state; it is a readiness baseline rather than additional scenario evidence. On 11 October, authenticated browser actions were exercised against the hosted application and the demo was reset cleanly to generation 38. The deliberate generation 32 to 33 in-flight reset proved stale-callback isolation.

## Remaining acceptance gate

Authenticated Cognito sessions manually observed the hosted operator spike flow, Ravi's Hindi active-intervention view and protected audio element, Ravi's `TAKE_BREAK` reassignment, the `FEEL_UNWELL` escalation, Neha's acknowledgement, and Ravi's self-declared return. The successful operator/`TAKE_BREAK` flow ran in generation 36 (`d33ed3c9-a765-b419-8abd-04139ac552f6_e46772c5-f792-2d9d-eee4-fb09b024c713`); the successful symptom/acknowledgement flow ran in generation 37 (`648edea5-abd5-51b5-78ca-003d8647deeb_7fc910bf-9b3c-8931-abe2-7ada04eab9a9`). Ravi's `RESTING` view was also checked manually at 375 × 812; the Hindi, audio-element, and viewport details are not independently confirmed by AWS records. The AWS Console execution detail and graph for the documented stale-callback run were opened under an authenticated AWS role. A permanently stored, redacted Step Functions graph screenshot is still needed if the submission package requires a file artifact; no browser or AWS screenshot containing account metadata, tokens, or signed URLs is stored in this repository. The stale-execution failure at `7163ff5c-97d8-c430-75eb-285cbd137cbc_cd3a54c8-133c-1b7a-ea48-d1174f22f0bb` is a known limitation, documented in [AWS verification evidence](AWS_VERIFICATION_EVIDENCE.md). Direct Lambda invocations used realistic JWT claim contexts for some backend workflow tests, so those runs complement rather than replace the browser and authorizer evidence.
