import * as cdk from "aws-cdk-lib";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods
} from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { StorageStackProps } from "../types";

export class StorageStack extends cdk.Stack {
  readonly uploadsBucket: Bucket;
  readonly outputsBucket: Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    this.uploadsBucket = new Bucket(this, "UploadsBucket", {
      bucketName: undefined, // let AWS generate; or prefix if you want
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      eventBridgeEnabled: true,
      cors: [
        {
          allowedMethods: [HttpMethods.PUT, HttpMethods.GET],
          allowedOrigins: ["http://localhost:3000", "https://mixcut-jet.vercel.app"],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"]
        }
      ],
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(1)
        }
      ]
    });

    this.outputsBucket = new Bucket(this, "OutputsBucket", {
      bucketName: undefined,
      publicReadAccess: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS_ONLY,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      eventBridgeEnabled: true,
      cors: [
        {
          allowedMethods: [HttpMethods.GET],
          allowedOrigins: ["http://localhost:3000", "https://mixcut-jet.vercel.app"],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"]
        }
      ],
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(1)
        }
      ]
    });
    new cdk.CfnOutput(this, "UploadsBucketName", {
      value: this.uploadsBucket.bucketName
    });
    new cdk.CfnOutput(this, "OutputsBucketName", {
      value: this.outputsBucket.bucketName
    });
  }
}
