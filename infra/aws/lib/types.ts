import * as cdk from "aws-cdk-lib";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { IQueue } from "aws-cdk-lib/aws-sqs";

export interface StorageStackProps extends cdk.StackProps {}

export interface WorkerStackProps extends cdk.StackProps {
  uploadsBucket: IBucket;
  outputsBucket: IBucket;
}

export interface ApiStackProps extends cdk.StackProps {
  uploadsBucket: IBucket;
  queue: IQueue;
}
