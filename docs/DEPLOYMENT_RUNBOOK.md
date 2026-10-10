# TaapSaathi deployment and evidence runbook

This runbook produces real AWS evidence in `ap-south-1`. Replace shell variables only with values returned by CloudFormation. Never invent an ARN or endpoint.

## 1. Prerequisites and identity

Required locally: Node.js 22, npm, AWS CLI v2, `jq`, and an AWS profile allowed to deploy the documented services.

```bash
aws configure sso --profile taapsaathi-dev
aws sso login --profile taapsaathi-dev
aws sts get-caller-identity --profile taapsaathi-dev
```

Set non-secret shell variables:

```bash
export AWS_PROFILE=taapsaathi-dev
export AWS_REGION=ap-south-1
export STACK_NAME=TaapSaathiStack
export FRONTEND_ORIGINS=http://localhost:3000
```

The identity command must show the intended account. It does not print secret credentials.

The mutation routes require Cognito access tokens. Obtain current tokens through the demo sign-in flow and keep them only in the local shell environment:

```bash
export OPERATOR_ACCESS_TOKEN='<operator access token>'
export WORKER_ACCESS_TOKEN='<Ravi access token>'
export SUPERVISOR_ACCESS_TOKEN='<supervisor access token>'
```

Do not save tokens in repository files or evidence artifacts.

## 2. Install, verify, synthesize, and deploy

```bash
npm install
npm run test:risk:zero-dependency
npm run typecheck
npm run lint
npm run test:unit
npm run test:infra
npx cdk bootstrap "aws://$(aws sts get-caller-identity --query Account --output text)/ap-south-1"
npm run synth
npm run verify:definition
npm run deploy
```

Capture stack outputs:

```bash
mkdir -p evidence
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --query 'Stacks[0].Outputs' \
  --output json > evidence/stack-outputs.json

export API_URL="$(jq -r '.[] | select(.OutputKey=="ApiUrl") | .OutputValue' evidence/stack-outputs.json)"
export TABLE_NAME="$(jq -r '.[] | select(.OutputKey=="TableName") | .OutputValue' evidence/stack-outputs.json)"
export STATE_MACHINE_ARN="$(jq -r '.[] | select(.OutputKey=="StateMachineArn") | .OutputValue' evidence/stack-outputs.json)"
export AUDIO_BUCKET_NAME="$(jq -r '.[] | select(.OutputKey=="AudioBucketName") | .OutputValue' evidence/stack-outputs.json)"
export EVENT_BUS_NAME="$(jq -r '.[] | select(.OutputKey=="EventBusName") | .OutputValue' evidence/stack-outputs.json)"
export WEATHER_SCHEDULE_NAME="$(jq -r '.[] | select(.OutputKey=="WeatherScheduleName") | .OutputValue' evidence/stack-outputs.json)"
```

Validate that none of these variables is empty before continuing.

## 3. Gate 1 — event backbone and duplicate protection

Reset and trigger through the production risk path:

```bash
curl --fail-with-body -sS -X POST "$API_URL/demo/reset" \
  -H "authorization: Bearer $OPERATOR_ACCESS_TOKEN" \
  -H 'content-type: application/json' -d '{}' | tee evidence/gate1-reset.json

curl --fail-with-body -sS -X POST "$API_URL/demo/heat-spike" \
  -H "authorization: Bearer $OPERATOR_ACCESS_TOKEN" \
  -H 'content-type: application/json' -d '{}' | tee evidence/gate1-spike.json
```

Get the real execution created by EventBridge:

```bash
aws stepfunctions list-executions \
  --state-machine-arn "$STATE_MACHINE_ARN" \
  --max-results 10 \
  --region "$AWS_REGION" \
  --output json | tee evidence/gate1-executions.json
```

Resolve the most recent execution ARN after the trigger, then inspect it. Confirm its `startDate` matches the trigger before using it as evidence:

```bash
export EXECUTION_ARN="$(aws stepfunctions list-executions \
  --state-machine-arn "$STATE_MACHINE_ARN" \
  --max-results 1 \
  --query 'executions[0].executionArn' \
  --output text)"
aws stepfunctions describe-execution --execution-arn "$EXECUTION_ARN" --output json | tee evidence/gate1-execution.json
aws stepfunctions get-execution-history --execution-arn "$EXECUTION_ARN" --max-results 100 --output json | tee evidence/gate1-history.json
```

