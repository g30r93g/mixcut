import * as cdk from "aws-cdk-lib";
import { ApiStack } from "../lib/stacks/api";
import { StorageStack } from "../lib/stacks/storage";
import { WorkerStack } from "../lib/stacks/worker";

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "eu-west-2"
};

const storage = new StorageStack(app, "MixcutStorageStack", { env });

const worker = new WorkerStack(app, "MixcutWorkerStack", {
  env,
  uploadsBucket: storage.uploadsBucket,
  outputsBucket: storage.outputsBucket
});
worker.addDependency(storage);

const api = new ApiStack(app, "MixcutApiStack", {
  env,
  uploadsBucket: storage.uploadsBucket,
  queue: worker.queue
});
api.addDependency(storage);
api.addDependency(worker);
