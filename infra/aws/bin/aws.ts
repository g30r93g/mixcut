import * as cdk from "aws-cdk-lib";
import { getConfig } from "../lib/config";
import { ApiStack } from "../lib/stacks/api";
import { StorageStack } from "../lib/stacks/storage";
import { WorkerStack } from "../lib/stacks/worker";

const config = getConfig();

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "eu-west-2"
};

const storage = new StorageStack(app, "MixcutStorageStack", { env });

const worker = new WorkerStack(app, "MixcutWorkerStack", {
  env,
  config,
  uploadsBucket: storage.uploadsBucket,
  outputsBucket: storage.outputsBucket
});
worker.addDependency(storage);

const api = new ApiStack(app, "MixcutApiStack", {
  env,
  config,
  uploadsBucket: storage.uploadsBucket,
  queue: worker.queue
});
api.addDependency(storage);
api.addDependency(worker);
