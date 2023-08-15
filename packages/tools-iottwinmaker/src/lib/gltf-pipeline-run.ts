const gltfPipeline = require("gltf-pipeline");
const fsExtra = require("fs-extra");
// const processGltf = gltfPipeline.processGltf;
import * as path from 'path';
// const gltfPipeline = require("gltf-pipeline");
// const fsExtra = require("fs-extra");
// const gltfToGlb = gltfPipeline.gltfToGlb;
// const gltf = fsExtra.readJsonSync("./input/model.gltf");
// const options = { resourceDirectory: "./input/" };
const processGltf = gltfPipeline.processGltf;

// const gltfPipeline = require("gltf-pipeline");
// const fsExtra = require("fs-extra");

async function run_gltf_pipeline(gltfPath: string, gltfResourceDir: string, glbOutPath: string) {
  const gltf = fsExtra.readJsonSync(gltfPath);
  const options = {
    resourceDirectory: gltfResourceDir,
    dracoOptions: {
      compressionLevel: 10,
    },
  };
  await processGltf(gltf, options).then(function (results: any) {
    fsExtra.writeJsonSync(path.join(gltfResourceDir, 'temp.draco.gltf'), results.gltf);
  });

  const gltfToGlb = gltfPipeline.gltfToGlb;
  const draco_gltf = fsExtra.readJsonSync(path.join(gltfResourceDir, 'temp.draco.gltf')); // TODO see if this can be merged with above pipeline step instead of reading file twice...
  const draco_options = {
    resourceDirectory: gltfResourceDir,
    // dracoOptions: {
    //   compressionLevel: 10,
    // },
  };
  await gltfToGlb(draco_gltf, draco_options).then(function (results: any) {
    fsExtra.writeFileSync(glbOutPath, results.glb);
  });

  console.log('glbOutPath', glbOutPath);

  // const gltf = fsExtra.readJsonSync(gltfPath);
  //
  // const draco_options = {
  //   dracoOptions: {
  //     compressionLevel: 10,
  //   },
  // };
  //
  // await processGltf(gltf, draco_options).then(function (results: any) {
  //   fsExtra.writeJsonSync(path.join(gltfPath, ".draco.gltf"), results.gltf);
  // });
  //
  // const options = {
  //   resourceDirectory: gltfResourceDir
  // };
  //
  // const draco_gltf = fsExtra.readJsonSync(path.join(gltfPath, ".draco.gltf"));
  //
  // await gltfToGlb(draco_gltf, options).then(function (results: any) {
  //   fsExtra.writeFileSync(glbOutPath, results.glb);
  // });
  //
  // // await processGltf(gltf, options).then(function (results: any) {
  // //   fsExtra.writeJsonSync(glbOutPath, results.gltf);
  // // });
}

export {run_gltf_pipeline}
