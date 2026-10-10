# Golden path evidence (deployed, heat-policy-v2)

Observed on the deployed `TaapSaathiStack` (ap-south-1) on 10 October 2026 by reading the public `GET /events` and `GET /dashboard` endpoints during live runs. The reset action removes older generations from `GET /events`, so these records are copied here before they are lost.

Not captured yet: Step Functions execution ARNs for these runs (the verification role cannot list executions). Add them from the AWS console; Standard workflow history is retained for 90 days.

## Run 1: take break (demo generation 17)

Intervention `int-752e81bf264ea779864d`. Rider signed in through Cognito as `demo-ravi`.

| Time (UTC) | Event | Detail |
| --- | --- | --- |
| 16:22:11 | `INTERVENTION_CREATED` | `heat-policy-v2`, rule `HEAT_THRESHOLD_WITH_ACTIVE_EXPOSURE`, HIGH, no official alert set |
| 16:22:13 | `GUIDANCE_PREPARED` | route provider `AMAZON_LOCATION` (3,741 m, 804 s), Polly audio created and fetchable |
| 16:22:14 | `WORKER_RESPONSE_REQUESTED` | 120 s timeout |
| 16:23:12 | `RESPONSE_ACCEPTED` | actor `WORKER`, action `TAKE_BREAK` |
| 16:23:13 | `DELIVERY_REASSIGNED` | `delivery-001` to `asha-001` |
| 16:23:14 | `INTERVENTION_COMPLETED` | `COMPLETED` |

Final state: Ravi `RESTING`, Asha `SAFE`, `delivery-001` with Asha, no active intervention.

## Run 2: feel unwell, supervisor acknowledgement, rider resume (demo generation 20)

| Time (UTC) | Event | Detail |
| --- | --- | --- |
| 16:40:35 | `INTERVENTION_CREATED` | `heat-policy-v2`, rule `HEAT_THRESHOLD_WITH_ACTIVE_EXPOSURE` |
| 16:40:36 | `GUIDANCE_PREPARED` | route provider `AMAZON_LOCATION` |
| 16:40:37 | `WORKER_RESPONSE_REQUESTED` | |
| 16:40:45 | `RESPONSE_ACCEPTED` | actor `WORKER` `ravi-001`, action `FEEL_UNWELL` |
| 16:40:46 | `DELIVERY_REASSIGNED` | to `asha-001`, before escalation |
| 16:40:47 | `SUPERVISOR_ESCALATED` | reason `FEEL_UNWELL` |
| 16:40:47 | `SUPERVISOR_RESPONSE_REQUESTED` | |
| 16:41:12 | `RESPONSE_ACCEPTED` | actor `SUPERVISOR` `supervisor-neha-001`, action `SUPERVISOR_ACK` |
| 16:41:13 | `INTERVENTION_COMPLETED` | terminal status `SUPERVISOR_RESPONDING` |
| 16:41:22 | `RIDER_RESUMED_WORK` | `previousState` `AWAITING_SUPERVISOR`, `afterSymptomReport` true, `selfDeclaredFit` true |

Final state: Ravi `SAFE`, `delivery-001` with Asha, no active intervention.

## What this shows

- The policy decided from the readings (45.2 C air, 49.1 C apparent) with no official alert.
- Real Cognito sign-in worked for a rider and a supervisor through the API Gateway JWT authorizer.
- Amazon Location routing, Polly audio, EventBridge, Step Functions, DynamoDB reassignment and supervisor escalation ran on AWS.
- A rider can resume after a supervisor-acknowledged symptom report, with an audited self-declaration.

## What this does not show

- Only one take-break run and one unwell run were recorded. Three consecutive clean runs of the take-break path are not yet recorded.
- The resume-after-break path was not re-run after the post-symptom resume change.
- Duplicate-event replay, stale-callback-after-reset, and the timeout escalation under policy v2 are not yet verified.
- Execution ARNs are not recorded.
