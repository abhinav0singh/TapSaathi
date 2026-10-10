# Verification status

**Verified:** 10 October 2026  
**Source baseline and deployed commit:** `61836f8eb57580ba20d8c5708d5ad68c7ed123f1` (PR #30 merge)  
**Backend deployment:** confirmed on the deployed PR #30 release  
**AWS region:** `ap-south-1`

## Current release state

PR #30 is deployed and the protected-audio authorization checks passed in production. The v2 evidence records one take-break run and one symptom/escalation/resume run. Timeout, duplicate, stale-callback, reset-isolation, and the broader Phase 3 browser evidence remain unverified.

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
| `TAKE_BREAK` | PASS | Delivery moved from Ravi to Asha and Ravi entered `RESTING` |
| `FEEL_UNWELL` | PASS | Delivery secured, supervisor acknowledgement accepted, execution succeeded |
| Protected rider audio | PASS | Ravi `200`; operator, supervisor, and cross-rider requests `403`; signed Polly audio downloaded successfully |
| Public audio privacy | PASS | Public worker and dashboard responses exposed no audio URL, expiry, or storage key |
| Hosted pages and CORS | PASS | All main pages returned `200`; Amplify origin remained configured |
| Worker and supervisor timeout | NOT VERIFIED under v2 | Earlier evidence predates the reading-driven policy |
| Duplicate callback and event | NOT VERIFIED under v2 | Must replay against the current deployment |
| Wrong-role and missing-token requests | NOT VERIFIED on this release | Unit coverage exists; deploy-time proof is still needed |
| Reset during an in-flight intervention | NOT VERIFIED under v2 | Must confirm stale callback isolation on the deployed workflow |

Detailed identifiers and the verification boundary are recorded in [AWS verification evidence](AWS_VERIFICATION_EVIDENCE.md).

## Public deployment

- Frontend: <https://main.d6hf0wv24qbik.amplifyapp.com>
- Amplify `main`: build `SUCCEED`; all main pages returned HTTP `200`
- API: <https://fkysuwgzb8.execute-api.ap-south-1.amazonaws.com>
- CloudFormation stack: `TaapSaathiStack` — `UPDATE_COMPLETE`

The demo was reset after verification and has zero active interventions. One immediate reset returned `500` while a workflow was completing; retry succeeded and the final state was clean. This transient behavior is recorded for Phase 3 investigation, not treated as a clean reset-isolation verification.

## Remaining acceptance gate

Real browser sessions must still prove operator, worker, and supervisor navigation and authenticated actions through Cognito and API Gateway. Direct Lambda invocations used realistic JWT claim contexts for some backend workflow tests, so those runs prove the deployed business workflow but do not replace the browser/authorizer evidence.
