# AWS timeout escalation verification

**Verified:** 10 October 2026  
**Region:** `ap-south-1`  
**Stack:** `TaapSaathiStack` (`UPDATE_COMPLETE`)  
**Deployed merge:** `e9a24abdfed713be349bf8f98065e17954bbcf96` (PR #4)

## Result

The worker-timeout path passed against the deployed AWS workflow on demo generation 7.

| Evidence | Observed value |
| --- | --- |
| Heat-risk event | `evt-39574f7d-89b8-43dc-a924-204ac89c1dd6` |
| Intervention | `int-d05cedab8034736cd545` |
| Step Functions execution | `arn:aws:states:ap-south-1:202823104630:execution:InterventionStateMachine40EE73C6-QJwhWLOBwBvm:e258fa13-8107-4c13-b709-da359aac5248_05aeaf47-4902-3e31-e17e-4c29ef1ae64a` |
| Execution status | `SUCCEEDED` |
| Started | `2026-10-09T18:55:51.269Z` |
| Finished | `2026-10-09T18:58:26.259Z` |
| Timeout audit | `SUPERVISOR_ESCALATED`, reason `WORKER_TIMEOUT` |
| Delivery audit | `DELIVERY_REASSIGNED`, `delivery-001` to `asha-001` |
| Supervisor audit | `RESPONSE_ACCEPTED`, action `SUPERVISOR_ACK` |
| Terminal audit | `INTERVENTION_COMPLETED`, status `SUPERVISOR_RESPONDING` |

Final dashboard state:

- Ravi remained `AWAITING_SUPERVISOR` and had no active task IDs.
- `delivery-001` remained assigned to Asha.
- No active intervention remained after the supervisor acknowledgement.

This proves the PR #4 invariant for the deployed timeout path: a timed-out worker no longer retains an active delivery when the workflow escalates to a supervisor.

## Verification boundary

The reset, heat-spike, and supervisor-response handlers were invoked with realistic API Gateway JWT claim contexts derived from the deployed SSM identity mapping. The Step Functions execution, DynamoDB mutations, reassignment, timeouts, and audit events were real deployed AWS resources.

This run did not exercise a browser Cognito sign-in or the API Gateway JWT authorizer. The deployed smoke script now requires real Cognito access tokens so that subsequent repeatability runs cover those boundaries as well.
