# Build a Basic CI/CD Pipeline with CodePipeline

## Introduction

1. SDLC [IEC 62304 SW for Medical Device](https://webstore.iec.ch/preview/info_iec62304%7Bed1.0%7Den_d.pdf)

2. What is AWS CI/CD? [HERE](https://docs.aws.amazon.com/codepipeline/latest/userguide/concepts-continuous-delivery-integration.html)

- [Continuous Delivery](https://aws.amazon.com/devops/continuous-delivery/)
  - load testing, integration testing, API reliability testing
  - least downtime deployment
- [Continous Integration](https://aws.amazon.com/devops/continuous-integration/)
  - merge code
  - version control

3. What use cases?

- [Backend APIs CI/CD Pipeline]()
- [Web/Mobile App CI/CD Pipeline](https://catalog.us-east-1.prod.workshops.aws/workshops/cc4e013e-6779-4574-9672-ff201b76282d/en-US/architecture)
- [Machine Learning CI/CD Pipeline](https://github.com/entest-hai/hello-sagemaker-pipeline)
- [CI/CD for Android App](https://aws.amazon.com/blogs/mobile/build-a-cicd-pipeline-for-your-android-app-with-aws-services/)
- [Mobile App Automation Test](https://docs.aws.amazon.com/codepipeline/latest/userguide/tutorials-codebuild-devicefarm.html)
- [Appium Python](https://github.com/aws-samples/aws-device-farm-appium-python-tests-for-android-sample-app/blob/master/tests/tests/login_test.py)
- [Appium Java](https://github.com/aws-samples/aws-device-farm-appium-tests-for-sample-app)

4. How to implement CI/CD?

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

## CodeBuild to Run Unit Tests

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
          commands: ["pip isntall -r requirements.txt"],
        },
        build: {
          commands: ["python -m pytest -s -v test/fhr_unittest.py"],
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

## CodeDeploy to Deploy the Application Stack

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
const pipeline = new aws_codepipeline.Pipeline(this, "SwinDevOpsDemoPipeline", {
  pipelineName: "SwinDevOpsDemoPipeline",
  stages: [
    {
      stageName: "Source",
      actions: [
        new aws_codepipeline_actions.CodeCommitSourceAction({
          actionName: "CodeCommit",
          repository: repo,
          branch: "master",
          output: sourceOutput,
        }),
      ],
    },
    {
      stageName: "Unittest",
      actions: [
        new aws_codepipeline_actions.CodeBuildAction({
          actionName: "DoUnitest",
          project: unittestCodeBuild,
          input: sourceOutput,
          outputs: [unitestCodeBuildOutput],
        }),
      ],
    },
    {
      stageName: "BuildTemplate",
      actions: [
        new aws_codepipeline_actions.CodeBuildAction({
          actionName: "BuildCfnTemplate",
          project: cdkCodeBuild,
          input: sourceOutput,
          outputs: [cdkBuildOutput],
        }),
      ],
    },
    {
      stageName: "Deploy",
      actions: [
        new aws_codepipeline_actions.CloudFormationCreateUpdateStackAction({
          actionName: "DeployApplication",
          templatePath: cdkBuildOutput.atPath("ApplicationStack.template.json"),
          stackName: "PreProductApplicationStack",
          adminPermissions: true,
        }),
      ],
    },
  ],
});
```
