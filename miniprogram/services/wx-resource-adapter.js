const log = require('./diagnostic-log');
function createWxResourceAdapter(api, namespace) {
  if (!/^[a-z0-9-]+$/.test(namespace)) throw Error('缓存目录无效');
  const fs = api.getFileSystemManager();
  const root = api.env.USER_DATA_PATH + '/resources-' + namespace;
  const temporaryFiles = new Set();
  const isOwned = filePath => typeof filePath === 'string' && filePath.startsWith(root + '/') && /^[a-f0-9]{40}\.(mp3|wav|jpg|png)$/.test(filePath.slice(root.length + 1));
  try { fs.accessSync(root); } catch (_) { fs.mkdirSync(root, true); }
  const call = (method, args) => new Promise((resolve, reject) => fs[method]({ ...args, success: resolve, fail: e => { log.record('file.' + method + '.error', {args,error:e}); reject(Error(e.errMsg || '本地文件操作失败')); } }));
  async function describeHtml(filePath, contentType) {
    const summary = {responseSummary:null,summaryTruncated:false,summaryReadError:null,actualBytes:null};
    try {
      const info = await call('getFileInfo', {filePath});
      summary.actualBytes = info.size;
      const length = Math.min(info.size, 4096);
      if (!Number.isFinite(length) || length <= 0) { summary.summaryReadError = 'Empty or unavailable response body'; return summary; }
      const result = await call('readFile', {filePath,encoding:'utf8',position:0,length});
      if (result.data === '') {
        // Some native responses return an empty decoded string despite a nonempty file.
        // Small error pages can be read whole without text decoding or range parameters.
        const raw = await call('readFile', info.size <= 4096 ? {filePath} : {filePath,position:0,length:4096});
        const isBuffer = Object.prototype.toString.call(raw.data) === '[object ArrayBuffer]';
        if (!isBuffer) {
          log.record('download.html.binaryType', {type:typeof raw.data,fileBytes:info.size});
        } else {
          const bytes = new Uint8Array(raw.data);
          const limit = Math.min(bytes.length,4096);
          if (!limit) log.record('download.html.bytes', {fileBytes:info.size,actualReadBytes:0,hex:''});
          for (let offset=0;offset<limit;offset+=400) {
            const hex = Array.from(bytes.subarray(offset,Math.min(offset+400,limit)), b=>b.toString(16).padStart(2,'0')).join('');
            log.record('download.html.bytes', {fileBytes:info.size,actualReadBytes:bytes.length,offset,hex,truncated:info.size>limit});
          }
        }
      }
      const visible = String(result.data).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
        .replace(/<!--[\s\S]*?-->/g,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
      summary.responseSummary = visible.slice(0,400);
      summary.summaryTruncated = info.size>length || visible.length>400;
      log.record('download.html', {contentType,decodedAs:'utf8',text:visible.slice(0,800),truncated:info.size>length || visible.length>800});
      if (!visible) {
        // Inspect script-only error pages as inert text; never evaluate or render their HTML.
        const source = String(result.data)
          .replace(/<input\b[^>]*>/gi,'[input omitted]')
          .replace(/(token|cookie|authorization|password|secret)\s*[:=]\s*["']?[^\s"'<>;]+/gi,'$1=[redacted]')
          .replace(/\s+/g,' ').slice(0,800);
        summary.responseSummary = source.slice(0,400) || null;
        summary.summaryTruncated = info.size>length || String(result.data).length>400;
        if (!source) summary.summaryReadError = 'Response body could not be decoded';
        log.record('download.html.source', {source,decodedAs:'utf8',truncated:info.size>length || String(result.data).length>800});
      }
    } catch (error) { summary.summaryReadError = String(error.message || error).slice(0,250); log.record('download.html.readError', {filePath,error}); }
    return summary;
  }
  return {
    readIndex() { try { const entries = JSON.parse(fs.readFileSync(root + '/index.json', 'utf8')); return Array.isArray(entries) ? entries.filter(e => e && isOwned(e.path) && e.path === root + '/' + e.key) : []; } catch (_) { return []; } },
    writeIndex(entries) {
      fs.writeFileSync(root + '/index.tmp', JSON.stringify(entries), 'utf8');
      fs.renameSync(root + '/index.tmp', root + '/index.json');
    },
    list() { return fs.readdirSync(root).filter(name => /^[a-f0-9]{40}\.(mp3|wav|jpg|png)$/.test(name)).map(name => root + '/' + name); },
    info(filePath) {
      if (!isOwned(filePath) && !temporaryFiles.has(filePath)) return Promise.reject(Error('无效的缓存文件路径'));
      return call('getFileInfo', { filePath, digestAlgorithm: 'sha1' });
    },
    async save(tempFilePath, name) {
      if (!temporaryFiles.has(tempFilePath) || !isOwned(root + '/' + name)) throw Error('无效的缓存文件路径');
      const result = await call('saveFile', { tempFilePath, filePath: root + '/' + name });
      temporaryFiles.delete(tempFilePath);
      return result.savedFilePath;
    },
    async remove(filePath) {
      if (!isOwned(filePath) && !temporaryFiles.has(filePath)) throw Error('无效的缓存文件路径');
      try { await call('unlink', { filePath }); } catch (error) {
        try { fs.accessSync(filePath); } catch (_) { return; }
        throw error;
      } finally { temporaryFiles.delete(filePath); }
    },
    download: (url, diagnostic = {}) => new Promise((resolve, reject) => {
      log.record('download.start', {url});
      api.downloadFile({ url, timeout: 15000, success: async result => {
        const headers = result.header || {};
        const header = name => headers[Object.keys(headers).find(key => key.toLowerCase() === name)];
        const field = name => header(name) == null ? null : String(header(name)).slice(0,800);
        Object.assign(diagnostic, {statusCode:result.statusCode,contentType:field('content-type'),contentLength:field('content-length'),location:field('location')});
        log.record('download.response', {url,statusCode:result.statusCode,tempFilePath:result.tempFilePath,contentType:header('content-type'),contentLength:header('content-length'),location:header('location')});
        const isHtml = /text\/html|application\/xhtml/i.test(String(header('content-type') || ''));
        if (result.tempFilePath && (isHtml || /\.html?$/i.test(result.tempFilePath))) {
          Object.assign(diagnostic, await describeHtml(result.tempFilePath, header('content-type')));
        }
        if (isHtml) {
          if (result.tempFilePath) { try { fs.unlink({filePath:result.tempFilePath,fail() {}}); } catch (_) {} }
          const error = Error('资源服务返回了网页而非音频，请检查公开下载地址');
          error.code = 'RESOURCE_HTML_RESPONSE';
          log.record('download.invalidContent', {url,contentType:header('content-type'),error});
          reject(error); return;
        }
        if (result.statusCode === 200 && result.tempFilePath) { temporaryFiles.add(result.tempFilePath); resolve(result.tempFilePath); }
        else {
          if (result.tempFilePath) fs.unlink({ filePath: result.tempFilePath, fail() {} });
          reject(Error('资源下载失败（HTTP ' + result.statusCode + '）'));
        }
      }, fail: error => {
        diagnostic.nativeErrorCode = error.errno == null ? (error.errCode == null ? null : error.errCode) : error.errno;
        log.record('download.error', {url,error});
        const failure = Error(error.errMsg || '资源下载失败，请检查网络和下载域名配置');
        if (/url not in domain list/i.test(failure.message)) failure.code = 'RESOURCE_DOMAIN_BLOCKED';
        reject(failure);
      } });
    })
  };
}
module.exports = { createWxResourceAdapter };
