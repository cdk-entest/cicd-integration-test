#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CicdPipelineStack } from "../lib/pipeline-stack";
import { ApplicationStack } from "../lib/application-stack";

const app = new cdk.App();

// cicd pipeline stack
new CicdPipelineStack(app, "CicdPipelineStack", {
  codeStarId: "475216ac-d91d-40c7-827d-c0da1c714f10",
});

// application preprod stack
new ApplicationStack(app, "PreProdApplicationStack", {
  environment: "PreProd",
});

// application prod stack
new ApplicationStack(app, "ProApplicationStack", {
  environment: "Prod",
});
