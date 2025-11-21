import * as cdk from "aws-cdk-lib";
import {
  DockerImageCode,
  DockerImageFunction,
  FunctionUrlAuthType,
  Runtime
} from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { join } from "path";
import { WorkerStackProps } from "../types";

export class WorkerStack extends cdk.Stack {
  readonly queue: Queue;

  constructor(scope: Construct, id: string, props: WorkerStackProps) {
    super(scope, id, props);

    const dlq = new Queue(this, "JobsDlq", {
      retentionPeriod: cdk.Duration.days(7)
    });

    this.queue = new Queue(this, "JobsQueue", {
      visibilityTimeout: cdk.Duration.minutes(15),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3
      }
    });

    const validatorLogGroup = new LogGroup(this, "ValidatorLogGroup", {
      retention: RetentionDays.ONE_WEEK
    });

    // Validator Lambda
    const validatorFn = new NodejsFunction(this, "ValidatorFunction", {
      entry: join(
        __dirname,
        "..",
        "..",
        "..",
        "..",
        "services",
        "validator",
        "src",
        "handler.ts"
      ),
      handler: "handler",
      runtime: Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logGroup: validatorLogGroup,
      environment: {
        UPLOADS_BUCKET: props.uploadsBucket.bucketName,
        JOBS_QUEUE_URL: this.queue.queueUrl,
        // Supabase envs will be injected at deploy-time
        SUPABASE_URL: process.env.SUPABASE_URL ?? "",
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
      }
    });

    props.uploadsBucket.grantRead(validatorFn);
    this.queue.grantSendMessages(validatorFn);

    // Worker Lambda (Docker image with m4acut)
    const workerLogGroup = new LogGroup(this, "WorkerLogGroup", {
      retention: RetentionDays.ONE_WEEK
    });

    const workerFn = new DockerImageFunction(this, "WorkerFunction", {
      code: DockerImageCode.fromImageAsset(
        join(__dirname, "..", "..", "..", "..", "services", "worker")
      ),
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048,
      ephemeralStorageSize: cdk.Size.mebibytes(2048),
      logGroup: workerLogGroup,
      environment: {
        UPLOADS_BUCKET: props.uploadsBucket.bucketName,
        OUTPUTS_BUCKET: props.outputsBucket.bucketName,
        SUPABASE_URL: process.env.SUPABASE_URL ?? "",
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
      }
    });

    workerFn.addEventSource(
      new SqsEventSource(this.queue, {
        batchSize: 1
      })
    );

    props.uploadsBucket.grantRead(workerFn);
    props.outputsBucket.grantWrite(workerFn);

    // Optional: function URL for debugging worker (invoke manually)
    workerFn.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE
    });

    new cdk.CfnOutput(this, "JobsQueueUrl", {
      value: this.queue.queueUrl
    });
  }
}
