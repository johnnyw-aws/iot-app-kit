// @ts-nocheck

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
import * as http from "http"

// const gltfPipeline = require("gltf-pipeline");
// const fsExtra = require("fs-extra");
// import {get_with_host} from "./revit_request"
import fetch from 'node-fetch';

async function extract_revit_properties(urnBase64: string) {
  console.log("entering extract_revit_properties...");
  // var response: any = await get_with_host(`http://localhost/data/${urnBase64}/load`);

  // var response: any = await get_with_host('http://127.0.0.1', `/data/${urnBase64}/progress`);

  // var response: any = await fetch(`http://localhost/data/${urnBase64}/progress`, {
  //   method: 'GET'
  // })

  // await http.get(`http://localhost/data/${urnBase64}/progress`, resp => {
  //   console.log('resp', resp);
  //   return resp;
  // });

  var response = await fetch(`http://localhost/data/${urnBase64}/load/progress`);
  var data: any = await response.json();

  while(data['status'] != 'completed') {
    response = await fetch(`http://localhost/data/${urnBase64}/load/progress`);
    data = await response.json();
  }

  console.log("property server load completed!")

  response = await fetch(`http://localhost/data/${urnBase64}/properties/*`);
  data = await response.text();

  console.log("properties/* completed!");

  // console.log('properties.txt', data);

  var properties_json = data.substring(data.indexOf('{'))
  console.log(properties_json.substring(0, 10), "...")
  console.log("...", properties_json.slice(-10, -1))

  return properties_json;
}

export {extract_revit_properties}
