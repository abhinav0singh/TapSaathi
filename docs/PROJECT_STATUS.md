# TaapSaathi project status

**Updated:** 10 October 2026  
**Current source:** `main` after PR #29 (`d33eb36`)  
**Backend deployment:** post-PR #22 backend deployment status not fully confirmed

## Release assessment

The core implementation is complete and the public API/frontend are reachable. The v2 take-break and symptom flows are recorded, but the remaining AWS gates must be re-run before the project can claim complete deployed verification.

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
- Local verification passing: 148 unit tests, TypeScript, CDK synthesis, definition validation, and Next.js production build.

## Open release gate

[Issue #8](https://github.com/abhinav0singh/TapSaathi/issues/8) requires live browser evidence for all three real Cognito roles:

1. Operator signs in and successfully performs reset and heat spike.
2. Ravi signs in, sees the live intervention, and submits a response.
3. Neha signs in, sees the escalation, and acknowledges it.
4. Worker and supervisor layouts are checked at a mobile viewport.
5. The tested commit, browser sizes, API URL, and screenshots are recorded without secrets.

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
