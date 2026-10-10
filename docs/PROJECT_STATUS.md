# TaapSaathi project status

**Updated:** 10 October 2026  
**Current source and deployment:** `main` at `61836f8eb57580ba20d8c5708d5ad68c7ed123f1` (PR #30 merge)  
**Backend deployment:** confirmed; CloudFormation `UPDATE_COMPLETE`, Amplify build `SUCCEED`

## Release assessment

PR #30 is deployed correctly and its rider-audio authorization/privacy checks passed in production. The core implementation is complete, but the broader Phase 3 workflow evidence remains incomplete.

## Completed

- AWS CDK stack deployed in `ap-south-1`.
- Next.js frontend hosted on AWS Amplify with the Leaflet operations map from PR #18 deployed successfully.
- Public product landing page and presentation refresh tracked in issue #19.
- Cognito operator, worker, and supervisor groups configured.
- Role-aware login, route guards, worker identity derivation, sign-out, and expired-session recovery merged.
- API Gateway JWT authorization and server-side subject-to-role mapping enabled for all mutations.
- EventBridge, Standard Step Functions, DynamoDB, Amazon Location, Polly, private S3, CloudWatch, and X-Ray integrated.
- Safe delivery handling implemented before supervisor escalation.
- `TAKE_BREAK` and `FEEL_UNWELL` with supervisor acknowledgment and audited self-resume recorded against heat-policy-v2.
- Backend and Web GitHub Actions checks passing on `main`.
- Deployed release checks passing: typecheck, 180 unit tests, 16 infrastructure tests, CDK synthesis, and Next.js production build.
- Ravi can retrieve only Ravi's protected audio; operator, supervisor, and cross-rider audio requests are rejected in production.
- Public worker and dashboard APIs expose no audio URL, expiry, or storage key; signed Polly audio downloads successfully only through the protected route.

## Remaining Phase 3 evidence

[Issue #8](https://github.com/abhinav0singh/TapSaathi/issues/8) and the remaining workflow scenarios require live evidence:

1. Worker and supervisor layouts are checked in real browsers at a mobile viewport.
2. The tested commit, browser sizes, API URL, and screenshots are recorded without secrets.
3. Step Functions graph screenshots and browser evidence are captured for the submission package.

Fresh Cognito sessions have now proved operator reset/spike, Ravi break/resume, Ravi symptom report, Neha acknowledgement, protected audio, route generation, duplicate callback and EventBridge behavior, both timeout branches, stale-reset isolation, and JWT role enforcement. The demo is clean at generation 34 with zero active interventions.

## Final rehearsal

After issue #8 passes, run the three-minute judge flow once from a clean reset:

1. Explain the worker-safety problem and show the operator view.
2. Trigger the simulated heat spike.
3. Show the real Step Functions execution and Ravi's bilingual route/audio guidance.
4. Submit `TAKE_BREAK` and show delivery reassignment.
5. Reset, demonstrate `FEEL_UNWELL`, and show supervisor escalation.
6. Close with the audit trail, generation isolation, and AWS architecture.

## Evidence

- [Full verification status](VERIFICATION_STATUS.md)
- [AWS scenario evidence](AWS_VERIFICATION_EVIDENCE.md)
- [Judge demo runbook](JUDGE_DEMO_RUNBOOK.md)
- [Worker-timeout evidence](AWS_TIMEOUT_ESCALATION_VERIFICATION.md)
- [Known limitations](KNOWN_LIMITATIONS.md)
