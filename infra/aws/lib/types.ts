import { StackProps } from 'aws-cdk-lib';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { IQueue } from 'aws-cdk-lib/aws-sqs';
import { ConfigProps } from './config';

export interface AwsEnvStackProps extends StackProps {
  config: Readonly<ConfigProps>;
}

export interface StorageStackProps extends StackProps {}

export interface WorkerStackProps extends AwsEnvStackProps {
  uploadsBucket: IBucket;
  outputsBucket: IBucket;
}

export interface ApiStackProps extends AwsEnvStackProps {
  uploadsBucket: IBucket;
  outputsBucket: IBucket;
  queue: IQueue;
  validatorFunction: IFunction;
}
