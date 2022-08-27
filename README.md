---
title: Build a CI/CD Pipeline with Integration Test
description: Build a basic ci/cd pipeline with integration test
author: haimtran
publishedDate: 06/23/2022
date: 2022-07-24
---

# Basic CI/CD Pipeline with Integration Test

![aws_devops-CdkPipelineFhr drawio](https://user-images.githubusercontent.com/20411077/176831848-b72a6d3c-8958-496c-a0ad-151f10a96c9d.png)

## Introduction

[GitHub](https://github.com/entest-hai/cicd-integration-test) this shows a basic examle of a ci/cd pipeline for a lambda api: codebuild for unittest, codebuild for integration test, codeploy for deploy the api stack. The api url is passed via system parameter store from deployed pre-product to the integration test.

## Application Stack

lambda function

```py
import json

def handler(event, context):
    """
    lambda handler
    """
    return {
        'statusCode': 200,
        'headers': {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,GET"
        },
        'body': json.dumps({
            'message': f"{event}"
        })
    }

```

application stack is a lambda backed api

```tsx
export interface ApplicationProps extends StackProps {
  environment: string;
}

export class ApplicationStack extends Stack {
  public readonly url: CfnOutput;

  constructor(scope: Construct, id: string, props: ApplicationProps) {
    super(scope, id, props);

    // lambda function
    const fn = new aws_lambda.Function(this, "Lambda", {
      functionName: `HelloPipeline${props.environment}`,
      runtime: aws_lambda.Runtime.PYTHON_3_8,
      timeout: Duration.seconds(10),
      code: aws_lambda.Code.fromAsset(path.join(__dirname, "../lambda/")),
      handler: "index.handler",
    });

    // api gateway
    const api = new aws_apigateway.RestApi(this, "ApiGwDemo", {
      restApiName: `ApiGwDemo${props.environment}`,
    });

    // api resource
    const resource = api.root.addResource("book");

    // api method
    resource.addMethod("GET", new aws_apigateway.LambdaIntegration(fn));

    this.url = new CfnOutput(this, `Url${props.environment}`, {
      description: "api url",
      exportName: `Url${props.environment}`,
      value: api.url,
    });
  }
```

## GitHub Connection

```tsx
// github source
const sourceAction =
  new aws_codepipeline_actions.CodeStarConnectionsSourceAction({
    actionName: "GitHub",
    owner: "entest-hai",
    connectionArn: `arn:aws:codestar-connections:${this.region}:${this.account}:connection/${props.codeStarId}`,
    repo: "cicd-integration-test",
    branch: "master",
    output: sourceOutput,
  });
```

codecommmit connection

```tsx
const sourceAction = new aws_codepipeline_actions.CodeCommitSourceAction({
  actionName: "CodeCommit",
  repository: repo,
  branch: "master",
  output: sourceOutput,
  variablesNamespace: "SourceVariables",
});
```

## CodeBuild Unittest

```tsx
// codebuild unitest
const unittestCodeBuild = new aws_codebuild.PipelineProject(
  this,
  "CodeBuildUnittest",
  {
    environment: {
      buildImage: aws_codebuild.LinuxBuildImage.STANDARD_5_0,
    },
    buildSpec: aws_codebuild.BuildSpec.fromObject({
      version: "0.2",
      phases: {
        install: {
          commands: ["echo $CODE_COMMIT_ID", "pip install -r requirements.txt"],
        },
        build: {
          commands: ["python -m pytest -s -v unittests/test_lambda_logic.py"],
        },
      },
      artifacts: {},
    }),
  }
);
```

## CodeBuild CDK Stacks

```tsx
// codebuild cdk template
const cdkCodeBuild = new aws_codebuild.PipelineProject(this, "CodeBuildCdk", {
  environment: {
    buildImage: aws_codebuild.LinuxBuildImage.STANDARD_5_0,
  },
  buildSpec: aws_codebuild.BuildSpec.fromObject({
    version: "0.2",
    phases: {
      install: {
        commands: ["npm install"],
      },
      build: {
        commands: ["npm run cdk synth -- -o dist"],
      },
    },
    artifacts: {
      "base-directory": "dist",
      files: ["*.template.json"],
    },
  }),
});
```

## CodeDeploy Preproduct

```tsx
{
  stageName: "Deploy",
  actions: [
    new aws_codepipeline_actions.CloudFormationCreateUpdateStackAction(
      {
        actionName: "DeployApplication",
        templatePath: cdkBuildOutput.atPath(
          "ApplicationStack.template.json"
        ),
        stackName: "PreProductApplicationStack",
        adminPermissions: true,
      }
    ),
  ],
},
```

## CoceBuild Integration Test

We need to get the API endpoint from the deployed pre-production stack. This can be done by several ways such as aws cloudformation describe stacks or boto3 python code.

```tsx
// codebuild integration test
const integtestCodeBuild = new aws_codebuild.PipelineProject(
  this,
  "CodeBuildIntegTest",
  {
    role: role,
    environment: {
      buildImage: aws_codebuild.LinuxBuildImage.STANDARD_5_0,
    },
    buildSpec: aws_codebuild.BuildSpec.fromObject({
      version: "0.2",
      phases: {
        install: {
          commands: [
            `SERVICE_URL=$(aws cloudformation describe-stacks --stack-name PreProdApplicationStack --query "Stacks[0].Outputs[?OutputKey=='UrlPreProd'].OutputValue" --output text)`,
            "echo $SERVICE_URL",
            "pip install -r requirements.txt",
          ],
        },
        build: {
          commands: ["python -m pytest -s -v integtests/test_service.py"],
        },
      },
      artifacts: {},
    }),
  }
);
```

## CodeDeploy Product

```tsx
// deploy preprod
const deployPreProd =
  new aws_codepipeline_actions.CloudFormationCreateUpdateStackAction({
    actionName: "DeployPreProdApplication",
    templatePath: cdkBuildOutput.atPath(
      "PreProdApplicationStack.template.json"
    ),
    stackName: "PreProdApplicationStack",
    adminPermissions: true,
    variablesNamespace: "PreProdVariables",
    outputFileName: "PreProdOutputs",
    output: preProdOutput,
  });
```

## CodePipeline Artifacts

```tsx
// source output
const sourceOutput = new aws_codepipeline.Artifact("SourceCode");
const unitestCodeBuildOutput = new aws_codepipeline.Artifact(
  "UnittestBuildOutput"
);
const cdkBuildOutput = new aws_codepipeline.Artifact("CdkBuildOutput");
```

## CodePipeline

```tsx
// pipeline
const pipeline = new aws_codepipeline.Pipeline(this, "DevOpsDemoPipeline", {
  pipelineName: "DevOpsDemoPipeline",
  crossAccountKeys: false,
  stages: [
    {
      stageName: "Source",
      actions: [sourceAction],
    },
    {
      stageName: "Unittest",
      actions: [unittestBuildAction],
    },
    {
      stageName: "BuildTemplate",
      actions: [cdkBuild],
    },
    {
      stageName: "DeployPreProd",
      actions: [deployPreProd],
    },
    {
      stageName: "IntegTest",
      actions: [integtestBuildAction],
    },
    {
      stageName: "DeployProd",
      actions: [deployProd],
    },
  ],
});
```

## Integration Test

option 1) using boto3 to query api url from the PreProdApplication stack. option 2) codebuild run a cli command to query the api url

