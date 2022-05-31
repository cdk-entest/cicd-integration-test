# DevOps on a cloud-based platform: A Case Study with AWS
- Continuous integration (CI) 
    - Unit tests 
    - Integration test 
    - Regression test 
    - API testing 
- Continous delivery (CD)
    - CodeDeploy 
    - Deployment testing
    - Manual and auto approval 
- Cross account/environment 
    - Further sepratation between development and production envionment
    - Protect production environment
    - For customer in another account

- Reference 
    - [DevOps Software Testing](https://test.io/devops#:~:text=Software%20testing%20in%20the%20DevOps,needed%20on%20the%20staging%20server.)   
    - **[aws-blog-ci-cd-pipeline-cross-account](https://aws.amazon.com/blogs/devops/building-a-ci-cd-pipeline-for-cross-account-deployment-of-an-aws-lambda-api-with-the-serverless-framework/)**
    - **[workshop-ci-cid-pipeline-cross-account](https://catalog.us-east-1.prod.workshops.aws/v2/workshops/00bc829e-fd7c-4204-9da1-faea3cf8bd88/)**

## Architecture
CI/CD pipeline architecture 
![cross_account_ci_cd_pipeline drawio (1)](https://user-images.githubusercontent.com/20411077/153972206-e9ed989b-78d4-43b8-8a07-48d282375f8d.png)

CI/CD pipeline from AWS Console 
<img width="1678" alt="Screen Shot 2022-05-31 at 09 54 32" src="https://user-images.githubusercontent.com/20411077/171084502-afb261b9-5649-4bb3-8033-5e26af8058d9.png">

CI/CD pipeline from AWS Console 
<img width="1678" alt="Screen Shot 2022-05-31 at 09 55 01" src="https://user-images.githubusercontent.com/20411077/171084539-f5a1ed62-aeef-467f-b650-f7793db5b712.png">


## Setup CDK project

create an empty directory

```
mkdir cdk-test-cicd-pipeline
```

init cdk project

```
cdk init --language=typescript
```

## Create a CodeCommit by a repository stack

create lib/repository-stack.ts

```
import { aws_codecommit } from "aws-cdk-lib";
import { App, Stack, StackProps } from "aws-cdk-lib";

export class RepositoryStack extends Stack {
    constructor(app: App, id: string, props?: StackProps) {

        super(app, id, props);

        new aws_codecommit.Repository(this, 'CodeCommitRepo', {
            repositoryName: `repo-${this.account}`
        });

    }
}
```

## Create a lambda stack for testing purpose

create lib/lambda-stack.ts

```
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_lambda } from 'aws-cdk-lib';
const path = require("path")

export class LambdaStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        new aws_lambda.Function(
            this,
            "CdkTsLambdaFunctionTest",
            {
                runtime: aws_lambda.Runtime.PYTHON_3_8,
                handler: "handler.handler",
                code: aws_lambda.Code.fromAsset(
                    path.join(__dirname, "lambda")
                )
            }
        )

    }
}

```

## Build and check CDK generated stacks

```
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkTsCicdPipelineStack } from '../lib/cdk-ts-cicd-pipeline-stack';
import { RepositoryStack } from '../lib/repository-stack';
import { LambdaStack } from '../lib/lambda-stack';

const app = new cdk.App();
new CdkTsCicdPipelineStack(app, 'CdkTsCicdPipelineStack', {

});

new LambdaStack(app, "CdkTsLambdaStack", {

})

new RepositoryStack(app, 'CdkTsRepositoryStack', {

})
```

build and check stacks

```
npm install
npm run build
cdk ls
```

should see multiple stack

```
CdkTsCicdPipelineStack
CdkTsLambdaStack
CdkTsRepositoryStack
```

Deploy a stack and test output

```
cdk deploy CdkTsLambdaStack
```

## Application Stack

This is a smple lambda function with code from local assset folder. The important thing is that

- CodeBuild will output DevApplicationStack.template.json in the artifact bucket
- CodeBuild will output ProdApplicationStack.template.json in the artifact bucket
- CloudFormation running in the production account need to access the artifact bucket in the dev environment that is why we need roles below. This is the application stack which is a simple lambda api.

```
import { aws_lambda } from "aws-cdk-lib";
import { aws_apigateway } from "aws-cdk-lib";
import { App, Stack, StackProps } from "aws-cdk-lib";
import * as path from "path"

export interface ApplicationStackProps extends StackProps {
    readonly stageName: string
}

export class ApplicationStack extends Stack {

    // lambad code from
    public readonly lambdaCode: aws_lambda.CfnParametersCode;

    // constructor
    constructor(app: App, id: string, props: ApplicationStackProps) {
        super(app, id, props);

        // lambda code
        this.lambdaCode = aws_lambda.Code.fromCfnParameters();

        // create a lambda function
        const lambda_function = new aws_lambda.Function(
            this,
            `CdkTsLambdaApplicationFunction-${props.stageName}`,
            {
                runtime: aws_lambda.Runtime.NODEJS_12_X,
                handler: "index.handler",
                code: this.lambdaCode,
                environment: {
                    STAGE_NAME: props.stageName
                }
            }
        );
        // create an api gateway
        new aws_apigateway.LambdaRestApi(
            this,
            `CdkTsApiGatewayRestApi-${props.stageName}`,
            {
                handler: lambda_function,
                endpointExportName: `CdkTsLambdaRestApiEndpoint-${props.stageName}`,
                deployOptions: {
                    stageName: props.stageName
                }
            }
        );

        // lambda version alias function

        // codedeploy

    }
}
```

## CodePipeline Stack

- The CodePipeline lives in the dev account
- The CodePipeline need to deploy things into the production account
- Need to assume role which setup from the production account

This role enables creating resources inside the productiona account

```
 const prodDeploymentRole = aws_iam.Role.fromRoleArn(
      this,
      "ProdDeploymentRole",
      `arn:aws:iam::product_account_id:role/CloudFormationDeploymentRole`, {
      mutable: false
    }
    )
```

and this role enables accessing the S3 artifact from the production account

```
const prodCrossAccountRole = aws_iam.Role.fromRoleArn(
    this,
    "ProdCrossAccountRole",
    `arn:aws:iam::product_account_id:role/CdkCodePipelineCrossAcccountRole`, {
    mutable: false
}
    )
```

## CodeBuild

- Build the lambda code
- Build the application stack

```
stageName: 'Build',
    actions: [
    new aws_codepipeline_actions.CodeBuildAction({
        actionName: 'Application_Build',
        project: lambdaBuild,
        input: sourceOutput,
        outputs: [lambdaBuildOutput],
    }),
    new aws_codepipeline_actions.CodeBuildAction({
        actionName: 'CDK_Synth',
        project: cdkBuild,
        input: sourceOutput,
        outputs: [cdkBuildOutput],
    }),
    ],
```

## CodeDeploy

- Deploy the application stack into the dev environment

```
stageName: 'Deploy_Dev',
    actions: [
    new aws_codepipeline_actions.CloudFormationCreateUpdateStackAction({
        actionName: 'Deploy',
        templatePath: cdkBuildOutput.atPath('DevApplicationStack.template.json'),
        stackName: 'DevApplicationDeploymentStack',
        adminPermissions: true,
        parameterOverrides: {
        ...props.devApplicationStack.lambdaCode.assign(lambdaBuildOutput.s3Location),
        },
        extraInputs: [lambdaBuildOutput]
    })
    ],
```

- Deploy the application stack into the production environment

```
stageName: 'Deploy_Prod',
    actions: [
    new aws_codepipeline_actions.CloudFormationCreateUpdateStackAction({
        actionName: 'Deploy',
        templatePath: cdkBuildOutput.atPath('ProdApplicationStack.template.json'),
        stackName: 'ProdApplicationDeploymentStack',
        adminPermissions: true,
        parameterOverrides: {
        ...props.prodApplicationStack.lambdaCode.assign(lambdaBuildOutput.s3Location),
        },
        deploymentRole: prodDeploymentRole,
        cfnCapabilities: [CfnCapabilities.ANONYMOUS_IAM],
        role: prodCrossAccountRole,
        extraInputs: [lambdaBuildOutput],
    }),
    ],
```

Note to add the inline policy to the assume role

```
pipeline.addToRolePolicy(
      new aws_iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: ["arn:aws:iam::product_account_id:role/*"]
      }));
```

Note the KMS key which encrypt the S3 artifact bucket

```
new CfnOutput(
    this,
    "ArtifactBucketEncryptionKeyArn", {
    value: key.keyArn,
    exportName: "ArtifactBucketEncryptionKey"
});
```

## Policy CodePipelineCrossAccountRole

This allow the ProductionAccount when deploying CloudFormation can access the S3 ArtifactBucket where code for the Lambda function is stored.

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": [
                "cloudformation:*",
                "iam:PassRole"
            ],
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "s3:Get*",
                "s3:Put*",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::artifact-bucket-{DEV_ACCOUNT_ID}",
                "arn:aws:s3:::artifact-bucket-{DEV_ACCOUNT_ID}/*"
            ],
            "Effect": "Allow"
        },
        {
            "Action": [
                "kms:DescribeKey",
                "kms:GenerateDataKey*",
                "kms:Encrypt",
                "kms:ReEncrypt*",
                "kms:Decrypt"
            ],
            "Resource": "{KEY_ARN}",
            "Effect": "Allow"
        }
    ]
}
```

## Policy CloudFormationDeploymentRole

This allow the CloudFormation in the ProductionAccount can create resources when deploying stacks developed from the develop account.

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Action": "iam:PassRole",
            "Resource": "arn:aws:iam::{PROD_ACCOUNT_ID}:role/*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "iam:GetRole",
                "iam:CreateRole",
                "iam:AttachRolePolicy"
            ],
            "Resource": "arn:aws:iam::{PROD_ACCOUNT_ID}:role/*",
            "Effect": "Allow"
        },
        {
            "Action": "lambda:*",
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": "apigateway:*",
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": "codedeploy:*",
            "Resource": "*",
            "Effect": "Allow"
        },
        {
            "Action": [
                "s3:GetObject*",
                "s3:GetBucket*",
                "s3:List*"
            ],
            "Resource": [
                "arn:aws:s3:::artifact-bucket-{DEV_ACCOUNT_ID}",
                "arn:aws:s3:::artifact-bucket-{DEV_ACCOUNT_ID}/*"
            ],
            "Effect": "Allow"
        },
        {
            "Action": [
                "kms:Decrypt",
                "kms:DescribeKey"
            ],
            "Resource": "{KEY_ARN}",
            "Effect": "Allow"
        },
        {
            "Action": [
                "cloudformation:CreateStack",
                "cloudformation:DescribeStack*",
                "cloudformation:GetStackPolicy",
                "cloudformation:GetTemplate*",
                "cloudformation:SetStackPolicy",
                "cloudformation:UpdateStack",
                "cloudformation:ValidateTemplate"
            ],
            "Resource": "arn:aws:cloudformation:us-east-2:{PROD_ACCOUNT_ID}:stack/ProdApplicationDeploymentStack/*",
            "Effect": "Allow"
        }
    ]
}
```

## Connect to AWS CodeCommit by HTTPS

Goto AWS IAM console and download credential to access AWS CodeCommit

```
git config --global credential.helper '!aws codecommit credential-helper $@'
git config --global credential.UseHttpPath true
```
