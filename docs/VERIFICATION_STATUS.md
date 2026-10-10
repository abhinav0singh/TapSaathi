# Verification status

**Verified:** 10 October 2026  
**Source baseline and deployed commit:** `61836f8eb57580ba20d8c5708d5ad68c7ed123f1` (PR #30 merge)  
**Backend deployment:** confirmed on the deployed PR #30 release  
**AWS region:** `ap-south-1`

## Current release state

PR #30 is deployed and the protected-audio authorization checks passed in production. Current v2 evidence includes three repeatable take-break/resume runs, one symptom/escalation/acknowledgement/resume run, callback idempotency, duplicate EventBridge delivery, both callback timeouts, stale-reset isolation, and real Cognito/JWT negative checks. Only the broader Phase 3 browser/mobile evidence remains unverified.

## Local and CI verification

| Check | Result |
| --- | --- |
| Backend TypeScript | PASS |
| Unit tests | PASS — 180 tests |
| CDK synthesis | PASS |
| Step Functions definition validator | PASS |
| Next.js production build | PASS |
| GitHub Backend workflow on `main` | PASS |
| GitHub Web workflow on `main` | PASS |

The deployed release passed typecheck, 180 unit tests, 16 infrastructure tests, CDK synthesis, and the production web build. Backend and Web CI are green for the merged release.

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
| Reset during an in-flight intervention | PASS | Generation 32 was reset to 33 while waiting; the stale execution succeeded without altering the clean generation |

Detailed identifiers and the verification boundary are recorded in [AWS verification evidence](AWS_VERIFICATION_EVIDENCE.md).

## Public deployment

- Frontend: <https://main.d6hf0wv24qbik.amplifyapp.com>
- Amplify `main`: build `SUCCEED`; all main pages returned HTTP `200`
- API: <https://fkysuwgzb8.execute-api.ap-south-1.amazonaws.com>
- CloudFormation stack: `TaapSaathiStack` — `UPDATE_COMPLETE`

The recorded evidence sequence ended with a reset to generation 34 with zero active interventions, Ravi `SAFE`, and `delivery-001` assigned to Ravi. A later public review snapshot observed generation 36 in the same clean state; it is a readiness baseline rather than additional scenario evidence. The deliberate generation 32 to 33 in-flight reset proved stale-callback isolation, and the final evidence reset succeeded on its first attempt.

## Remaining acceptance gate

Real browser sessions must still prove operator, worker, and supervisor navigation and authenticated actions through Cognito and API Gateway. An authenticated Ravi worker view was checked at a 375 × 812 viewport on 11 October 2026 in English and Hindi, while the demo was `SAFE`; that is a responsive clean-state baseline only, not active-flow proof or a submission screenshot. Chrome had no authenticated AWS Console session, so a redacted Step Functions execution-graph capture is also still required. Direct Lambda invocations used realistic JWT claim contexts for some backend workflow tests, so those runs prove the deployed business workflow but do not replace the browser/authorizer evidence.
