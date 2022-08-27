#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CicdPipelineStack } from "../lib/pipeline-stack";
import { ApplicationStack } from "../lib/application-stack";

const app = new cdk.App();

// cicd pipeline stack
new CicdPipelineStack(app, "DevopsCicdPipelineStack", {
  codeStarArn: "",
});

// application preprod stack
new ApplicationStack(app, "PreProdApplicationStack", {
  environment: "PreProd",
});

// application prod stack
new ApplicationStack(app, "ProApplicationStack", {
  environment: "Prod",
});
