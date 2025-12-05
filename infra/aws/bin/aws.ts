import * as cdk from "aws-cdk-lib";
import { getConfig } from "../lib/config";
import { ApiStack } from "../lib/stacks/api";
import { DownloaderStack } from "../lib/stacks/downloader";
import { StorageStack } from "../lib/stacks/storage";
import { WorkerStack } from "../lib/stacks/worker";

const app = new cdk.App();

const stage =
  app.node.tryGetContext("stage") ||
  process.env.STAGE ||
  process.env.NODE_ENV ||
  "prod";

const config = getConfig(stage);

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "eu-west-2"
};

const storage = new StorageStack(app, "MixcutStorageStack", { env });

const downloader = new DownloaderStack(app, "MixcutDownloaderStack", {
  env,
  config,
  audioDownloadsBucket: storage.audioDownloadsBucket,
});
downloader.addDependency(storage);

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
  outputsBucket: storage.outputsBucket,
  queue: worker.queue,
  validatorFunction: worker.validatorFunction
});
api.addDependency(storage);
api.addDependency(worker);
