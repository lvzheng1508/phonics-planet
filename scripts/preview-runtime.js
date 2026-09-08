/* Browser-only development adapter. Never included in miniprogram/. */
(() => {
  const bundle = window.PHONICS_PREVIEW;
  const cache = {};
  let definition, current, currentPath, scheduled = false;
  const components = new Map();
  let componentDefinition;
  const renderTemplate = new Function('global', bundle.compiler)({});
  const mount = document.getElementById('app');
  function normalize(file) { const parts = []; for (const p of file.split('/')) { if (p === '..') parts.pop(); else if (p !== '.' && p) parts.push(p); } return parts.join('/'); }
  function requireModule(file) {
    file = normalize(file); if (!file.endsWith('.js')) file += '.js';
    if (cache[file]) return cache[file].exports;
    const module = { exports: {} }; cache[file] = module;
    const localRequire = name => requireModule(file.slice(0, file.lastIndexOf('/') + 1) + name);
    new Function('require', 'module', 'exports', bundle.sources[file])(localRequire, module, module.exports); return module.exports;
  }
  window.Page = value => { definition = value; };
  window.Component = value => { componentDefinition = value; };
  function toast(title) { const t = document.createElement('div'); t.className = 'preview-toast'; t.textContent = title; document.body.append(t); setTimeout(() => t.remove(), 2200); }
  window.wx = {
    getStorageSync(key) { try { return JSON.parse(localStorage.getItem('preview:' + key)); } catch (_) { return null; } },
    setStorageSync(key, value) { localStorage.setItem('preview:' + key, JSON.stringify(value)); },
    navigateTo({ url }) { location.hash = url; },
    showToast({ title }) { toast(title); }, setNavigationBarTitle() {},
    setClipboardData({ data }) { navigator.clipboard.writeText(data).then(() => toast('来源链接已复制')); },
    createInnerAudioContext() {
      const audio = new Audio(); let timer;
      return { set src(value) { audio.src = value; }, get currentTime() { return audio.currentTime; }, get duration() { return audio.duration; },
        play() { audio.play().catch(() => audio.dispatchEvent(new Event('error'))); },
        stop() { clearInterval(timer); audio.pause(); }, destroy() { clearInterval(timer); audio.pause(); audio.removeAttribute('src'); },
        onTimeUpdate(fn) { audio.addEventListener('timeupdate', fn); audio.addEventListener('playing', () => { clearInterval(timer); timer = setInterval(fn, 60); }); },
        onEnded(fn) { audio.addEventListener('ended', fn); }, onError(fn) { audio.addEventListener('error', fn); }, onPlay(fn) { audio.addEventListener('playing', fn); } };
    }
  };
  requireModule('components/audio-button/index.js');
  function update() { if (!scheduled) { scheduled = true; queueMicrotask(() => { scheduled = false; if (current) render(); }); } }
  function instance(def, initial = {}) {
    const obj = { ...def, ...def.methods, data: { ...structuredClone(def.data || {}), ...initial }, setData(values) { Object.assign(this.data, values); update(); } }; return obj;
  }
  function css(text) {
    const width = document.getElementById('shell').clientWidth;
    const tags = { page: '#app', view: 'div', navigator: 'a', text: 'span' };
    return text.replace(/(-?[\d.]+)rpx/g, (_, n) => Number(n) * width / 750 + 'px')
      .replace(/(^|[\s,>+~])(page|view|navigator|text)(?=[\s,.#:>{])/g, (_, prefix, tag) => prefix + tags[tag]);
  }
  function renderNode(node, host, key) {
    if (typeof node === 'string' || typeof node === 'number') return document.createTextNode(String(node));
    if (!node || !node.tag) return document.createTextNode('');
    const type = node.tag.replace(/^wx-/, ''), attr = node.attr || {};
    if (type === 'audio-button') {
      let c = components.get(key);
      if (!c) {
        const props = Object.fromEntries(Object.entries(componentDefinition.properties).map(([k, v]) => [k, v.value]));
        c = instance(componentDefinition, { ...props, ...attr });
        c.triggerEvent = name => { const handler = attr['bind' + name] || attr['bind:' + name]; if (handler && host[handler]) host[handler](); };
        components.set(key, c); componentDefinition.lifetimes.attached.call(c);
      }
      if (JSON.stringify(c.data.ids) !== JSON.stringify(attr.ids)) { Object.assign(c.data, attr); c.check(); }
      const container = document.createElement('div'); container.className = 'audio-host'; container.append(renderNode(renderTemplate('components/audio-button/index.wxml')(c.data), c, key + ':component')); return container;
    }
    const tags = { page: 'div', view: 'div', text: 'span', navigator: 'a', image: 'img', button: 'button', input: 'input', block: 'div' };
    const element = document.createElement(tags[type] || 'div');
    const dataset = {};
    for (const [k, v] of Object.entries(attr)) {
      if (k === 'class') element.className = v || '';
      else if (k === 'style') element.style.cssText = v || '';
      else if (k === 'aria-hidden' || k === 'ariaHidden') element.setAttribute('aria-hidden', v);
      else if (k === 'src') element.src = v;
      else if (k === 'url') element.href = '#' + v;
      else if (k === 'value') element.value = v || '';
      else if (k === 'disabled') element.disabled = !!v;
      else if (k === 'placeholder' || k === 'maxlength') element.setAttribute(k, v);
      else if (k === 'ariaLabel') element.setAttribute('aria-label', v);
      else if (k.startsWith('data-')) dataset[k.slice(5)] = v;
    }
    for (const [bind, event] of [['bindtap', 'click'], ['bindinput', 'input']]) if (attr[bind]) {
      element.addEventListener(event, e => { e.preventDefault(); host[attr[bind]]({ currentTarget: { dataset }, detail: { value: e.target.value } }); });
    }
    if (type === 'input') element.dataset.previewInput = key;
    for (const [i, child] of (node.children || []).entries()) element.append(renderNode(child, host, key + ':' + i));
    return element;
  }
  function render() {
    const focused = document.activeElement; const inputKey = focused && focused.dataset.previewInput; const caret = inputKey ? focused.selectionStart : 0;
    mount.replaceChildren(renderNode(renderTemplate(currentPath + '.wxml')(current.data), current, 'root'));
    if (inputKey) { const el = Array.from(mount.querySelectorAll('input')).find(x => x.dataset.previewInput === inputKey); if (el) { el.focus(); el.setSelectionRange(caret, caret); } }
  }
  function navigate() {
    if (current && current.onUnload) current.onUnload();
    for (const c of components.values()) componentDefinition.lifetimes.detached.call(c); components.clear();
    const url = new URL(location.hash.slice(1) || '/pages/home/index', location.origin);
    currentPath = url.pathname.replace(/^\//, '');
    if (!bundle.sources[currentPath + '.js']) currentPath = 'pages/home/index';
    delete cache[currentPath + '.js']; requireModule(currentPath + '.js'); current = instance(definition);
    if (current.onLoad) current.onLoad(Object.fromEntries(url.searchParams)); if (current.onShow) current.onShow();
    document.getElementById('app-style').textContent = css(bundle.styles['app.wxss'] + '\n' + (bundle.styles[currentPath + '.wxss'] || '')) + '\n' + css(bundle.styles['components/audio-button/index.wxss']).replace(/button/g, '.audio-host button').replace(/\.hint/g, '.audio-host .hint');
    render(); window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', navigate);
  document.getElementById('back').onclick = () => history.back();
  document.getElementById('home').onclick = () => { location.hash = '/pages/home/index'; };
  navigate();
})();
