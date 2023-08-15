// @ts-nocheck

// https://github.com/petrbroz/forge-convert-utils

const path = require('path');
const { ModelDerivativeClient, ManifestHelper } = require('forge-server-utils');
const { SvfReader, GltfWriter } = require('forge-convert-utils');

// const { FORGE_CLIENT_ID, FORGE_CLIENT_SECRET } = process.env;

async function run(urn: any, outputDir: any, forge_client_id: string, forge_client_secret: string) {
  // const auth = { client_id: FORGE_CLIENT_ID, client_secret: FORGE_CLIENT_SECRET };
  const auth = { client_id: forge_client_id, client_secret: forge_client_secret };
  const modelDerivativeClient = new ModelDerivativeClient(auth);
  const manifestHelper = new ManifestHelper(await modelDerivativeClient.getManifest(urn));
  const derivatives = manifestHelper.search({ type: 'resource', role: 'graphics' });
  const readerOptions = {
    // log: console.log
  };
  const writerOptions = {
    deduplicate: true,
    skipUnusedUvs: true,
    center: true,
    // log: console.log,
    // filter: (dbid: any) => (dbid >= 100 && dbid <= 200) // only output objects with dbIDs between 100 and 200
  };
  const writer = new GltfWriter(writerOptions);
  for (const derivative of derivatives.filter(d => d.mime === 'application/autodesk-svf')) {
    const reader = await SvfReader.FromDerivativeService(urn, derivative.guid, auth);
    const scene = await reader.read(readerOptions);
    await writer.write(scene, path.join(outputDir, derivative.guid));
  }
}

export { run }