```bash
`SERVICE_URL=$(aws cloudformation describe-stacks --stack-name PreProdApplicationStack --query "Stacks[0].Outputs[?OutputKey=='UrlPreProd'].OutputValue" --output text)`
```

```py

import boto3
import requests

STACK_NAME = "PreProdApplicationStack"
ENDPOINT = "book"

def query_api_url(stack_name):
    """
    query api url from cloudformation template output
    """

    # cloudformation client
    client = boto3.client('cloudformation')
    # query application stack
    resp = client.describe_stacks(
        StackName=stack_name
    )
    # looking for api url in stack output
    stack_outputs = resp['Stacks'][0]['Outputs']
    for output in stack_outputs:
        if output['OutputKey'] == 'UrlPreProd':
            api_url = output['OutputValue']
            print(f"api url: {api_url}")
    # return api url
    return api_url
```

then perform a simple test to assert status code 200

```py
def test_200_response():
    # get api url
    api_url = query_api_url(STACK_NAME)
    # send request
    with requests.get(f"{api_url}/{ENDPOINT}") as response:
        print(response.text)
        assert response.status_code == 200
#
if __name__=="__main__":
    test_200_response()
```

## Reference

1. [Reinvent 2021: Across account CI/CD pipelines](https://www.youtube.com/watch?v=AF-pSRSGNks)
2. [Enhanced CI/CD with AWS CDK CodePipeline](https://www.youtube.com/watch?v=1ps0Wh19MHQ)
3. [Building a Cross account CI/CD Pipeline Workshop](https://catalog.us-east-1.prod.workshops.aws/workshops/00bc829e-fd7c-4204-9da1-faea3cf8bd88/en-US)
