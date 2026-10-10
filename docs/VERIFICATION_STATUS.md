# Verification status

**Verified:** 10 October 2026  
**Source commit:** `f8c6b99c3455b1682989d26032e072ca5225bd6a`  
**Backend deployment:** `1f393fb734007a8a4e028ba7bed5c6388363d2da`  
**AWS region:** `ap-south-1`

## Current release state

The backend and public frontend are deployed. The critical intervention paths, timeout handling, idempotency, authorization failures, and reset isolation have been exercised against the live AWS resources. The remaining release gate is browser evidence from real Cognito sign-ins for all three roles, tracked in [GitHub issue #8](https://github.com/abhinav0singh/TapSaathi/issues/8).

## Local and CI verification

| Check | Result |
| --- | --- |
| Backend TypeScript | PASS |
| Vitest | PASS — 22 files, 139 tests |
| CDK synthesis | PASS |
| Step Functions definition validator | PASS |
| Next.js production build | PASS |
| GitHub Backend workflow on `main` | PASS |
| GitHub Web workflow on `main` | PASS |

The full local checks were rerun against PR #13 before merge. The Backend and Web GitHub workflows also passed on its merge commit, `f8c6b99`.

## Deployed AWS verification

| Scenario | Result | Key observation |
| --- | --- | --- |
| `TAKE_BREAK` | PASS | Delivery moved from Ravi to Asha and Ravi entered `RESTING` |
| `FEEL_UNWELL` | PASS | Delivery secured, supervisor acknowledgement accepted, execution succeeded |
| Worker timeout | PASS | Delivery secured before supervisor escalation |
| Supervisor timeout | PASS | Terminal status `SUPERVISOR_UNACKNOWLEDGED`; no stuck execution |
| Duplicate callback | PASS | Same request replayed prior result; different request rejected with `409 ALREADY_RESPONDED` |
| Duplicate event | PASS | One intervention and one delivery-reassignment effect |
| Wrong-role and missing-token requests | PASS | Rejected with `401` or `403` without advancing the generation |
| Reset during an in-flight intervention | PASS | Old execution ended `SUCCEEDED`; clean generation stayed unchanged |

Detailed identifiers and the verification boundary are recorded in [AWS verification evidence](AWS_VERIFICATION_EVIDENCE.md).

## Public deployment

- Frontend: <https://main.d6hf0wv24qbik.amplifyapp.com>
- Amplify `main`: commit `f8c6b99` — `SUCCEED`; `/`, `/login`, `/ops`, `/supervisor`, and `/worker/ravi-001` return HTTP 200
- API: <https://fkysuwgzb8.execute-api.ap-south-1.amazonaws.com>
- CloudFormation stack: `TaapSaathiStack` — `UPDATE_COMPLETE`

## Remaining acceptance gate

Real browser sessions must still prove operator, worker, and supervisor navigation and authenticated actions through Cognito and API Gateway. Direct Lambda invocations used realistic JWT claim contexts for some backend workflow tests, so those runs prove the deployed business workflow but do not replace the browser/authorizer evidence.
