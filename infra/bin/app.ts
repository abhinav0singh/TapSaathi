#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { TaapSaathiStack } from "../lib/taapsaathi-stack.js";

const app = new cdk.App();
new TaapSaathiStack(app, process.env["STACK_NAME"] ?? "TaapSaathiStack", {
  env: {
    account: process.env["CDK_DEFAULT_ACCOUNT"],
    region: process.env["CDK_DEFAULT_REGION"] ?? process.env["AWS_REGION"] ?? "ap-south-1",
  },
  description: "TaapSaathi event-driven heat-safety backend",
});
