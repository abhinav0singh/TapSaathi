# AWS verification evidence

**Verified:** 9–10 October 2026  
**Region:** `ap-south-1`  
**Stack:** `TaapSaathiStack`  
**Backend deployed commit:** `1f393fb734007a8a4e028ba7bed5c6388363d2da`

## Deployment

PR #11 was deployed on 10 October 2026. CloudFormation reached `UPDATE_COMPLETE` and kept the established API, Cognito pool, DynamoDB table, EventBridge bus, and Step Functions state machine. The deployed definition contains a `StaleGenerationError` catch on every Lambda-backed workflow state and routes expected stale work to `StaleGenerationComplete`.

## Scenario results

| Scenario | Generation | Result | Evidence |
| --- | ---: | --- | --- |
| `TAKE_BREAK` golden path | 5 | PASS | Intervention `int-e8bdd51699327d8e1497`; delivery reassigned to Asha; Ravi `RESTING`; six audit events |
| Worker timeout and supervisor acknowledgement | 7 | PASS | Intervention `int-d05cedab8034736cd545`; execution ended `SUCCEEDED`; delivery reassigned before escalation |
| `FEEL_UNWELL` and supervisor acknowledgement | 8 | PASS | Event `evt-1af1da74-8cee-49be-8028-eeccef340024`; intervention `int-fd4e8c40ad6600c50c18`; execution ended `SUCCEEDED` |
| Supervisor timeout | 9 | PASS | Event `evt-c391b70e-9b2d-4923-a5f4-edafa3a67030`; intervention `int-c535d41fd66cdaca2fa3`; terminal status `SUPERVISOR_UNACKNOWLEDGED` |
| Duplicate callback | 8 | PASS | Same `clientRequestId` returned the accepted result; a new request returned `409 ALREADY_RESPONDED` |
| Duplicate EventBridge envelope | 9 | PASS | Both replay executions succeeded; only one intervention and one reassignment audit existed |
| Authorization failures | 9 | PASS | Missing JWT `401`; wrong role, impersonation, and unmapped identity `403`; no generation change |
| Reset isolation after PR #11 | 12 → 13 | PASS | Stale execution ended `SUCCEEDED`; generation 13 had zero active interventions, Ravi `SAFE`, and `delivery-001` assigned to Ravi |

## Execution identifiers

- Worker timeout: `arn:aws:states:ap-south-1:202823104630:execution:InterventionStateMachine40EE73C6-QJwhWLOBwBvm:e258fa13-8107-4c13-b709-da359aac5248_05aeaf47-4902-3e31-e17e-4c29ef1ae64a`
- `FEEL_UNWELL`: `arn:aws:states:ap-south-1:202823104630:execution:InterventionStateMachine40EE73C6-QJwhWLOBwBvm:80d92807-1933-040c-3e0c-268874792c5f_331c5f3f-9a81-deb7-4559-f213d7155430`
- Supervisor timeout: `arn:aws:states:ap-south-1:202823104630:execution:InterventionStateMachine40EE73C6-QJwhWLOBwBvm:db5d9309-180c-4bf2-7260-b77ad233d290_69c04155-6fd3-449b-147c-89d334880e8e`
- Post-PR #11 stale reset: `arn:aws:states:ap-south-1:202823104630:execution:InterventionStateMachine40EE73C6-QJwhWLOBwBvm:d0413be5-11ac-bbee-0dc4-297ec4fb6f8c_9762601c-c792-9c5d-2402-80609b5b8f5c`

## Post-PR #11 stale-reset proof

The test reset the demo into generation 12, started a heat-risk intervention, waited until the workflow reached `AWAITING_WORKER`, and reset again into generation 13. After the original 120-second callback timer expired:

- the old Step Functions execution ended `SUCCEEDED` through `StaleGenerationComplete`;
- generation 13 still had zero active interventions;
- Ravi remained `SAFE`;
- `delivery-001` remained assigned to Ravi.

This closes the failure observed before PR #11, where expected stale work ended as a failed execution even though it could not corrupt the new generation.

## Verification boundary

The Step Functions executions, EventBridge delivery, DynamoDB mutations, reassignment, timeout behavior, and reset isolation above used real deployed AWS resources. Several workflow tests invoked API Lambda handlers with realistic API Gateway JWT claim contexts derived from the encrypted runtime identity mapping. Separate negative tests exercised API Gateway's missing and invalid JWT rejection.

