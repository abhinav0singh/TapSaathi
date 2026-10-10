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
