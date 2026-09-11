const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const root = path.resolve(__dirname,'..');
function walk(dir) {return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for (const f of [...walk(path.join(root,'miniprogram')),...walk(path.join(root,'scripts')),...walk(path.join(root,'tests'))]) {
  if (/\.(js|cjs)$/.test(f)) cp.execFileSync(process.execPath,['--check',f]);
  if (f.endsWith('.json')) JSON.parse(fs.readFileSync(f,'utf8'));
}
const app=JSON.parse(fs.readFileSync(path.join(root,'miniprogram/app.json')));
for(const p of app.pages) for(const ext of ['js','json','wxml','wxss']) if(!fs.existsSync(path.join(root,'miniprogram',p+'.'+ext))) throw Error('Missing page file '+p+'.'+ext);
if(!fs.existsSync(path.join(root,'miniprogram/assets/images/planet-hero.jpg'))) throw Error('Missing hero image');
console.log('JS syntax, JSON and page file checks passed; WeChat runtime verification remains manual.');
