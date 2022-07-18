#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DevopsCicdPipelineStack } from "../lib/devops-cicd-pipeline-stack";
import { ApplicationStack } from "../lib/application-stack";

const app = new cdk.App();

// cicd pipeline stack
new DevopsCicdPipelineStack(app, "DevopsCicdPipelineStack", {});

// application preprod stack
new ApplicationStack(app, "PreProdApplicationStack", {
  environment: "PreProd",
});

// application prod stack
new ApplicationStack(app, "ProApplicationStack", {
  environment: "Prod",
});
