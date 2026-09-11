// Checks the exact files named by the application manifest, without credentials.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createUrlProvider, isResourceDescriptor } = require('../miniprogram/services/resource-service');
const settings = require('../miniprogram/resource-config');
const samples = require('../seed-data/resource-samples.json').concat(require('../seed-data/audio-manifest.json').filter(a => a.src && a.src.startsWith('resource://')));
const provider = createUrlProvider(settings.baseUrl);
const localIndex = process.argv.indexOf('--local');
const directory = localIndex < 0 ? null : process.argv[localIndex + 1];
if (localIndex >= 0 && !directory) throw Error('--local needs a resource repository path');
(async () => {
  for (const sample of samples) {
    try {
      if (!isResourceDescriptor(sample)) throw Error('Invalid descriptor');
      const url = provider(sample);
      let bytes;
      if (directory) bytes = fs.readFileSync(path.join(directory, sample.src.slice('resource://'.length)));
      else {
        const response = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'follow' });
        if (!response.ok) throw Error('HTTP ' + response.status);
        bytes = Buffer.from(await response.arrayBuffer());
      }
      if (bytes.length !== sample.bytes || crypto.createHash('sha1').update(bytes).digest('hex') !== sample.sha1) throw Error('Content/size mismatch (possibly a login or error page)');
      console.log('PASS', sample.id, bytes.length + ' bytes', directory ? 'local' : 'anonymous HTTPS');
    } catch (error) { process.exitCode = 1; console.error('FAIL', sample.id, error.message); }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
