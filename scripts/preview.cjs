// Local development aid: real controllers and compiled WXML, browser equivalents of native APIs.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const compiler = require('miniprogram-compiler');
const { createResourcePreview } = require('./resource-audio-preview.cjs');
const settings = require('../miniprogram/resource-config');
const resourceDirectory = process.env.RESOURCE_PREVIEW_ROOT;
function resourcePreview() {
  const dataFile = require.resolve('../miniprogram/data/generated'); delete require.cache[dataFile];
  return createResourcePreview(require(dataFile), {directory: resourceDirectory, baseUrl: settings.baseUrl});
}
const root = path.resolve(__dirname, '../miniprogram');
const port = Number(process.env.PREVIEW_PORT || 4173);
const runtime = fs.readFileSync(path.join(__dirname, 'preview-runtime.js'), 'utf8');
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
function bundle() {
  const sources = {}, styles = {};
  for (const file of walk(root)) {
    const name = path.relative(root, file).split(path.sep).join('/');
    if (name.endsWith('.js')) sources[name] = fs.readFileSync(file, 'utf8');
    if (name.endsWith('.wxss')) styles[name] = fs.readFileSync(file, 'utf8');
  }
  const data = resourcePreview().data;
  sources['data/generated.js'] = 'module.exports=' + JSON.stringify(data);
  sources['config.js'] = 'module.exports={showDraftPronunciations:true,allowPreviewAudio:false,allowSyntheticWordAudio:true};';
  return 'window.PHONICS_PREVIEW=' + JSON.stringify({ sources, styles, compiler: compiler.wxmlToJs(root) }) + ';\n' + runtime;
}
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>拼读星球 · 开发预览</title><style>
html,body{margin:0;background:#e8ece4;font-family:system-ui;color:#193c3a}.dev-note{max-width:1000px;margin:24px auto;padding:0 20px;font-size:13px;line-height:1.6}#shell{max-width:420px;margin:20px auto;background:#f7f6ef;border:1px solid #d3dcd0;border-radius:28px;overflow:hidden;box-shadow:0 20px 70px #173c3a18}#nav{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #e1e6dc;font-size:14px}#nav button{width:auto;flex:none;background:none;color:#193c3a;border:0;min-height:36px;padding:4px 8px;margin:0;font-size:14px}#app{min-height:750px}.preview-toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#193c3a;color:white;padding:14px 22px;border-radius:16px;z-index:10}a{text-decoration:none}button{cursor:pointer;width:100%;font:inherit}input{width:100%;box-sizing:border-box}img{display:block;object-fit:cover}button:disabled{cursor:default}.audio-host{display:block}@media(max-width:480px){#shell{margin:0;border:0;border-radius:0;max-width:none}.dev-note{margin:10px auto}}
</style><style id="app-style"></style><div class="dev-note">AI 合成试听 · Emma 英式女声 · 待发音核对。${resourceDirectory ? "读取本地 resource 仓库，尚不代表远端已发布。" : "使用远程资源地址，需先发布资源。"} 浏览器预览不替代微信下载缓存及真机验收。</div><main id="shell"><header id="nav"><button id="back">‹ 返回</button><span>拼读星球</span><button id="home">⌂ 首页</button></header><div id="app"></div></main><script src="/preview.js"></script></html>`;
http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if (pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
  if (pathname === '/preview.js') { try { res.setHeader('Content-Type', 'application/javascript; charset=utf-8'); res.end(bundle()); } catch (e) { res.statusCode = 500; res.end(e.message); } return; }
  const previewMatch = pathname.match(/^\/resource-audio\/(word_[a-z0-9_]+)\.mp3$/);
  if (previewMatch) {
    try {
      const bytes = resourcePreview().readAudio(previewMatch[1]);
      res.setHeader('Content-Type', 'audio/mpeg'); res.setHeader('Content-Length', bytes.length);
      res.setHeader('Cache-Control', 'no-store'); res.end(bytes);
    } catch (_) { res.statusCode = 503; res.end('Resource audio missing or integrity check failed'); }
    return;
  }
  if (pathname.startsWith('/assets/')) {
    const target = path.resolve(root, '.' + decodeURIComponent(pathname));
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { res.statusCode = 404; res.end(); return; }
    res.setHeader('Content-Type', target.endsWith('.jpg') ? 'image/jpeg' : target.endsWith('.png') ? 'image/png' : target.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream'); fs.createReadStream(target).pipe(res); return;
  }
  res.statusCode = 404; res.end('Not found');
}).listen(port, '127.0.0.1', () => console.log('Local preview: http://127.0.0.1:' + port + ' (not a WeChat runtime)'));
