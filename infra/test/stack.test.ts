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
