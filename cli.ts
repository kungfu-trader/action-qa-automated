import { dispatch, Argv } from "./lib";
// import * as yargs from 'yargs';
const yargs = require("yargs");
const cmdArgv = yargs(process.argv.slice(2))
  .option("token", { description: "token", type: "string", default: "" })
  .option("bucketPrebuilt", {
    description: "bucketPrebuilt",
    type: "string",
    default: "kungfu-prebuilt",
  })
  .option("workflow_id", {
    description: "workflow_id",
    type: "string",
    default: "manually.yaml",
  })
  .option("ref", { description: "ref", type: "string", default: "main" })
  .option("owner", { description: "owner", type: "string" })
  .option("repo", { description: "repo", type: "string" })
  .help()
  .parseSync();

const argv: Argv = {
  token: cmdArgv.token,
  bucketPrebuilt: cmdArgv.bucketPrebuilt,
  workflow_id: cmdArgv.workflow_id,
  ref: cmdArgv.ref,
  owner: cmdArgv.owner,
  repo: cmdArgv.repo,
};

dispatch(argv).catch(console.error);