The remaining browser gate is a successful real Cognito sign-in and action for each role through the Amplify application. That evidence is tracked in [issue #8](https://github.com/abhinav0singh/TapSaathi/issues/8). No password, JWT, callback token, or SSM value is stored in this document.

## Current-release Phase 3 evidence — 11 October 2026

The deployed PR #30 release (`61836f8eb57580ba20d8c5708d5ad68c7ed123f1`)
was exercised through API Gateway with fresh Cognito access tokens held only in
process memory.

- Three `TAKE_BREAK` then rider-resume runs passed on generations 23–25. All
  used `AMAZON_LOCATION`, returned protected rider audio, reassigned the active
  delivery to Asha, completed in Step Functions, and returned Ravi to `SAFE`
  without reclaiming the delivery.
- Generation 28 passed `FEEL_UNWELL`, Neha's supervisor acknowledgement, and
  Ravi's self-declared resume. The delivery remained assigned to Asha.
- Missing-token reset returned `401`; worker-token reset and Ravi-as-Asha
  response returned `403`.
- Replaying the same callback request stayed idempotent; sending a new request
  after callback consumption returned `409`.
- The final reset created generation 29 with zero active interventions, Ravi
  `SAFE`, and `delivery-001` assigned to Ravi.

Step Functions executions:

- Break/resume generation 23: `arn:aws:states:ap-south-1:202823104630:execution:InterventionStateMachine40EE73C6-QJwhWLOBwBvm:494bea49-f5c6-6ab3-6b8f-bcaf426d6582_4bb81326-19a0-4f9d-0db2-53876aa2d0b7`
- Break/resume generation 24: `arn:aws:states:ap-south-1:202823104630:execution:InterventionStateMachine40EE73C6-QJwhWLOBwBvm:97e03a7e-7ef3-b427-5561-babfcc8c814c_0b0c70c9-233a-2e18-ace8-d8cfa09be8f7`
- Break/resume generation 25: `arn:aws:states:ap-south-1:202823104630:execution:InterventionStateMachine40EE73C6-QJwhWLOBwBvm:7a597279-9b38-cd59-0405-1da73d1a7068_7dba6ab3-99bd-c994-07f0-1d211cac4ae8`
- Symptom/acknowledgement/resume generation 28: `arn:aws:states:ap-south-1:202823104630:execution:InterventionStateMachine40EE73C6-QJwhWLOBwBvm:f43cef9e-2cfa-6fc9-54f8-14a178eeb220_3b4735bd-d29d-2d64-8b10-0be9c6ac9ad7`

### Remaining backend scenarios

- **Duplicate EventBridge delivery, generation 30:** replaying the same
  `HeatRiskRaised` envelope started two Step Functions executions. Both ended
  `SUCCEEDED`, while DynamoDB contained exactly one `INTERVENTION_CREATED` and
  one `DELIVERY_REASSIGNED` audit event for intervention
  `int-97456278169d91787069`.
  - `arn:aws:states:ap-south-1:202823104630:execution:InterventionStateMachine40EE73C6-QJwhWLOBwBvm:f144a9c9-477d-19a3-3caf-e82c2f70b634_b457f1a2-2a97-5d30-8d28-2731087f9ded`
  - `arn:aws:states:ap-south-1:202823104630:execution:InterventionStateMachine40EE73C6-QJwhWLOBwBvm:b43d2d3c-816f-06c5-a9c0-4300e6ed9552_86256b7d-fca7-d261-cab3-fc80a20f4eab`
- **Worker and supervisor timeout, generation 31:** worker timeout secured and
  reassigned the delivery, escalated exactly once, and then the supervisor
  callback timed out. The execution ended `SUCCEEDED` with terminal status
  `SUPERVISOR_UNACKNOWLEDGED`; Ravi remained `AWAITING_SUPERVISOR` and the
  delivery remained with Asha.
  - `arn:aws:states:ap-south-1:202823104630:execution:InterventionStateMachine40EE73C6-QJwhWLOBwBvm:f74e0bb8-afb5-dc6a-1bbe-74a0e3d6effa_5b29ced3-63d4-4962-d4aa-cd5b61314661`
- **Stale callback after reset, generations 32 to 33:** the demo was reset
  while the old execution waited for Ravi. After its timeout, the stale
  execution ended `SUCCEEDED` through the generation guard. Generation 33
  remained clean with zero active interventions, Ravi `SAFE`, and the delivery
  assigned to Ravi.
  - `arn:aws:states:ap-south-1:202823104630:execution:InterventionStateMachine40EE73C6-QJwhWLOBwBvm:9eec45af-229c-d25c-a939-e5507bf601ba_963fa98a-d9be-458c-a78c-6482660be0c6`

The final reset created generation 34 in the same clean state. Current-release
backend Phase 3 scenarios are now verified. Step Functions graph screenshots
and the real-browser/mobile acceptance gate remain to be captured.
