# Judge guide and demo runbook

## For judges: two minutes, no live demo needed

There is no live presentation, so everything below works without anyone on the team present.

1. Open the app at <https://main.d6hf0wv24qbik.amplifyapp.com>.
2. Choose **Recorded run** (landing page, top navigation or the sign-in page). No sign-in is needed. Step through either the *Rider takes a break* or the *Rider feels unwell* run. Each step is a real audit event written by the deployed AWS workflow, and the page says plainly that it is a replay.
3. Open **Operations** for the read-only live board. It shows the current simulated demo state; the actions need an account.
4. To try the actions yourself, sign in with `demo-operator` (trigger a heat spike), `demo-ravi` (rider screen) or `demo-neha` (supervisor). The demo password is in the submission writeup and is not stored in this repository. After a run, use **Reset** on the operations board.
5. Evidence for what was verified, and what was not, is in `docs/GOLDEN_PATH_EVIDENCE.md`.

Everything is simulated demonstration data. TaapSaathi makes no medical claims and does not contact emergency services.

## For the team: recording the demo video

Keep operator, Ravi, and Neha signed in through separate browser profiles so role changes do not consume recording time.

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
| 0:20–0:35 | Architecture | Point out EventBridge, Standard Step Functions, Cognito, DynamoDB, Amazon Location, Polly, and Amplify. Explain that the UI observes the workflow; it does not manufacture the safety result. |
| 0:35–0:50 | Operator | Trigger the labelled heat spike. Show Ravi moving from `SAFE` into an active intervention. |
| 0:50–1:15 | Ravi mobile view | Show Hindi/English guidance, route summary, audio, and the two large actions. Submit **Take break**. |
| 1:15–1:35 | Operator | Show `delivery-001` reassigned to Asha, Ravi `RESTING`, and the completed workflow in the audit timeline. |
| 1:35–1:50 | Ravi mobile view | After explaining that Ravi has rested and hydrated, select **I am ready to resume work**. |
| 1:50–2:05 | Operator | Show Ravi back in `SAFE` with zero continuous active minutes. Point out that `delivery-001` stays with Asha; Ravi is available for new work and does not reclaim the old delivery. |
| 2:05–2:20 | Operator | Reset and trigger another heat spike. |
| 2:20–2:35 | Ravi mobile view | Submit **I feel unwell**. Explain that the delivery is secured before escalation. |
| 2:35–2:50 | Neha | Acknowledge the escalation. State clearly that acknowledgment assigns human follow-up and does not medically clear Ravi to work. |
| 2:50–3:00 | Evidence | Close with the audit trail, duplicate protection, wrong-role rejection, and saved AWS execution evidence. |

## How Ravi returns to work

- **After `TAKE_BREAK`:** Ravi rests and hydrates, then uses the authenticated **I am ready to resume work** action. TaapSaathi records `RIDER_RESUMED_WORK`, changes Ravi from `RESTING` to `SAFE`, and resets continuous active minutes to zero.
- **Delivery ownership:** `delivery-001` remains with Asha. Ravi becomes available for new work; the system never silently takes the reassigned delivery back.
- **After `FEEL_UNWELL`:** once the supervisor acknowledges, Ravi can resume by ticking "I feel well enough" and using **I am ready to resume work**. The audit event records `afterSymptomReport` and `selfDeclaredFit`. Supervisor acknowledgment means a human has taken responsibility for follow-up; it is not a medical clearance.
- **After a timeout with no supervisor acknowledgment:** Ravi cannot self-resume, because no human has seen the report.

## Pass conditions

- Every state-changing request uses the expected Cognito role.
- Ravi never keeps an active delivery after taking a break or escalating.
- Ravi can resume only after a completed break, or after a supervisor-acknowledged symptom report with his confirmation, and resuming never reclaims the reassigned delivery.
- Supervisor acknowledgment is not a medical clearance; the rider's resume confirmation is self-declared and audited.
- The audit timeline and Step Functions execution agree with the visible result.
- Reset returns the demo to one clean generation with no active intervention.

## Recovery during judging

- If a browser session expires, use the role's `/login` flow and continue from the current backend state.
- If a page stops polling, refresh it; the state is stored in DynamoDB and Step Functions, not the browser.
- If a callback has already been consumed, reset and rerun rather than submitting a different request ID against the old intervention.
- If the resume action does not appear, confirm Ravi is signed in as `demo-ravi`, the break workflow has completed, and his state is `RESTING`. Refresh once before resetting.
- If the venue network fails, show the backup recording and the saved AWS evidence. Do not claim a live result while offline.

## Evidence to capture after rehearsal

- Operator heat-spike and reassignment screen.
- Ravi mobile guidance and accepted response.
- Neha acknowledgment and the post-acknowledgment warning.
- Succeeded Step Functions execution.
- Audit timeline showing response, delivery handling, escalation, and completion.
- Tested commit SHA, browser names, viewport sizes, and rehearsal time.
