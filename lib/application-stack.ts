import { aws_lambda, Duration, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

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
