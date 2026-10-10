# Verification status

**Verified:** 10 October 2026  
**Source baseline:** `main` after PR #29 (`d33eb36`)  
**Backend deployment:** not confirmed to include every post-PR #22 backend change  
**AWS region:** `ap-south-1`

## Current release state

The public frontend and API are reachable. The v2 evidence records one take-break run and one symptom/escalation/resume run. Timeout, duplicate, stale-callback, reset-isolation, and full browser-role evidence must be re-run against v2 before being reported as verified.

## Local and CI verification

| Check | Result |
| --- | --- |
| Backend TypeScript | PASS |
| Unit tests | PASS — 25 files, 148 tests |
| CDK synthesis | PASS |
| Step Functions definition validator | PASS |
| Next.js production build | PASS |
| GitHub Backend workflow on `main` | PASS |
| GitHub Web workflow on `main` | PASS |

The full local checks were rerun for the rider-resume release candidate. The Backend and Web GitHub workflows remain required on the final PR head before merge.

## Deployed AWS verification

| Scenario | Result | Key observation |
| --- | --- | --- |
| `TAKE_BREAK` | PASS | Delivery moved from Ravi to Asha and Ravi entered `RESTING` |
| `FEEL_UNWELL` | PASS | Delivery secured, supervisor acknowledgement accepted, execution succeeded |
| Worker and supervisor timeout | NOT VERIFIED under v2 | Earlier evidence predates the reading-driven policy |
| Duplicate callback and event | NOT VERIFIED under v2 | Must replay against the current deployment |
| Wrong-role and missing-token requests | NOT VERIFIED on this release | Unit coverage exists; deploy-time proof is still needed |
| Reset during an in-flight intervention | NOT VERIFIED under v2 | Must confirm stale callback isolation on the deployed workflow |

Detailed identifiers and the verification boundary are recorded in [AWS verification evidence](AWS_VERIFICATION_EVIDENCE.md).

## Public deployment

- Frontend: <https://main.d6hf0wv24qbik.amplifyapp.com>
- Amplify `main`: `/demo` returned HTTP 200 on 10 October 2026; browser-role actions remain unverified
- API: <https://fkysuwgzb8.execute-api.ap-south-1.amazonaws.com>
- CloudFormation stack: `TaapSaathiStack` — `UPDATE_COMPLETE`

## Remaining acceptance gate

Real browser sessions must still prove operator, worker, and supervisor navigation and authenticated actions through Cognito and API Gateway. Direct Lambda invocations used realistic JWT claim contexts for some backend workflow tests, so those runs prove the deployed business workflow but do not replace the browser/authorizer evidence.
