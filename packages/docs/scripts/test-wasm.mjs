import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';

const workerUrl = new URL('../public/vooya/field-worker.mjs', import.meta.url).href;
function createLab(failFirst = false) {
  const worker = new Worker(
    `
    const { parentPort } = require('node:worker_threads');
    const { readFile } = require('node:fs/promises');
    let requests = 0;
    globalThis.fetch = async url => {
      requests += 1;
      parentPort.postMessage({ type: 'fetch', requests });
      if (${failFirst} && requests === 1) return new Response(null, { status: 503 });
      return new Response(await readFile(url));
    };
    globalThis.self = { postMessage: (data, transfer) => parentPort.postMessage(data, transfer) };
    import(${JSON.stringify(workerUrl)}).then(() => parentPort.on('message', data => self.onmessage({ data })));
  `,
    { eval: true }
  );
  let fetches = 0;
  worker.on('message', message => {
    if (message.type === 'fetch') fetches = message.requests;
  });
  function send(type, seed = 0) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Worker timed out'));
      }, 10_000);
      const stages = [];
      const cleanup = () => {
        clearTimeout(timer);
        worker.off('message', onMessage);
        worker.off('error', onError);
      };
      const onError = error => {
        cleanup();
        reject(error);
      };
      const onMessage = message => {
        if (message.type === 'stage' && message.ms !== undefined) stages.push(message);
        if (['ready', 'result', 'error'].includes(message.type)) {
          cleanup();
          resolve({ ...message, stages });
        }
      };
      worker.on('message', onMessage);
      worker.on('error', onError);
      worker.postMessage({ type, seed });
    });
  }
  return { worker, send, fetches: () => fetches };
}

const lab = createLab();
try {
  const prepared = await lab.send('prepare');
  assert.equal(prepared.type, 'ready');
  assert.deepEqual(
    prepared.stages.map(s => s.name),
    ['download', 'compile', 'initialize']
  );
  assert.ok(prepared.size > 0);
  const first = await lab.send('render');
  assert.equal(first.type, 'result');
  assert.equal(first.pixels.length, 640 * 420 * 4);
  assert.ok(first.checksum > 0);
  assert.ok(first.pixels.some((v, i) => i % 4 !== 3 && v > 100));
  assert.deepEqual(
    first.stages.map(s => s.name),
    ['compute']
  );
  const repeat = await lab.send('render');
  assert.equal(repeat.checksum, first.checksum);
  assert.deepEqual(repeat.pixels, first.pixels);
  assert.equal(lab.fetches(), 1, 'WASM should be fetched once per worker');
  const changed = await lab.send('render', 4);
  assert.notEqual(changed.checksum, first.checksum);
  console.log(
    'PASS: real Vooya Store, image output, deterministic results, input changes, module reuse'
  );
} finally {
  await lab.worker.terminate();
}

const retry = createLab(true);
try {
  assert.equal((await retry.send('prepare')).type, 'error');
  const recovered = await retry.send('render');
  assert.equal(recovered.type, 'result');
  assert.deepEqual(
    recovered.stages.map(s => s.name),
    ['download', 'compile', 'initialize', 'compute']
  );
  assert.equal(retry.fetches(), 2);
  console.log('PASS: failed download can retry; direct first run prepares all stages');
} finally {
  await retry.worker.terminate();
}
