# TaapSaathi project status

**Updated:** 11 October 2026  
**Current source baseline:** `a87a17b3bf4061582a0e14403782942d62301763` (PR #35 merge)  
**Backend deployment:** confirmed 11 October 2026; CloudFormation `UPDATE_COMPLETE`, Amplify `main` build `SUCCEED`  
**Historical production evidence:** PR #30 (`61836f8eb57580ba20d8c5708d5ad68c7ed123f1`) remains the protected-audio deployment baseline

## Release assessment

PR #30 is deployed correctly and its rider-audio authorization/privacy checks passed in production. The core implementation and most Phase 3 behavioral evidence are complete, but a stale execution can still fail after reset when its intervention record has already been removed. It cannot corrupt the new generation; its backend correction, deploy, and re-verification remain required. A submission-ready, redacted Step Functions graph image is also a documentation artifact if required by the final package.

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
- PR #35 release baseline checks passing: root and web typecheck, 31 Vitest files / 189 tests, 3 deterministic risk-policy tests, 16 infrastructure tests, CDK synthesis, state-machine definition validation, and Next.js production build.
- Ravi can retrieve only Ravi's protected audio; operator, supervisor, and cross-rider audio requests are rejected in production.
- Public worker and dashboard APIs expose no audio URL, expiry, or storage key; signed Polly audio downloads successfully only through the protected route.

## Phase 3 evidence boundary

[Issue #8](https://github.com/abhinav0singh/TapSaathi/issues/8) tracked the live browser evidence. On 11 October 2026, fresh Cognito sessions exercised the following hosted flows without recording passwords, tokens, callback secrets, or signed URLs:

1. Operator heat spike and active intervention in the operations view (manual browser observation; successful generation-36 execution `d33ed3c9-a765-b419-8abd-04139ac552f6_e46772c5-f792-2d9d-eee4-fb09b024c713`).
2. Ravi's Hindi active-intervention view, protected audio element, `TAKE_BREAK`, and delivery reassignment; Ravi's `RESTING` state was also viewed at 375 × 812. These are manual browser observations.
3. Ravi's `FEEL_UNWELL`, Neha's supervisor acknowledgement, and Ravi's self-declared return to work (manual browser observation; successful generation-37 execution `648edea5-abd5-51b5-78ca-003d8647deeb_7fc910bf-9b3c-8931-abe2-7ada04eab9a9`).
4. Authenticated AWS Console access to the documented stale-callback execution detail and graph.

The demonstration was reset cleanly to generation 38 afterwards: zero active
interventions, Ravi `SAFE`, and `delivery-001` assigned to Ravi. No repository
asset currently stores a redacted Step Functions graph screenshot. Create one
only if a submission package explicitly requires a persistent image artifact.

The stale-execution failure
`7163ff5c-97d8-c430-75eb-285cbd137cbc_cd3a54c8-133c-1b7a-ea48-d1174f22f0bb`
ended `FAILED` after a reset had removed its intervention. The repository
looks up the intervention before performing the generation comparison, so it
throws `NotFoundError` instead of the state machine's caught
`StaleGenerationError`. This is a known backend limitation, not a completed
Phase 3 scenario; see [AWS verification evidence](AWS_VERIFICATION_EVIDENCE.md)
for the required corrective boundary.

## Phase 4 implementation

PR #35 added a clearly labelled historical Delhi replay and audit-only
operational metrics to the operations view. It does not convert the deployed
cached-weather demo into live weather monitoring and must not be described as
such unless a separately reviewed live-weather deployment is made.

Fresh Cognito sessions manually observed operator reset/spike, Ravi break/resume, Ravi symptom report, Neha acknowledgement, protected audio, route generation, duplicate callback and EventBridge behavior, both timeout branches, and JWT role enforcement. One stale-reset path completed without corrupting the new generation, but stale-reset isolation is not fully verified: a later stale execution failed when its intervention record was absent. The recorded evidence sequence ended clean at generation 34. A later public review snapshot observed generation 36 with zero active interventions, Ravi `SAFE`, and `delivery-001` assigned to Ravi; that snapshot is not additional scenario evidence.

## Final rehearsal

For a final demonstration, run the three-minute judge flow once from a clean reset:

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
