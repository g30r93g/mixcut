import * as cdk from "aws-cdk-lib";
import {
  DockerImageCode,
  DockerImageFunction
} from "aws-cdk-lib/aws-lambda";
import {
  LambdaIntegration,
  PassthroughBehavior,
  RestApi
} from "aws-cdk-lib/aws-apigateway";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { join } from "path";
import { DownloaderStackProps } from "../types";

export class DownloaderStack extends cdk.Stack {
  readonly downloaderFunction: DockerImageFunction;

  constructor(scope: Construct, id: string, props: DownloaderStackProps) {
    super(scope, id, props);

    const logGroup = new LogGroup(this, "DownloaderLogGroup", {
      retention: RetentionDays.ONE_WEEK
    });

    this.downloaderFunction = new DockerImageFunction(
      this,
      "DownloaderFunction",
      {
        code: DockerImageCode.fromImageAsset(
          join(
            __dirname,
            "..",
            "..",
            "..",
            "..",
            "services",
            "downloader"
          ),
          {
            platform: cdk.aws_ecr_assets.Platform.LINUX_AMD64
          }
        ),
        timeout: cdk.Duration.minutes(10),
        memorySize: 1024,
        ephemeralStorageSize: cdk.Size.mebibytes(2048),
        logGroup,
        environment: {
          AUDIO_DOWNLOADS_BUCKET: props.audioDownloadsBucket.bucketName
        }
      }
    );

    props.audioDownloadsBucket.grantWrite(this.downloaderFunction);

    const api = new RestApi(this, "DownloaderApi", {
      restApiName: "mixcut-downloader",
      deployOptions: {
        stageName: "prod"
      },
      defaultCorsPreflightOptions: {
        allowOrigins: [
          "http://localhost:3000",
          "https://mixcut-jet.vercel.app"
        ],
        allowMethods: ["OPTIONS", "POST"],
        allowHeaders: ["Content-Type"],
        statusCode: 200
      }
    });

    const downloadResource = api.root.addResource("download");
    const integration = new LambdaIntegration(this.downloaderFunction, {
      proxy: true,
      passthroughBehavior: PassthroughBehavior.WHEN_NO_MATCH
    });
    downloadResource.addMethod("POST", integration);

    new cdk.CfnOutput(this, "DownloaderApiUrl", {
      value: api.url
    });
  }
}