The history must show `AcquireIdempotencyLock`, creation/guidance states, and the workflow waiting for callback. Do not copy or publish task tokens if AWS displays one.

Query interventions and audit records without exposing callback items:

```bash
aws dynamodb scan \
  --table-name "$TABLE_NAME" \
  --filter-expression 'entityType IN (:intervention, :audit)' \
  --expression-attribute-values '{":intervention":{"S":"INTERVENTION"},":audit":{"S":"AUDIT_EVENT"}}' \
  --projection-expression 'PK,SK,interventionId,eventId,eventType,#status,workerId,demoGeneration,occurredAt' \
  --expression-attribute-names '{"#status":"status"}' \
  --output json | tee evidence/gate1-dynamodb.json
```

For exact duplicate-event proof, retrieve the original execution input, save the `detail` envelope, and publish that exact detail twice:

```bash
aws stepfunctions describe-execution \
  --execution-arn "$EXECUTION_ARN" \
  --query input \
  --output text | jq '.detail' > evidence/duplicate-detail.json

jq -n \
  --arg bus "$EVENT_BUS_NAME" \
  --arg detail "$(jq -c . evidence/duplicate-detail.json)" \
  '[{"Source":"taapsaathi.risk-engine","DetailType":"HeatRiskRaised","EventBusName":$bus,"Detail":$detail}]' \
  > evidence/duplicate-entry.json

aws events put-events --entries file://evidence/duplicate-entry.json | tee evidence/duplicate-first.json
aws events put-events --entries file://evidence/duplicate-entry.json | tee evidence/duplicate-second.json
```

Re-query the table and prove only one intervention exists for the envelope’s idempotency key. A second execution may finish via `DuplicateComplete`; a second intervention may not exist.

## 4. Gate 2 — schedule, demo path, reset, and stale generation

```bash
aws scheduler get-schedule --name "$WEATHER_SCHEDULE_NAME" --output json | tee evidence/schedule.json
```

Expected: `State` is `ENABLED`, expression is `rate(5 minutes)`, and target is the deployed weather Lambda.

Start an intervention, save its ID, reset, and submit the old response:

```bash
curl -sS "$API_URL/dashboard" | tee evidence/before-stale-reset.json
export OLD_INTERVENTION_ID="$(jq -r '.activeInterventions[0].interventionId' evidence/before-stale-reset.json)"
curl --fail-with-body -sS -X POST "$API_URL/demo/reset" \
  -H "authorization: Bearer $OPERATOR_ACCESS_TOKEN" \
  -H 'content-type: application/json' -d '{}' | tee evidence/after-stale-reset.json
curl -sS -o evidence/stale-response.json -w '%{http_code}\n' \
  -X POST "$API_URL/interventions/$OLD_INTERVENTION_ID/respond" \
  -H "authorization: Bearer $WORKER_ACCESS_TOKEN" \
  -H 'content-type: application/json' \
  -d "{\"actorId\":\"ravi-001\",\"actorType\":\"WORKER\",\"action\":\"TAKE_BREAK\",\"language\":\"hi\",\"clientRequestId\":\"$(node -e 'console.log(crypto.randomUUID())')\"}"
```

Expected: structured `404` or stale-generation `409`; the reset dashboard remains unchanged.

## 5. Gate 3 — callback, reassignment, symptom, and timeout

Golden response:

```bash
curl --fail-with-body -sS -X POST "$API_URL/demo/reset" \
  -H "authorization: Bearer $OPERATOR_ACCESS_TOKEN" -H 'content-type: application/json' -d '{}'
curl --fail-with-body -sS -X POST "$API_URL/demo/heat-spike" \
  -H "authorization: Bearer $OPERATOR_ACCESS_TOKEN" -H 'content-type: application/json' -d '{}'
for attempt in $(seq 1 30); do
  curl --fail-with-body -sS "$API_URL/dashboard" > evidence/golden-dashboard.json
  INTERVENTION_ID="$(jq -r '.activeInterventions[] | select(.status=="AWAITING_WORKER") | .interventionId' evidence/golden-dashboard.json | head -1)"
  test -n "$INTERVENTION_ID" && break
  sleep 1
done
test -n "$INTERVENTION_ID"
export INTERVENTION_ID
export CLIENT_REQUEST_ID="$(node -e 'console.log(crypto.randomUUID())')"

curl --fail-with-body -sS -X POST "$API_URL/interventions/$INTERVENTION_ID/respond" \
  -H "authorization: Bearer $WORKER_ACCESS_TOKEN" \
  -H 'content-type: application/json' \
  -d "{\"actorId\":\"ravi-001\",\"actorType\":\"WORKER\",\"action\":\"TAKE_BREAK\",\"language\":\"hi\",\"clientRequestId\":\"$CLIENT_REQUEST_ID\"}"
```

