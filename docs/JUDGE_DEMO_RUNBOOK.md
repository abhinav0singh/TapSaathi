# Judge guide and demo runbook

## For judges: two minutes, no sign-in needed

There is no live presentation, so everything below works without anyone on the team present.

1. Open the app at <https://main.d6hf0wv24qbik.amplifyapp.com>.
2. Choose **Explore the walkthrough**. No sign-in is needed. Trigger heat risk and follow either Ravi's break path or the supervisor follow-up path. The map, rider phone, delivery owner, and audit list are one deterministic, page-local simulation.
3. The walkthrough never reads or changes AWS, Cognito, or the operations workspace. It is not a replay and does not claim a current or historical live event.
4. The authenticated **Operations** workspace is separate and displays deployment-backed sandbox data. Its data is not controlled by the landing-page walkthrough.
5. Evidence for what was verified, and what was not, is in `docs/GOLDEN_PATH_EVIDENCE.md`.

Everything is simulated demonstration data. Sahara makes no medical claims and does not contact emergency services.

## Authenticated workspace boundary

The authenticated workspace is not a judge-controlled demo. It presents
deployment-backed sandbox data and preserves its role-bound backend actions.
Testing those workflows requires authorized accounts, coordination with the
environment owner, and separate recorded evidence. Do not use the public
walkthrough to infer a current AWS workflow state or to make a medical claim.
