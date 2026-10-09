# TaapSaathi - AWS Authentication Deployment Status

**Updated:** 9 October 2026
**Milestone:** Cognito authentication infrastructure and AWS security verification

## Executive summary

TaapSaathi's backend reliability improvements and Cognito
authentication infrastructure have been deployed successfully
to AWS Mumbai (ap-south-1).

CloudFormation completed with UPDATE_COMPLETE.

The deployed API now requires JWT authentication for all
three mutation endpoints.

## GitHub baseline

- Previous checkpoint: e018648
- Branch: main
- Repository: https://github.com/abhinav0singh/TapSaathi

## AWS infrastructure

- Stack: TaapSaathiStack
- Region: ap-south-1
- Deployment status: UPDATE_COMPLETE
- Runtime: Node.js 22 for application Lambdas
- API Gateway: HTTP API with JWT authorization
- Identity provider: Amazon Cognito
- Identity configuration: AWS Systems Manager Parameter Store

## Cognito configuration

User Pool: ap-south-1_cgIO5dxFX

App Client: 2uncftp6ql3a84krgskgrdoq11

Authentication flows:
- ALLOW_USER_SRP_AUTH
- ALLOW_REFRESH_TOKEN_AUTH

Groups:
- OPERATOR
- WORKER
- SUPERVISOR

## Demo identities

| Username | Group | Status |
| --- | --- | --- |
| demo-operator | OPERATOR | CONFIRMED |
| demo-ravi | WORKER | FORCE_CHANGE_PASSWORD |
| demo-asha | WORKER | FORCE_CHANGE_PASSWORD |
| demo-imran | WORKER | FORCE_CHANGE_PASSWORD |
| demo-neha | SUPERVISOR | FORCE_CHANGE_PASSWORD |

Five Cognito accounts have been created and assigned to their
intended groups.

Only the operator has completed password setup.

## Identity mapping

SSM parameter:
`/taapsaathi/demo/identity-mapping`

Status: Created successfully, version 1.

The parameter maps five Cognito subjects to application roles
and actor identifiers.

The mapping values and credentials are intentionally excluded
from this repository.

## Live API security verification

The following requests were executed against the deployed
API without authentication:

| Endpoint | Expected | Observed | Result |
| --- | --- | --- | --- |
| POST /demo/reset | 401 | 401 | PASS |
| POST /demo/heat-spike | 401 | 401 | PASS |
| POST /interventions/{interventionId}/respond | 401 | 401 | PASS |

These tests confirm unauthenticated requests are rejected.

They do not yet prove successful authenticated requests or
complete role-based authorization against live AWS.

## Local verification

- Infrastructure regression tests: 14/14 PASS
- Cognito authorization handler tests: 37/37 PASS
- SSM runtime loader tests: 8/8 PASS
- TypeScript verification: passed at the latest infrastructure checkpoint
- CDK synthesis: successful

## Backend reliability improvements

Previously implemented and locally verified:

- Worker intervention concurrency protection
- Idempotency and duplicate-event handling
- Durable suppression auditing
- Terminal intervention ownership reconciliation
- Step Functions intervention creation outcome branching
- DynamoDB conditional transactions
- Cognito actor authorization

## Remaining work

1. Verify real Cognito SRP login and authenticated API access.
2. Configure passwords for remaining demo accounts.
3. Integrate frontend authentication and JWT requests.
4. Run live AWS intervention golden-path tests.
5. Verify reassignment, supervisor escalation and audit persistence.
6. Deploy and polish the public frontend.
7. Record the final hackathon demonstration.

## Verification boundaries

CODE IMPLEMENTED does not imply AWS VERIFIED.

Negative authentication tests have passed against AWS.

Positive authentication, full workflow execution and frontend
end-to-end verification remain pending.

No production-readiness claim is made.
