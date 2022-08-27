# Build a Basic CI/CD Pipeline with CodePipeline

![aws_devops-CdkPipelineFhr drawio](https://user-images.githubusercontent.com/20411077/176831848-b72a6d3c-8958-496c-a0ad-151f10a96c9d.png)

## Introduction

[GitHub](https://github.com/entest-hai/cicd-integration-test) this shows a basic examle of a ci/cd pipeline for a lambda api: codebuild for unittest, codebuild for integration test, codeploy for deploy the api stack. The api url is passed via system parameter store from deployed pre-product to the integration test.

## Reference

1. [Reinvent 2021: Across account CI/CD pipelines](https://www.youtube.com/watch?v=AF-pSRSGNks)
2. [Enhanced CI/CD with AWS CDK CodePipeline](https://www.youtube.com/watch?v=1ps0Wh19MHQ)
3. [Building a Cross account CI/CD Pipeline Workshop](https://catalog.us-east-1.prod.workshops.aws/workshops/00bc829e-fd7c-4204-9da1-faea3cf8bd88/en-US)

## Application Stack

```tsx
export class ApplicationStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const fn = new aws_lambda.Function(this, "SwinLambda", {
      functionName: "HelloSwinDevOps",
      runtime: aws_lambda.Runtime.PYTHON_3_8,
      timeout: Duration.seconds(10),
      code: aws_lambda.Code.fromAsset(path.join(__dirname, "../lambda/")),
      handler: "index.handler",
    });
  }
}
```

## Source Code

```tsx
// source code - code commit
const repo = aws_codecommit.Repository.fromRepositoryName(
  this,
  "SwinDevOpsDemoRepo",
  "SwinDevOpsDemoRepo"
);
```

## CodeBuild for Unit Tests

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

## CodeBuild to Build Application Stack

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

## CodeDeploy to Deploy the Application Stack - Pre Product

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

## CoceBuild for Integration Test

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

## CodeDeploy Deploy Product

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

# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `cdk deploy` deploy this stack to your default AWS account/region
- `cdk diff` compare deployed stack with current state
- `cdk synth` emits the synthesized CloudFormation template
