import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { Octokit } from "@octokit/rest";
import { sync as globSync } from "glob";
import semver from "semver";

export interface Argv {
  token: string;
  bucketPrebuilt: string;
  owner: string;
  repo: string;
  workflow_id: string;
  ref: string;
  artifactName?: string;
  artifactVersion?: string;
}

const spawnOpts = {
  shell: true,
  stdio: "pipe",
  encoding: "utf-8",
  windowsHide: true,
};

export const dispatch = async function (argv: Argv) {
  const octokit = new Octokit({
    auth: argv.token,
  });
  const s3BaseUrl = await getBaseUrl(argv);
  const files = getFileList(argv);
  const items = files.filter(
    ({ Key }) => Key.endsWith(".zip") && Key.includes("win-x64")
  );
  for (const { Key } of items) {
    await octokit
        .request(
            "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
            {
                owner: argv.owner,
                repo: argv.repo,
                workflow_id: argv.workflow_id,
                ref: argv.ref,
                inputs: {
                    app_zip_pack_url: s3BaseUrl + Key,
                },
                headers: {
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            }
        )
        .catch((e) => console.error(e));
  }
};

const getBaseUrl = async ({ bucketPrebuilt }: Argv) => {
  const s3Location = awsOutput([
    "s3api",
    "get-bucket-location",
    "--bucket",
    bucketPrebuilt,
    "--output",
    "text",
  ]);
  const s3BaseUrlGlobal = `https://${bucketPrebuilt}.s3.amazonaws.com/`;
  const s3BaseUrlCN = `https://${bucketPrebuilt}.s3.${s3Location}.amazonaws.com.cn/`;
  return s3Location.startsWith("cn") ? s3BaseUrlCN : s3BaseUrlGlobal;
};

const getFileList = (argv: Argv) => {
  const artifactMap = argv.artifactName
    ? [argv.artifactName]
    : getArtifactMap();
  const version = formatVersion(
    argv.artifactVersion ? argv.artifactVersion : currentVersion()
  );
  return artifactMap
    .map((v) =>
      scanFolder({
        bucketPrebuilt: argv.bucketPrebuilt,
        artifact: v,
        version,
      })
    )
    .flat();
};

type ScanFolder = {
  bucketPrebuilt: string;
  artifact: string;
  version: string;
};

const scanFolder = ({
  bucketPrebuilt,
  artifact,
  version,
}: ScanFolder): Array<any> => {
  const s3Objects = awsCall(
    [
      "s3api",
      "list-objects-v2",
      `--bucket ${bucketPrebuilt}`,
      `--prefix ${artifact}/${version}/`,
      "--output json",
    ],
    spawnOpts
  )?.stdout.toString("utf-8");
  const items = JSON.parse(s3Objects)?.Contents;
  return Array.isArray(items) ? items : [];
};

function awsOutput(args: Array<string>) {
  const result = awsCall(args, spawnOpts);
  return result.output
    .filter((e) => e && e.length > 0)
    .toString()
    .trimEnd();
}

function awsCall(
  args: Array<string>,
  opts: { [key: string]: string | boolean }
) {
  console.log(`$ aws ${args.join(" ")}`);
  const result = spawnSync("aws", args, opts);
  if (result.status !== 0) {
    throw new Error(`Failed to call aws with status ${result.status}`);
  }
  return result;
}

const getArtifactMap = () => {
  const cwd = process.cwd();
  const artifacts = globSync("artifact*/package.json")
    .map((v) => getArtifactName(cwd, v))
    .filter((v) => v);
  return artifacts.length > 0 ? artifacts : [getArtifactName(cwd)];
};

const getArtifactName = (cwd = process.cwd(), link = "package.json") => {
  return JSON.parse(
    fs.readFileSync(path.join(cwd || process.cwd(), link)).toString("utf-8")
  )?.name?.split("/")?.[1];
};

const currentVersion = (): string => {
  const configPath = fs.existsSync("lerna.json")
    ? "lerna.json"
    : "package.json";
  const config = JSON.parse(fs.readFileSync(configPath).toString("utf-8"));
  return config.version;
};

const formatVersion = (str: string) => {
  const { major, version } = semver.parse(str) as any;
  return `v${major}/v${version}`;
};
