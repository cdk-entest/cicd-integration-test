import {
  aws_apigateway,
  aws_lambda,
  CfnOutput,
  Duration,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import * as fs from "fs";

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
      code: aws_lambda.Code.fromInline(
        fs.readFileSync(path.resolve(__dirname, "./../lambda/index.py"), {
          encoding: "utf-8",
        })
      ),
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
}
