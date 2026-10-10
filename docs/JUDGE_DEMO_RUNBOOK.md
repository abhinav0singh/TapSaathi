# Judge demo runbook

Use this runbook only after the three-role browser evidence in issue #8 passes. Keep operator, Ravi, and Neha signed in through separate browser profiles so role changes do not consume demo time.

## Five-minute preflight

1. Confirm <https://main.d6hf0wv24qbik.amplifyapp.com> and the `/health` API return successfully.
2. Sign in as `demo-operator`, `demo-ravi`, and `demo-neha` in separate browser profiles. Never record or display passwords or tokens.
3. From the operator view, reset the demo and confirm Ravi is `SAFE`, `delivery-001` belongs to Ravi, and no intervention is active.
4. Open the Step Functions state machine in AWS so its live execution is one click away.
5. Keep the architecture diagram and a successful backup recording available in separate tabs.

## Three-minute presentation

| Time | Screen | Action and narration |
| --- | --- | --- |
| 0:00–0:20 | Operator | State the problem: heat exposure can make a rider unsafe while an active delivery still needs responsible handling. |
| 0:20–0:40 | Architecture | Point out EventBridge, Standard Step Functions, Cognito, DynamoDB, Amazon Location, Polly, and Amplify. Explain that the UI observes the workflow; it does not manufacture the safety result. |
| 0:40–1:00 | Operator | Trigger the labelled heat spike. Show Ravi moving from `SAFE` into an active intervention. |
| 1:00–1:30 | Ravi mobile view | Show Hindi/English guidance, route summary, audio, and the two large actions. Submit **Take break**. |
| 1:30–1:55 | Operator | Show `delivery-001` reassigned to Asha, Ravi `RESTING`, and the audit timeline. Briefly show the succeeded Step Functions execution. |
| 1:55–2:25 | Operator and Ravi | Reset, trigger another heat spike, and submit **I feel unwell**. Explain that the delivery is secured before escalation. |
| 2:25–2:45 | Neha | Acknowledge the escalation. Show the confirmation added by PR #13 and state clearly that acknowledgment does not clear Ravi to resume work. |
| 2:45–3:00 | Evidence | Close with generation isolation, duplicate protection, wrong-role rejection, and the saved AWS execution evidence. |

## Pass conditions

- Every state-changing request uses the expected Cognito role.
- Ravi never keeps an active delivery after taking a break or escalating.
- Supervisor acknowledgment remains distinct from worker clearance.
- The audit timeline and Step Functions execution agree with the visible result.
- Reset returns the demo to one clean generation with no active intervention.

## Recovery during judging

- If a browser session expires, use the role's `/login` flow and continue from the current backend state.
- If a page stops polling, refresh it; the state is stored in DynamoDB and Step Functions, not the browser.
- If a callback has already been consumed, reset and rerun rather than submitting a different request ID against the old intervention.
- If the venue network fails, show the backup recording and the saved AWS evidence. Do not claim a live result while offline.

## Evidence to capture after rehearsal

- Operator heat-spike and reassignment screen.
- Ravi mobile guidance and accepted response.
- Neha acknowledgment and the post-acknowledgment warning.
- Succeeded Step Functions execution.
- Audit timeline showing response, delivery handling, escalation, and completion.
- Tested commit SHA, browser names, viewport sizes, and rehearsal time.
