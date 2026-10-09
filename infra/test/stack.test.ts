import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { TaapSaathiStack } from "../lib/taapsaathi-stack.js";

let cachedTemplate: Template | undefined;

function template(): Template {
  if (!cachedTemplate) {
    const app = new cdk.App({ context: { workerResponseTimeoutSeconds: 120, supervisorResponseTimeoutSeconds: 120 } });
    cachedTemplate = Template.fromStack(new TaapSaathiStack(app, "TestStack", { env: { account: "111111111111", region: "ap-south-1" } }));
  }
  return cachedTemplate;
}

describe("TaapSaathi infrastructure", () => {
  it("allows Authorization headers in API CORS", () => {
    template().hasResourceProperties("AWS::ApiGatewayV2::Api", {
      CorsConfiguration: Match.objectLike({
        AllowHeaders: Match.arrayWith([
          "authorization",
          "content-type",
          "x-correlation-id",
        ]),
      }),
    });
  });

  it("attaches SSM permissions only to protected Lambda roles", () => {
    const resources = template().toJSON().Resources as Record<
      string,
      {
        Type: string;
        Properties?: Record<string, unknown>;
      }
    >;

    const protectedNames = [
      "RespondFunction",
      "HeatSpikeFunction",
      "ResetFunction",
    ];

    const functions = Object.entries(resources).filter(
      ([, resource]) => resource.Type === "AWS::Lambda::Function"
    );

    const policies = Object.values(resources).filter(
      (resource) => resource.Type === "AWS::IAM::Policy"
    );

    for (const [logicalId, resource] of functions) {
      const role = (
        resource.Properties as {
          Role: { "Fn::GetAtt": string[] };
        }
      ).Role["Fn::GetAtt"][0];

      expect(role, `Missing execution role for ${logicalId}`).toBeDefined();

      if (role === undefined) {
        throw new Error(`Missing execution role for ${logicalId}`);
      }

      const rolePolicies = policies.filter((policy) => {
        const roles = (
          policy.Properties as {
            Roles?: unknown[];
          }
        ).Roles ?? [];

        return roles.some((entry) =>
          JSON.stringify(entry).includes(role)
        );
      });

      const ssmStatements = rolePolicies.flatMap((policy) => {
        const document = (
          policy.Properties as {
            PolicyDocument: {
              Statement: Array<{
                Action: string | string[];
                Effect: string;
                Resource: unknown;
              }>;
            };
          }
        ).PolicyDocument;

        return document.Statement.filter((statement) =>
          (Array.isArray(statement.Action)
            ? statement.Action
            : [statement.Action]
          ).includes("ssm:GetParameter")
        );
      });

      const shouldHaveAccess = protectedNames.some(
        (name) => logicalId.startsWith(name)
      );

      if (shouldHaveAccess) {
        expect(ssmStatements, logicalId).toHaveLength(1);
        expect(ssmStatements[0]?.Effect).toBe("Allow");
        expect(JSON.stringify(ssmStatements[0]?.Resource)).toContain(
          "parameter/taapsaathi/demo/identity-mapping"
        );
        expect(ssmStatements[0]?.Resource).not.toBe("*");
      } else {
        expect(ssmStatements, logicalId).toHaveLength(0);
      }
    }
  });
  it("restricts SSM identity mapping access to protected Lambdas", () => {
    const rendered = template();
    const resources = rendered.toJSON().Resources as Record<
      string,
      {
        Type: string;
        Properties?: Record<string, unknown>;
      }
    >;

    const protectedNames = [
      "RespondFunction",
      "HeatSpikeFunction",
      "ResetFunction",
    ];

    const parameterName = "/taapsaathi/demo/identity-mapping";

    const functions = Object.entries(resources).filter(
      ([, resource]) => resource.Type === "AWS::Lambda::Function"
    );

    for (const [logicalId, resource] of functions) {
      const properties = resource.Properties as {
        Environment?: {
          Variables?: Record<string, unknown>;
        };
      };

      const actualParameter =
        properties.Environment?.Variables?.[
          "DEMO_IDENTITY_MAPPING_PARAMETER"
        ];

      if (protectedNames.some((name) => logicalId.startsWith(name))) {
        expect(actualParameter, logicalId).toBe(parameterName);
      } else {
        expect(actualParameter, logicalId).toBeUndefined();
      }
    }

    const policies = Object.entries(resources).filter(
      ([, resource]) => resource.Type === "AWS::IAM::Policy"
    );

    const ssmPolicies = policies.filter(([, resource]) =>
      JSON.stringify(resource.Properties).includes("ssm:GetParameter")
    );

    expect(ssmPolicies).toHaveLength(3);

    for (const [logicalId, resource] of ssmPolicies) {
      const properties = resource.Properties as {
        PolicyDocument: {
          Statement: Array<{
            Action: string | string[];
            Effect: string;
            Resource: unknown;
          }>;
        };
      };

      const statements = properties.PolicyDocument.Statement.filter(
        (statement) =>
          (Array.isArray(statement.Action)
            ? statement.Action
            : [statement.Action]
          ).includes("ssm:GetParameter")
      );

      expect(statements, logicalId).toHaveLength(1);
      expect(statements[0]?.Effect).toBe("Allow");

      const encodedResource = JSON.stringify(statements[0]?.Resource);

      expect(encodedResource).toContain(
        "parameter/taapsaathi/demo/identity-mapping"
      );
      expect(statements[0]?.Resource).not.toBe("*");
    }
  });

  it("protects mutation routes with JWT authorization", () => {
    const rendered = template();

    rendered.resourceCountIs("AWS::ApiGatewayV2::Authorizer", 1);

    rendered.hasResourceProperties("AWS::ApiGatewayV2::Authorizer", {
      AuthorizerType: "JWT",
      IdentitySource: ["$request.header.Authorization"],
    });

    const routes = rendered.findResources("AWS::ApiGatewayV2::Route");

    const protectedRoutes = [
      "POST /demo/reset",
      "POST /demo/heat-spike",
      "POST /interventions/{interventionId}/respond",
    ];

    for (const routeKey of protectedRoutes) {
      const route = Object.values(routes).find(
        (resource) =>
          (resource as { Properties?: { RouteKey?: string } })
            .Properties?.RouteKey === routeKey
      ) as { Properties?: { AuthorizationType?: string; AuthorizerId?: unknown } } | undefined;

      expect(route, `Missing route: ${routeKey}`).toBeDefined();
      expect(route?.Properties?.AuthorizationType).toBe("JWT");
      expect(route?.Properties?.AuthorizerId).toBeDefined();
    }
  });

  it("keeps read-only routes publicly accessible", () => {
    const routes = template().findResources("AWS::ApiGatewayV2::Route");

    for (const routeKey of [
      "GET /health",
      "GET /dashboard",
      "GET /workers/{workerId}",
      "GET /events",
    ]) {
      const route = Object.values(routes).find(
        (resource) =>
          (resource as { Properties?: { RouteKey?: string } })
            .Properties?.RouteKey === routeKey
      ) as { Properties?: { AuthorizationType?: string } } | undefined;

      expect(route, `Missing route: ${routeKey}`).toBeDefined();
      expect(route?.Properties?.AuthorizationType ?? "NONE").toBe("NONE");
    }
  });

  it("creates Cognito demo identity infrastructure", () => {
    const rendered = template();

    rendered.resourceCountIs("AWS::Cognito::UserPool", 1);
    rendered.resourceCountIs("AWS::Cognito::UserPoolClient", 1);
    rendered.resourceCountIs("AWS::Cognito::UserPoolGroup", 3);

    rendered.hasResourceProperties("AWS::Cognito::UserPool", {
      AdminCreateUserConfig: {
        AllowAdminCreateUserOnly: true,
      },
    });

    rendered.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      GenerateSecret: false,
    });

    const groups = rendered.findResources(
      "AWS::Cognito::UserPoolGroup"
    );

    const names = Object.values(groups).map(
      (resource) =>
        (resource as { Properties: { GroupName: string } })
          .Properties.GroupName
    );

    expect(names).toEqual(
      expect.arrayContaining([
        "OPERATOR",
        "WORKER",
        "SUPERVISOR",
      ])
    );
  });

  it("routes intervention creation outcomes correctly", () => {
    const resources = template().findResources(
      "AWS::StepFunctions::StateMachine"
    );

    const machine = Object.values(resources)[0] as {
      Properties?: {
        DefinitionString?: {
          "Fn::Join"?: [string, unknown[]];
        };
      };
    };

    expect(machine).toBeDefined();

    const join = machine.Properties?.DefinitionString?.["Fn::Join"];

    expect(join).toBeDefined();

    const fragments = join?.[1];

    expect(Array.isArray(fragments)).toBe(true);

    const reconstructed = fragments!
      .map((fragment) =>
        typeof fragment === "string" ? fragment : "MOCK_ARN"
      )
      .join("");

    const definition = JSON.parse(reconstructed) as {
      States: Record<string, {
        Type?: string;
        Next?: string;
        Default?: string;
        Choices?: Array<{
          Variable?: string;
          StringEquals?: string;
          Next?: string;
        }>;
      }>;
    };

    const states = definition.States;

    expect(states["CreateIntervention"]?.Next).toBe(
      "CheckInterventionCreationOutcome"
    );

    const choice = states["CheckInterventionCreationOutcome"];

    expect(choice?.Type).toBe("Choice");

    expect(choice?.Choices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          Variable: "$.creationOutcome",
          StringEquals: "CREATED",
          Next: "PrepareGuidanceWithLocationAndPolly",
        }),
        expect.objectContaining({
          Variable: "$.creationOutcome",
          StringEquals: "WORKER_UNAVAILABLE",
          Next: "WorkerUnavailableSuppressed",
        }),
      ])
    );

    expect(choice?.Default).toBe(
      "UnexpectedInterventionCreationOutcome"
    );

    expect(states["WorkerUnavailableSuppressed"]?.Type).toBe(
      "Succeed"
    );

    expect(states["UnexpectedInterventionCreationOutcome"]?.Type).toBe(
      "Fail"
    );

    expect(states["DuplicateRiskEvent"]?.Type).toBe(
      "Choice"
    );
  });
  it("INF-001 contains every required resource type", () => {
    const rendered = template();
    rendered.resourceCountIs("AWS::DynamoDB::Table", 1);
    rendered.resourceCountIs("AWS::Events::EventBus", 1);
    rendered.resourceCountIs("AWS::StepFunctions::StateMachine", 1);
    rendered.resourceCountIs("AWS::ApiGatewayV2::Api", 1);
    rendered.resourceCountIs("AWS::Scheduler::Schedule", 1);
    rendered.resourceCountIs("AWS::S3::Bucket", 1);
    expect(Object.keys(rendered.findResources("AWS::Lambda::Function")).length).toBeGreaterThanOrEqual(16);
  });

  it("INF-002 routes HeatRiskRaised to Step Functions", () => {
    template().hasResourceProperties("AWS::Events::Rule", {
      EventPattern: {
        source: ["taapsaathi.risk-engine"],
        "detail-type": ["HeatRiskRaised"],
      },
      Targets: Match.arrayWith([Match.objectLike({ Arn: Match.anyValue() })]),
    });
  });

  it("INF-003 configures TTL and GSI1", () => {
    template().hasResourceProperties("AWS::DynamoDB::Table", {
      TimeToLiveSpecification: { AttributeName: "expiresAt", Enabled: true },
      GlobalSecondaryIndexes: Match.arrayWith([Match.objectLike({ IndexName: "GSI1" })]),
    });
  });

  it("INF-004 blocks public S3 access", () => {
    template().hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it("INF-005 uses Node.js 22 for application Lambdas", () => {
    const functions = template().findResources("AWS::Lambda::Function");
    for (const resource of Object.values(functions)) {
      const properties = (resource as { Properties?: { Runtime?: string; Environment?: { Variables?: Record<string, unknown> } } }).Properties;
      if (properties?.Environment?.Variables?.["TABLE_NAME"]) expect(properties.Runtime).toBe("nodejs22.x");
    }
  });

  it("creates an enabled five-minute Scheduler schedule", () => {
    template().hasResourceProperties("AWS::Scheduler::Schedule", {
      ScheduleExpression: "rate(5 minutes)",
      State: "ENABLED",
      FlexibleTimeWindow: { Mode: "OFF" },
    });
  });

  it("uses a Standard workflow with callback states", () => {
    const rendered = template();
    rendered.hasResourceProperties("AWS::StepFunctions::StateMachine", {
      StateMachineType: "STANDARD",
      DefinitionString: Match.anyValue(),
    });
    const encoded = JSON.stringify(rendered.toJSON());
    expect(encoded).toContain("AcquireIdempotencyLock");
    expect(encoded).toContain("AwaitWorkerResponse");
    expect(encoded).toContain("AwaitSupervisorAcknowledgement");
    expect(encoded).toContain("ReassignActiveDeliveryTransactionally");
    expect(encoded).toContain("waitForTaskToken");
  });
});
