const https = require('https');
const querystring = require('querystring');

const FORGE_HOST = 'developer.api.autodesk.com';

function request(options: any, body: any, json: any) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res: any) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: any) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(json ? JSON.parse(data) : data);
        } else {
          reject(data); // reject(JSON.parse(data));
        }
      });
      res.on('error', (err: any) => reject(err));
    });
    req.on('error', (err: any) => reject(err));
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function get(path: any, headers = {}, json = true) {
  return request({
    method: 'GET',
    host: FORGE_HOST,
    path,
    headers
  }, null, json);
}

// TODO refactor
function get_with_host(host: string, path: any, headers = {}, json = true) {
  return request({
    method: 'GET',
    host: host,
    path,
    headers
  }, null, json);
}

function post(path: any, data: any, headers: any = {}, json = true) {
  let body = null;
  if (data.urlencoded) {
    body = querystring.stringify(data.urlencoded);
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (data.json) {
    body = JSON.stringify(data.json);
    headers['Content-Type'] = 'application/json';
  } else {
    throw new Error(`Content type not supported`);
  }

  headers['Content-Length'] = Buffer.byteLength(body);
  return request({ method: 'POST', host: FORGE_HOST, path, headers }, body, json);
}

function put(path: any, data: any, headers: any = {}, json = true) {
  headers['Content-Length'] = Buffer.byteLength(data);
  return request({ method: 'PUT', host: FORGE_HOST, path, headers }, data, json);
}

export {get, post, put, get_with_host}
