const path = require('node:path');
const fs = require('node:fs');
const compiler = require('miniprogram-compiler');
const root = path.resolve(__dirname, '../miniprogram');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
global.window = {};
const factory = new Function('global', compiler.wxmlToJs(root))({});
for (const page of app.pages) {
  const render = factory(page + '.wxml');
  if (typeof render !== 'function') throw Error('Missing compiled template: ' + page);
}
compiler.wxssToJs(root);
console.log('WCC/WCSC compiled all ' + app.pages.length + ' pages and shared components.');
