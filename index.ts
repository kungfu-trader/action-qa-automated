import { dispatch, Argv } from "./lib";
import { getInput, setFailed } from "@actions/core";
import { context } from "@actions/github";

const main = async function () {
  const argv: Argv = {
    token: getInput("token"),
    bucketPrebuilt: getInput("bucket-prebuilt"),
    workflow_id: getInput("workflow_id"),
    ref: getInput("qa_automated_ref"),
    repo: getInput("qa_automated_repo"),
    artifactName: getInput("artifact_name"),
    artifactVersion: getInput("artifact_version"),
    owner: context.payload.repository?.owner.login!,
    pullRequestTitle: context.payload?.pull_request?.title,
  };
  await dispatch(argv);
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    setFailed(error.message);
  });
}
