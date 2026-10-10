import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cr from "aws-cdk-lib/custom-resources";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNode from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import type { Construct } from "constructs";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../..");

export class TaapSaathiStack extends cdk.Stack {
  public constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const workerTimeout = Number(this.node.tryGetContext("workerResponseTimeoutSeconds") ?? process.env["WORKER_RESPONSE_TIMEOUT_SECONDS"] ?? 120);
    const supervisorTimeout = Number(this.node.tryGetContext("supervisorResponseTimeoutSeconds") ?? process.env["SUPERVISOR_RESPONSE_TIMEOUT_SECONDS"] ?? 120);
    const maxContinuousMinutes = Number(process.env["MAX_CONTINUOUS_MINUTES"] ?? 60);
    const frontendOrigins = (process.env["FRONTEND_ORIGINS"] ?? "http://localhost:3000").split(",").map((value) => value.trim());

    const userPool = new cognito.UserPool(this, "DemoUserPool", {
      userPoolName: "taapsaathi-demo-users",
      selfSignUpEnabled: false,
      signInAliases: { username: true },
      standardAttributes: {
        email: { required: false },
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = userPool.addClient("DemoWebClient", {
      userPoolClientName: "taapsaathi-demo-web",
      generateSecret: false,
      authFlows: {
        userSrp: true,
      },
      preventUserExistenceErrors: true,
    });

    for (const groupName of ["OPERATOR", "WORKER", "SUPERVISOR"]) {
      new cognito.CfnUserPoolGroup(this, `${groupName}Group`, {
        userPoolId: userPool.userPoolId,
        groupName,
      });
    }

    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer(
      "DemoJwtAuthorizer",
      `https://cognito-idp.${cdk.Aws.REGION}.amazonaws.com/${userPool.userPoolId}`,
      {
        jwtAudience: [userPoolClient.userPoolClientId],
      }
    );
    const table = new dynamodb.Table(this, "TaapSaathiTable", {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expiresAt",
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    table.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const audioBucket = new s3.Bucket(this, "AudioBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: cdk.Duration.days(7) }],
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
        allowedOrigins: frontendOrigins,
        allowedHeaders: ["*"],
        maxAge: 300,
      }],
    });
    const eventBus = new events.EventBus(this, "DomainEventBus", { eventBusName: "taapsaathi-events" });

    const commonEnvironment: Record<string, string> = {
      TABLE_NAME: table.tableName,
      EVENT_BUS_NAME: eventBus.eventBusName,
      AUDIO_BUCKET_NAME: audioBucket.bucketName,
      MAX_CONTINUOUS_MINUTES: String(maxContinuousMinutes),
      WORKER_RESPONSE_TIMEOUT_SECONDS: String(workerTimeout),
      SUPERVISOR_RESPONSE_TIMEOUT_SECONDS: String(supervisorTimeout),
      DEMO_HUB_ID: "hub-delhi-001",
      FRONTEND_ORIGINS: frontendOrigins.join(","),
    };

    const nodeFunction = (constructId: string, entry: string, environment: Record<string, string> = {}) => new lambdaNode.NodejsFunction(this, constructId, {
      entry: path.join(root, entry),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(20),
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: { ...commonEnvironment, ...environment },
      bundling: { minify: false, sourceMap: true, target: "node22", externalModules: [] },
    });

    const acquireLock = nodeFunction("AcquireLockFunction", "services/intervention/src/acquire-lock.ts");
    const loadContext = nodeFunction("LoadContextFunction", "services/intervention/src/load-context.ts");
    const createIntervention = nodeFunction("CreateInterventionFunction", "services/intervention/src/create.ts");
    const prepareGuidance = nodeFunction("PrepareGuidanceFunction", "services/intervention/src/prepare-guidance.ts");
    const registerCallback = nodeFunction("RegisterCallbackFunction", "services/intervention/src/register-callback.ts");
    const reassignTask = nodeFunction("ReassignTaskFunction", "services/intervention/src/reassign-task.ts");
    const escalate = nodeFunction("EscalateFunction", "services/intervention/src/escalate.ts");
    const complete = nodeFunction("CompleteFunction", "services/intervention/src/complete.ts");
    const workflowFunctions = [acquireLock, loadContext, createIntervention, prepareGuidance, registerCallback, reassignTask, escalate, complete];
    for (const fn of workflowFunctions) table.grantReadWriteData(fn);
    audioBucket.grantReadWrite(prepareGuidance);
    prepareGuidance.addToRolePolicy(new iam.PolicyStatement({ actions: ["polly:SynthesizeSpeech"], resources: ["*"] }));
    prepareGuidance.addToRolePolicy(new iam.PolicyStatement({
      actions: ["geo-routes:CalculateRoutes"],
      resources: [`arn:${cdk.Aws.PARTITION}:geo-routes:${cdk.Aws.REGION}::provider/default`],
    }));

    const invoke = (id: string, fn: lambda.IFunction) => new tasks.LambdaInvoke(this, id, {
      lambdaFunction: fn,
      payloadResponseOnly: true,
    });
    const staleGenerationComplete = new sfn.Succeed(this, "StaleGenerationComplete");
    const acquireState = invoke("AcquireIdempotencyLock", acquireLock);
    const duplicateComplete = new sfn.Succeed(this, "DuplicateComplete");
    const loadState = invoke("LoadWorkerDeliveryPolicyHub", loadContext);
    const createState = invoke("CreateIntervention", createIntervention);
    const guidanceState = invoke("PrepareGuidanceWithLocationAndPolly", prepareGuidance);

    const awaitWorker = new tasks.LambdaInvoke(this, "AwaitWorkerResponse", {
      lambdaFunction: registerCallback,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      timeout: cdk.Duration.seconds(workerTimeout),
      payload: sfn.TaskInput.fromObject({
        "taskToken": sfn.JsonPath.taskToken,
        "actorType": "WORKER",
        "envelope.$": "$.envelope",
        "interventionId.$": "$.interventionId",
        "duplicate.$": "$.duplicate",
        "taskId.$": "$.taskId",
        "workerLanguage.$": "$.workerLanguage",
        "workerPosition.$": "$.workerPosition",
      }),
      resultPath: "$.response",
    });
    const workerChoice = new sfn.Choice(this, "BranchOnWorkerResponse");
    const reassignState = invoke("ReassignActiveDeliveryTransactionally", reassignTask);
    const prepareEscalationDelivery = new sfn.Pass(this, "PrepareEscalationDeliveryHandling", {
      result: sfn.Result.fromString("ESCALATION"),
      resultPath: "$.deliveryHandling",
    });
    const secureEscalationDelivery = invoke("SecureActiveDeliveryForEscalation", reassignTask);
    const reassignmentChoice = new sfn.Choice(this, "ReassignmentSucceeded");
    const escalateState = invoke("EscalateSupervisor", escalate);
    const awaitSupervisor = new tasks.LambdaInvoke(this, "AwaitSupervisorAcknowledgement", {
      lambdaFunction: registerCallback,
      integrationPattern: sfn.IntegrationPattern.WAIT_FOR_TASK_TOKEN,
      timeout: cdk.Duration.seconds(supervisorTimeout),
      payload: sfn.TaskInput.fromObject({
        "taskToken": sfn.JsonPath.taskToken,
        "actorType": "SUPERVISOR",
        "envelope.$": "$.envelope",
        "interventionId.$": "$.interventionId",
        "duplicate.$": "$.duplicate",
        "taskId.$": "$.taskId",
        "workerLanguage.$": "$.workerLanguage",
        "workerPosition.$": "$.workerPosition",
      }),
      resultPath: "$.supervisorResponse",
    });
    const completeBreak = new tasks.LambdaInvoke(this, "CompleteBreakIntervention", { lambdaFunction: complete, payloadResponseOnly: true, payload: sfn.TaskInput.fromObject({ "envelope.$": "$.envelope", "interventionId.$": "$.interventionId", "duplicate.$": "$.duplicate", "taskId.$": "$.taskId", "reassignment.$": "$.reassignment", terminalStatus: "COMPLETED" }) });
    const markResting = new sfn.Pass(this, "MarkRiderResting");
    const completeSupervisor = new tasks.LambdaInvoke(this, "CompleteSupervisorResponding", { lambdaFunction: complete, payloadResponseOnly: true, payload: sfn.TaskInput.fromObject({ "envelope.$": "$.envelope", "interventionId.$": "$.interventionId", "duplicate.$": "$.duplicate", terminalStatus: "SUPERVISOR_RESPONDING" }) });
    const completeUnacknowledged = new tasks.LambdaInvoke(this, "CompleteSupervisorUnacknowledged", { lambdaFunction: complete, payloadResponseOnly: true, payload: sfn.TaskInput.fromObject({ "envelope.$": "$.envelope", "interventionId.$": "$.interventionId", "duplicate.$": "$.duplicate", terminalStatus: "SUPERVISOR_UNACKNOWLEDGED" }) });
    const success = new sfn.Succeed(this, "InterventionFinished");

    completeBreak.next(success);
    markResting.next(completeBreak);
    completeSupervisor.next(success);
    completeUnacknowledged.next(success);
    awaitSupervisor.next(completeSupervisor);
    awaitSupervisor.addCatch(completeUnacknowledged, { errors: ["States.Timeout"], resultPath: "$.supervisorTimeout" });
    escalateState.next(awaitSupervisor);
    prepareEscalationDelivery.next(secureEscalationDelivery);
    secureEscalationDelivery.next(escalateState);
    reassignmentChoice
      .when(sfn.Condition.stringEquals("$.reassignment.status", "REASSIGNED"), markResting)
      .otherwise(escalateState);
    reassignState.next(reassignmentChoice);
    workerChoice
      .when(sfn.Condition.stringEquals("$.response.action", "TAKE_BREAK"), reassignState)
      .when(sfn.Condition.stringEquals("$.response.action", "FEEL_UNWELL"), prepareEscalationDelivery)
      .otherwise(prepareEscalationDelivery);
    awaitWorker.next(workerChoice);
    awaitWorker.addCatch(prepareEscalationDelivery, { errors: ["States.Timeout"], resultPath: "$.timeout" });
    guidanceState.next(awaitWorker);
    const creationOutcomeChoice = new sfn.Choice(this, "CheckInterventionCreationOutcome");
    const workerUnavailable = new sfn.Succeed(this, "WorkerUnavailableSuppressed");

    creationOutcomeChoice
      .when(sfn.Condition.stringEquals("$.creationOutcome", "CREATED"), guidanceState)
      .when(sfn.Condition.stringEquals("$.creationOutcome", "WORKER_UNAVAILABLE"), workerUnavailable)
      .otherwise(new sfn.Fail(this, "UnexpectedInterventionCreationOutcome"));

    createState.next(creationOutcomeChoice);
    loadState.next(createState);
    const duplicateChoice = new sfn.Choice(this, "DuplicateRiskEvent");
    duplicateChoice.when(sfn.Condition.booleanEquals("$.duplicate", true), duplicateComplete).otherwise(loadState);
    acquireState.next(duplicateChoice);

    for (const state of [
      acquireState,
      loadState,
      createState,
      guidanceState,
      awaitWorker,
      reassignState,
      secureEscalationDelivery,
      escalateState,
      awaitSupervisor,
      completeBreak,
      completeSupervisor,
      completeUnacknowledged,
    ]) {
      state.addCatch(staleGenerationComplete, {
        errors: ["StaleGenerationError"],
        resultPath: "$.staleGenerationError",
      });
    }

    const stateMachineLogGroup = new logs.LogGroup(this, "WorkflowLogGroup", { retention: logs.RetentionDays.ONE_WEEK, removalPolicy: cdk.RemovalPolicy.DESTROY });
    const stateMachine = new sfn.StateMachine(this, "InterventionStateMachine", {
      stateMachineType: sfn.StateMachineType.STANDARD,
      definitionBody: sfn.DefinitionBody.fromChainable(acquireState),
      timeout: cdk.Duration.minutes(15),
      logs: { destination: stateMachineLogGroup, level: sfn.LogLevel.ERROR, includeExecutionData: false },
      tracingEnabled: true,
    });
    commonEnvironment["STATE_MACHINE_ARN"] = stateMachine.stateMachineArn;
    stateMachine.addToRolePolicy(new iam.PolicyStatement({ actions: ["lambda:InvokeFunction"], resources: workflowFunctions.map((fn) => fn.functionArn) }));

    const riskRule = new events.Rule(this, "HeatRiskRule", {
      eventBus,
      eventPattern: { source: ["taapsaathi.risk-engine"], detailType: ["HeatRiskRaised"] },
    });
    riskRule.addTarget(new targets.SfnStateMachine(stateMachine, { input: events.RuleTargetInput.fromEventPath("$") }));

    const weatherFunction = nodeFunction("WeatherPollFunction", "services/weather/src/poll-weather.ts", { WEATHER_MODE: "cached" });
    table.grantReadWriteData(weatherFunction);
    eventBus.grantPutEventsTo(weatherFunction);
    const scheduleRole = new iam.Role(this, "SchedulerExecutionRole", { assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com") });
    weatherFunction.grantInvoke(scheduleRole);
    const weatherSchedule = new scheduler.CfnSchedule(this, "WeatherPollSchedule", {
      flexibleTimeWindow: { mode: "OFF" },
      scheduleExpression: "rate(5 minutes)",
      state: "ENABLED",
      target: { arn: weatherFunction.functionArn, roleArn: scheduleRole.roleArn, retryPolicy: { maximumEventAgeInSeconds: 300, maximumRetryAttempts: 2 } },
    });

    const healthFunction = nodeFunction("HealthFunction", "services/api/src/health.ts");
    const dashboardFunction = nodeFunction("DashboardFunction", "services/api/src/dashboard.ts");
    const workerFunction = nodeFunction("WorkerFunction", "services/api/src/worker.ts");
    const workerAudioFunction = nodeFunction("WorkerAudioFunction", "services/api/src/worker-audio.ts");
    const eventsFunction = nodeFunction("EventsFunction", "services/api/src/events.ts");
    const respondFunction = nodeFunction("RespondFunction", "services/api/src/respond.ts");
    const resumeWorkerFunction = nodeFunction("ResumeWorkerFunction", "services/api/src/resume-worker.ts");
    const heatSpikeFunction = nodeFunction("HeatSpikeFunction", "services/demo/src/heat-spike.ts");
    const resetFunction = nodeFunction("ResetFunction", "services/demo/src/reset.ts");
    table.grantReadData(dashboardFunction);
    table.grantReadData(workerFunction);
    table.grantReadData(workerAudioFunction);
    table.grantReadData(eventsFunction);
    table.grantReadWriteData(respondFunction);
    table.grantReadWriteData(resumeWorkerFunction);
    table.grantReadWriteData(heatSpikeFunction);
    table.grantReadWriteData(resetFunction);
    const identityMappingParameterName = "/taapsaathi/demo/identity-mapping";
    const identityMappingParameterArn = cdk.Stack.of(this).formatArn({
      service: "ssm",
      resource: "parameter",
      resourceName: identityMappingParameterName.replace(/^\//, ""),
    });

    for (const fn of [respondFunction, resumeWorkerFunction, heatSpikeFunction, resetFunction]) {
      fn.addEnvironment(
        "DEMO_IDENTITY_MAPPING_PARAMETER",
        identityMappingParameterName
      );

      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [identityMappingParameterArn],
      }));
    }
    audioBucket.grantRead(workerAudioFunction);
    eventBus.grantPutEventsTo(heatSpikeFunction);
    respondFunction.addToRolePolicy(new iam.PolicyStatement({ actions: ["states:SendTaskSuccess"], resources: ["*"] }));

    const api = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: "taapsaathi-api",
      corsPreflight: {
        allowOrigins: frontendOrigins,
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.OPTIONS],
        allowHeaders: ["authorization", "content-type", "x-correlation-id"],
        exposeHeaders: ["x-correlation-id"],
        maxAge: cdk.Duration.hours(1),
      },
    });
    const apiAccessLogs = new logs.LogGroup(this, "ApiAccessLogGroup", { retention: logs.RetentionDays.ONE_WEEK, removalPolicy: cdk.RemovalPolicy.DESTROY });
    const defaultStage = api.defaultStage?.node.defaultChild as apigwv2.CfnStage | undefined;
    if (defaultStage) {
      defaultStage.accessLogSettings = {
        destinationArn: apiAccessLogs.logGroupArn,
        format: JSON.stringify({ requestId: "$context.requestId", routeKey: "$context.routeKey", status: "$context.status", responseLatency: "$context.responseLatency", integrationError: "$context.integrationErrorMessage" }),
      };
      defaultStage.defaultRouteSettings = { throttlingBurstLimit: 50, throttlingRateLimit: 25 };
    }
    const route = (
      routePath: string,
      method: apigwv2.HttpMethod,
      fn: lambda.IFunction,
      idSuffix: string,
      protectedRoute = false
    ) => api.addRoutes({
      path: routePath,
      methods: [method],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        `${idSuffix}Integration`,
        fn
      ),
      ...(protectedRoute ? { authorizer: jwtAuthorizer } : {}),
    });
    route("/health", apigwv2.HttpMethod.GET, healthFunction, "Health");
    route("/dashboard", apigwv2.HttpMethod.GET, dashboardFunction, "Dashboard");
    route("/workers/{workerId}", apigwv2.HttpMethod.GET, workerFunction, "Worker");
    route("/workers/{workerId}/audio", apigwv2.HttpMethod.GET, workerAudioFunction, "WorkerAudio", true);
    route("/events", apigwv2.HttpMethod.GET, eventsFunction, "Events");
    route("/interventions/{interventionId}/respond", apigwv2.HttpMethod.POST, respondFunction, "Respond", true);
    route("/workers/{workerId}/resume", apigwv2.HttpMethod.POST, resumeWorkerFunction, "ResumeWorker", true);
    route("/demo/heat-spike", apigwv2.HttpMethod.POST, heatSpikeFunction, "HeatSpike", true);
    route("/demo/reset", apigwv2.HttpMethod.POST, resetFunction, "Reset", true);

    const seedFunction = nodeFunction("SeedFunction", "services/demo/src/seed.ts");
    table.grantReadWriteData(seedFunction);
    const seedProvider = new cr.Provider(this, "SeedProvider", { onEventHandler: seedFunction, logRetention: logs.RetentionDays.ONE_WEEK });
    const seedResource = new cdk.CustomResource(this, "DemoSeed", { serviceToken: seedProvider.serviceToken, properties: { schemaVersion: 1, tableIdentity: table.tableArn } });
    seedResource.node.addDependency(table);

    new cloudwatch.Alarm(this, "WorkflowFailureAlarm", {
      metric: stateMachine.metricFailed({ period: cdk.Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    new cloudwatch.Alarm(this, "ApiServerErrorAlarm", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/ApiGateway",
        metricName: "5xx",
        dimensionsMap: { ApiId: api.apiId },
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new cdk.CfnOutput(this, "CognitoUserPoolId", {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, "CognitoUserPoolClientId", {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
    new cdk.CfnOutput(this, "StateMachineArn", { value: stateMachine.stateMachineArn });
    new cdk.CfnOutput(this, "TableName", { value: table.tableName });
    new cdk.CfnOutput(this, "AudioBucketName", { value: audioBucket.bucketName });
    new cdk.CfnOutput(this, "EventBusName", { value: eventBus.eventBusName });
    new cdk.CfnOutput(this, "WeatherScheduleName", { value: weatherSchedule.ref });
  }
}
