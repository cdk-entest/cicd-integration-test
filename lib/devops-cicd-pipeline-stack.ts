import {
  aws_codebuild,
  aws_codecommit,
  aws_codepipeline,
  aws_codepipeline_actions,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export class DevopsCicdPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // source code - code commit
    const repo = aws_codecommit.Repository.fromRepositoryName(
      this,
      "SwinDevOpsDemoRepo",
      "SwinDevOpsDemoRepo"
    );

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
              commands: ["pip install -r requirements.txt"],
            },
            build: {
              commands: ["python -m pytest -s -v test/fhr_unittest.py"],
            },
          },
          artifacts: {},
        }),
      }
    );

    // codebuild cdk template
    const cdkCodeBuild = new aws_codebuild.PipelineProject(
      this,
      "CodeBuildCdk",
      {
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
      }
    );

    // source output
    const sourceOutput = new aws_codepipeline.Artifact("SourceCode");
    const unitestCodeBuildOutput = new aws_codepipeline.Artifact(
      "UnittestBuildOutput"
    );
    const cdkBuildOutput = new aws_codepipeline.Artifact("CdkBuildOutput");

    // pipeline
    const pipeline = new aws_codepipeline.Pipeline(
      this,
      "SwinDevOpsDemoPipeline",
      {
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
        ],
      }
    );
  }
}
