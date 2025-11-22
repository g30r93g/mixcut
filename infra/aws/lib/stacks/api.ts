import * as cdk from "aws-cdk-lib";
import {
  LambdaIntegration,
  PassthroughBehavior,
  RestApi
} from "aws-cdk-lib/aws-apigateway";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import { join } from "path";
import { ApiStackProps } from "../types";

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const jobApiLogGroup = new LogGroup(this, "JobApiLogGroup", {
      retention: RetentionDays.ONE_WEEK
    });

    const jobApiFn = new NodejsFunction(this, "JobApiFunction", {
      entry: join(
        __dirname,
        "..",
        "..",
        "..",
        "..",
        "services",
        "api",
        "src",
        "handler.ts"
      ),
      handler: "handler",
      runtime: Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logGroup: jobApiLogGroup,
      environment: {
        UPLOADS_BUCKET: props.uploadsBucket.bucketName,
        JOBS_QUEUE_URL: props.queue.queueUrl,
        SUPABASE_URL: props.config.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: props.config.SUPABASE_SERVICE_ROLE_KEY,
        VALIDATOR_FUNCTION_NAME: props.validatorFunction.functionName
      }
    });

    props.validatorFunction.grantInvoke(jobApiFn);

    props.uploadsBucket.grantReadWrite(jobApiFn);
    props.outputsBucket.grantReadWrite(jobApiFn);
    props.queue.grantSendMessages(jobApiFn);

    const api = new RestApi(this, "MixcutApi", {
      restApiName: "mixcut-api",
      deployOptions: {
        stageName: "prod"
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ["http://localhost:3000"],
        allowMethods: ["OPTIONS", "GET", "POST"],
        allowHeaders: ["Content-Type"],
        statusCode: 200
      }
    });

    const jobs = api.root.addResource("jobs");
    const jobIntegration = new LambdaIntegration(jobApiFn, {
      proxy: true,
      passthroughBehavior: PassthroughBehavior.WHEN_NO_MATCH
    });

    // POST /jobs  – create job & presigned URLs
    jobs.addMethod("POST", jobIntegration);

    // /jobs/{id}
    const jobById = jobs.addResource("{id}");
    jobById.addMethod("GET", jobIntegration); // status

    // /jobs/{id}/start – trigger validation
    const start = jobById.addResource("start");
    start.addMethod("POST", jobIntegration);

    // /jobs/{id}/bundle – generate zip of outputs
    const bundle = jobById.addResource("bundle");
    bundle.addMethod("GET", jobIntegration);

    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url
    });
  }
}
