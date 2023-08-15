// import {initDefaultAwsClients} from "./lib/aws-clients";

const {initDefaultAwsClients} = require("./lib/aws-clients");
const {constants} = require("../johnnywu-functional-tests/basic-functional/basic-functional-constants");
const {init} = require("./commands/init");
// const {Arguments} = require('yargs');
// const { ModelDerivativeClient, DataManagementClient, AuthenticationClient, get } = require('autodesk-forge-tools');


// import * as constants from "../johnnywu-functional-tests/basic-functional/basic-functional-constants";
// import * as init from "./commands/init";
// import { Arguments } from 'yargs';

async function main() {

  initDefaultAwsClients({region: "us-east-1"});
// const accountId = (await aws().getCurrentIdentity())['accountId'];
// const twinMakerRoleName = `${constants.workspaceId}-${accountId}-${constants.timestamp}-role`;
// const twinMakerPolicyName = `${twinMakerRoleName}PermissionPolicy`;
// const twinMakerRoleArn = `arn:aws:iam::${accountId}:role/${twinMakerRoleName}`;
// const workspaceS3BucketName = `${constants.workspaceId}-${accountId}`;
// const workspaceS3BucketArn = `arn:aws:s3:::${workspaceS3BucketName}`;
// const scene1S3Location = `s3://${workspaceS3BucketName}/${constants.scene1FileName}`;
// const model1S3Location = `s3://${workspaceS3BucketName}/${constants.model1FileName}`;
// const model2S3Location = `s3://${workspaceS3BucketName}/${constants.model2FileName}`;

// 4. Init tmdt project
// console.log(`Using init to initialize tmdt project in dir: ${constants.tmdtDirectory}`);
// argv2 = {
//   _: ['init'],
//   $0: 'tmdt_local',
//   region: constants.region,
//   'revit-json-file': '/Users/johnnywu/Desktop/phoenix_revit/snowdon.json',
//   out: '/tmp/revitTest/',
// } as Arguments<init.Options>;
// expect(await init.handler(argv2)).toBe(0);

  console.log(`Using init to initialize tmdt project in dir: ${constants.tmdtDirectory}`);
  var argv2 = {
    _: ['init'],
    $0: 'tmdt_local',
    region: constants.region,
    'revit-file': '/Users/johnnywu/Desktop/phoenix_revit/SnowdonSample.rvt',
    out: '/tmp/revitTest2/',
  };
  var res = await init.handler(argv2);
  console.log(res);

}

export {main}
