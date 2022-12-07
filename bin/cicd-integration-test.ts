#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CicdPipelineStack } from "../lib/pipeline-stack";
import { ApplicationStack } from "../lib/application-stack";

const app = new cdk.App();

// cicd pipeline stack
new CicdPipelineStack(app, "CicdPipelineStack", {
  codeStarId: "8e417a13-4164-4ce4-b1bf-deb77c7c6018",
});

// application preprod stack
new ApplicationStack(app, "PreProdApplicationStack", {
  environment: "PreProd",
});

// application prod stack
new ApplicationStack(app, "ProApplicationStack", {
  environment: "Prod",
});
