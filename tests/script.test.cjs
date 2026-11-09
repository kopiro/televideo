const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = readFileSync(path.join(__dirname, '../script.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const elements = {};
  const requests = [];
  const images = [];
  const timers = new Map();
  let timerId = 0;
  function element(selector) {
    return elements[selector] ||= {
      value: selector === '#channel' ? '100' : '1', listeners: {}, attributes: {},
      addEventListener(event, callback) { this.listeners[event] = callback; },
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this.attributes[name]; },
      select() { this.selected = true; }, focus() { this.focused = true; },
    };
  }
  const shortcuts = [100, 101, 200].map(channel => Object.assign(element(`shortcut-${channel}`), { dataset: { channel: String(channel) } }));
  const context = vm.createContext({
    URL, AbortController,
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    document: { querySelector: element, querySelectorAll: () => shortcuts },
    fetch(url, options) { return new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })); },
    Image: class { constructor() { images.push(this); } },
  });
  vm.runInContext(source, context);
  return { elements, requests, images, timers, shortcuts, setScreen: context.setScreen,
    submit() { elements['#page-form'].listeners.submit({ preventDefault() {} }); },
    click(selector) { elements[selector].listeners.click(); } };
}
function respond(request, imagePath = '/tlvd/images/nazionale/16_9_page-100.png') {
  request.resolve({ ok: true, json: async () => ({ status: 'OK', subPage: { imagePath, title: 'Televideo', body: 'Notizie della pagina' } }) });
}
async function load(app, index = app.requests.length - 1) {
  respond(app.requests[index]); await flush(); app.images.at(-1).onload();
}
test('initial page maps to zero-based API and waits for the actual image', async () => {
  const app = setup();
  assert.equal(app.requests[0].url, 'https://www.rainews.it/atomatic/televideo-service/api/televideo/nazionale/100/0');
  respond(app.requests[0]); await flush();
  assert.match(app.images[0].src, /^https:\/\/www.rainews.it\/tlvd\/images\/nazionale\/16_9_page-100.png\?_tv=\d+$/);
  assert.equal(app.elements['#screen-img'].hidden, true);
  app.images[0].onload();
  assert.equal(app.elements['#screen-img'].hidden, false);
  assert.equal(app.elements['#screen-img'].alt, 'Notizie della pagina');
  assert.equal(app.elements['#screen-feedback'].hidden, true);
  assert.equal(app.elements['#screen'].attributes['aria-busy'], 'false');
  assert.equal(app.timers.size, 0);
});
test('invalid numeric values never request images', () => {
  const app = setup();
  for (const [channel, page] of [[100, ''], [100, 0], [99, 1], [900, 1], ['100x', 1], [100, 1.5], ['1e2', 1], [100, 100]]) app.setScreen(channel, page);
  assert.equal(app.requests.length, 1);
});
test('late API responses and rejected requests cannot overwrite a newer selection', async () => {
  const app = setup(); app.setScreen(101, 2);
  assert.equal(app.requests[0].options.signal.aborted, true);
  respond(app.requests[1], '/new.png'); await flush();
  respond(app.requests[0], '/old.png'); await flush();
  assert.equal(app.images.length, 1);
  app.images[0].onload();
  assert.match(app.elements['#screen-img'].src, /\/new.png\?/);
  app.setScreen(102, 1); app.setScreen(103, 1);
  app.requests[2].reject(new Error('aborted')); await flush();
  assert.match(app.elements['#screen-status'].textContent, /103/);
});
test('late image load or failure cannot overwrite the latest loaded image', async () => {
  const app = setup(); respond(app.requests[0]); await flush();
  app.setScreen(101, 1); respond(app.requests[1], '/new.png'); await flush();
  app.images[1].onload(); app.images[0].onload(); app.images[0].onerror();
  assert.match(app.elements['#screen-img'].src, /\/new.png\?/);
  assert.equal(app.elements['#screen-feedback'].hidden, true);
});
test('HTTP, API, malformed JSON, network, image and insecure URL failures are retryable', async () => {
  for (const failure of ['http', 'api', 'json', 'network', 'image', 'url']) {
    const app = setup();
    if (failure === 'http') app.requests[0].resolve({ ok: false });
    if (failure === 'api') app.requests[0].resolve({ ok: true, json: async () => ({ status: 'KO' }) });
    if (failure === 'json') app.requests[0].resolve({ ok: true, json: async () => { throw new Error('invalid JSON'); } });
    if (failure === 'network') app.requests[0].reject(new Error('offline'));
    if (failure === 'image') respond(app.requests[0]);
    if (failure === 'url') respond(app.requests[0], 'http://example.com/insecure.png');
    await flush();
    if (failure === 'image') app.images[0].onerror();
    assert.match(app.elements['#screen-status'].textContent, /non disponibile/);
    assert.equal(app.elements['#retry'].hidden, false);
    assert.equal(app.timers.size, 0);
    app.click('#retry'); await load(app);
    assert.equal(app.elements['#screen-img'].hidden, false);
  }
});
test('fetch and image timeouts abort work and ignore late completion', async () => {
  for (const stage of ['fetch', 'image']) {
    const app = setup();
    if (stage === 'image') { respond(app.requests[0]); await flush(); }
    [...app.timers.values()][0]();
    assert.equal(app.requests[0].options.signal.aborted, true);
    assert.equal(app.elements['#retry'].hidden, false);
    assert.match(app.elements['#screen-status'].textContent, /troppo tempo/);
    if (stage === 'image') app.images[0].onload();
    else { respond(app.requests[0]); await flush(); assert.equal(app.images.length, 0); }
    assert.equal(app.elements['#screen-img'].hidden, true);
    app.click('#retry'); await load(app);
    assert.equal(app.elements['#screen-img'].hidden, false);
  }
});
test('form submission uses both fields once without focus/blur side effects', () => {
  const app = setup();
  app.elements['#channel'].listeners.focus();
  assert.equal(app.elements['#channel'].value, '100');
  assert.equal(app.elements['#channel'].listeners.blur, undefined);
  app.elements['#channel'].value = '200'; app.elements['#page'].value = '3';
  app.submit();
  assert.equal(app.requests.length, 2);
  assert.match(app.requests[1].url, /\/200\/2$/);
});
test('invalid form retains input and image and focuses the field with a clear error', async () => {
  const app = setup(); await load(app);
  app.elements['#channel'].value = 'abc'; app.submit();
  assert.equal(app.requests.length, 1);
  assert.equal(app.elements['#screen-img'].hidden, false);
  assert.equal(app.elements['#channel'].value, 'abc');
  assert.equal(app.elements['#channel'].focused, true);
  assert.equal(app.elements['#channel'].attributes['aria-invalid'], 'true');
  assert.match(app.elements['#form-error'].textContent, /100 a 899/);
  app.elements['#channel'].value = '100'; app.elements['#page'].value = '0'; app.submit();
  assert.match(app.elements['#form-error'].textContent, /1 a 99/);
  assert.equal(app.elements['#page'].focused, true);
});
test('navigation clamps both boundaries, resets subpage only on page navigation, and ignores invalid drafts', () => {
  const app = setup(); app.click('#prevChannel'); app.click('#prevPage');
  assert.equal(app.requests.length, 1);
  assert.equal(app.elements['#prevChannel'].disabled, true);
  app.click('#nextPage'); assert.match(app.requests.at(-1).url, /\/100\/1$/);
  app.elements['#channel'].value = ''; app.click('#nextChannel');
  assert.match(app.requests.at(-1).url, /\/101\/0$/);
  app.setScreen(899, 99);
  assert.equal(app.elements['#nextChannel'].disabled, true);
  assert.equal(app.elements['#nextPage'].disabled, true);
  const count = app.requests.length; app.click('#nextChannel'); app.click('#nextPage');
  assert.equal(app.requests.length, count);
});
test('refresh retries the selected subpage with fresh metadata and a new image URL', async () => {
  const app = setup(); app.setScreen(100, 2); await load(app);
  app.elements['#channel'].value = '500'; app.click('#refresh');
  assert.match(app.requests.at(-1).url, /\/100\/1$/);
  assert.equal(app.requests.at(-1).options.cache, 'no-store');
  respond(app.requests.at(-1)); await flush();
  assert.ok(new URL(app.images.at(-1).src).searchParams.has('_tv'));
});
test('shortcuts reset subpage and expose the active page', () => {
  const app = setup(); app.setScreen(101, 3); app.shortcuts[2].listeners.click();
  assert.match(app.requests.at(-1).url, /\/200\/0$/);
  assert.equal(app.shortcuts[2].attributes['aria-current'], 'page');
  assert.equal(app.shortcuts[0].attributes['aria-current'], undefined);
});
test('install manifest stays within the GitHub Pages project', () => {
  const manifest = JSON.parse(readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
  const base = 'https://kopiro.github.io/televideo/manifest.json';
  for (const url of [manifest.start_url, manifest.scope, manifest.icons[0].src]) {
    assert.ok(new URL(url, base).href.startsWith('https://kopiro.github.io/televideo/'));
  }
  const html = readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(html, /rel="manifest" href="manifest.json"/);
});