Repeat the exact request and verify idempotent `202`. Change the request ID and verify `409 ALREADY_RESPONDED`. Query the dashboard and confirm Ravi is `RESTING` and Asha owns `delivery-001`.

Symptom path:

1. Reset and trigger.
2. Wait for `AWAITING_WORKER`.
3. Submit `FEEL_UNWELL` as Ravi with `Authorization: Bearer $WORKER_ACCESS_TOKEN`.
4. Wait for `AWAITING_SUPERVISOR`.
5. Submit `SUPERVISOR_ACK` with `actorId: supervisor-neha-001`, `actorType: SUPERVISOR`, and `Authorization: Bearer $SUPERVISOR_ACCESS_TOKEN`.
6. Capture the execution and audit record proving `SUPERVISOR_RESPONDING`.

Timeout path:

1. Reset and trigger.
2. Do not call the response endpoint.
3. Wait longer than the deployed worker timeout.
4. Confirm the execution entered `EscalateSupervisor` without direct Lambda invocation.

## 6. Gate 4 — Location, Polly, private audio, and APIs

```bash
curl --fail-with-body -sS "$API_URL/dashboard" | tee evidence/dashboard.json
curl --fail-with-body -sS "$API_URL/workers/ravi-001" | tee evidence/worker.json
curl --fail-with-body -sS "$API_URL/events" | tee evidence/events.json
curl --fail-with-body -sS "$API_URL/health" | tee evidence/health.json
aws s3api get-public-access-block --bucket "$AUDIO_BUCKET_NAME" | tee evidence/audio-public-access.json
aws s3api list-objects-v2 --bucket "$AUDIO_BUCKET_NAME" --output json | tee evidence/audio-objects.json
```

The intervention route must say `provider: AMAZON_LOCATION`; otherwise the honest fallback is active and GD-001 remains failed. Public dashboard and worker responses must contain neither `audioKey` nor a signed audio URL. Request audio only with the matching rider's JWT at `GET /workers/{workerId}/audio`; it returns a five-minute URL. Do not save or commit that URL as evidence. Direct public bucket access remains blocked.

## 7. Gate 5 — repeatability

Run the golden smoke command three independent times:

```bash
API_URL="$API_URL" OPERATOR_ACCESS_TOKEN="$OPERATOR_ACCESS_TOKEN" WORKER_ACCESS_TOKEN="$WORKER_ACCESS_TOKEN" npm run smoke:deployed | tee evidence/golden-1.json
API_URL="$API_URL" OPERATOR_ACCESS_TOKEN="$OPERATOR_ACCESS_TOKEN" WORKER_ACCESS_TOKEN="$WORKER_ACCESS_TOKEN" npm run smoke:deployed | tee evidence/golden-2.json
API_URL="$API_URL" OPERATOR_ACCESS_TOKEN="$OPERATOR_ACCESS_TOKEN" WORKER_ACCESS_TOKEN="$WORKER_ACCESS_TOKEN" npm run smoke:deployed | tee evidence/golden-3.json
```

Then run symptom and timeout paths once each. Search logs for prohibited token/secret text before release; inspect results locally and do not paste tokens into reports:

```bash
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/ --output json > evidence/log-groups.json
```

## 8. Recovery and teardown

- A reset invalidates active work by incrementing `demoGeneration`; old executions cannot mutate new seed state.
- If deployment fails, fix CDK/source and redeploy. Do not leave a console-only manual repair.
- If Location fails, the stored route is labelled `STRAIGHT_LINE_FALLBACK` and Gate GD-001 is not passed.
- If Polly fails, no fake audio URL is returned.

When the demonstration is no longer needed:

```bash
npm run destroy -- --profile "$AWS_PROFILE"
```

Confirm the account, region, and stack name before teardown because development data is deleted.
