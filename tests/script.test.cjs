const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require('node:path').join(__dirname, '../script.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const elements = {};
  const requests = [];
  const images = [];
  const context = vm.createContext({
    URL,
    document: { querySelector(selector) {
      return elements[selector] ||= { value: selector === '#channel' ? '100' : '1', listeners: {},
        addEventListener(event, callback) { this.listeners[event] = callback; } };
    } },
    fetch(url) { return new Promise((resolve, reject) => requests.push({ url, resolve, reject })); },
    Image: class { constructor() { images.push(this); } },
  });
  vm.runInContext(source, context);
  return { elements, requests, images, setScreen: context.setScreen };
}
function respond(request, path = '/tlvd/images/nazionale/16_9_page-100.2.png') {
  request.resolve({ ok: true, json: async () => ({ status: 'OK', subPage: { imagePath: path, title: 'Televideo' } }) });
}
test('initial page uses API-provided image path and waits for image decoding', async () => {
  const app = setup();
  assert.equal(app.requests[0].url, 'https://www.rainews.it/atomatic/televideo-service/api/televideo/nazionale/100/0');
  respond(app.requests[0]); await flush();
  assert.equal(app.images[0].src, 'https://www.rainews.it/tlvd/images/nazionale/16_9_page-100.2.png');
  assert.equal(app.elements['#screen-img'].hidden, true);
  app.images[0].onload();
  assert.equal(app.elements['#screen-img'].hidden, false);
  assert.equal(app.elements['#screen-status'].textContent, '');
});
test('invalid input does not request images', () => {
  const app = setup();
  for (const [channel, page] of [[100, ''], [100, 0], [99, 1], [900, 1], ['100x', 1], [100, 1.5]]) app.setScreen(channel, page);
  assert.equal(app.requests.length, 1);
});
test('late API responses cannot overwrite newer selection', async () => {
  const app = setup(); app.setScreen(101, 2);
  respond(app.requests[1], '/new.png'); await flush();
  respond(app.requests[0], '/old.png'); await flush();
  assert.equal(app.images.length, 1);
  app.images[0].onload();
  assert.equal(app.elements['#screen-img'].src, 'https://www.rainews.it/new.png');
});
test('late image load or failure cannot overwrite newer selection', async () => {
  const app = setup(); respond(app.requests[0]); await flush();
  app.setScreen(101, 1); respond(app.requests[1], '/new.png'); await flush();
  app.images[1].onload(); app.images[0].onload(); app.images[0].onerror();
  assert.equal(app.elements['#screen-img'].src, 'https://www.rainews.it/new.png');
  assert.equal(app.elements['#screen-status'].textContent, '');
});
test('HTTP, API, network and image failures show a recoverable error', async () => {
  for (const failure of ['http', 'api', 'network', 'image']) {
    const app = setup();
    if (failure === 'http') app.requests[0].resolve({ ok: false });
    if (failure === 'api') app.requests[0].resolve({ ok: true, json: async () => ({ status: 'KO' }) });
    if (failure === 'network') app.requests[0].reject(new Error('offline'));
    if (failure === 'image') respond(app.requests[0]);
    await flush();
    if (failure === 'image') app.images[0].onerror();
    assert.match(app.elements['#screen-status'].textContent, /Pagina non disponibile/);
    app.elements['#go'].listeners.click(); respond(app.requests[1]); await flush(); app.images.at(-1).onload();
    assert.equal(app.elements['#screen-img'].hidden, false);
  }
});
test('navigation selects subpages and Go retries the current selection', () => {
  const app = setup(); app.elements['#nextPage'].listeners.click(); app.elements['#go'].listeners.click();
  assert.match(app.requests[1].url, /\/100\/1$/);
  assert.match(app.requests[2].url, /\/100\/1$/);
  app.elements['#nextChannel'].listeners.click();
  assert.match(app.requests[3].url, /\/101\/0$/);
});
