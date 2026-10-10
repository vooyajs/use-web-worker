// This bridge is specific to the lab. It is not a public useWebWorkerFn API.
let ready;
let bindings;
let handle;
const stage = (name, ms) => self.postMessage({ type: 'stage', name, ms });

async function prepare() {
  if (ready) return ready;
  ready = (async () => {
    stage('download');
    let start = performance.now();
    const response = await fetch(new URL('./field.wasm', import.meta.url));
    if (!response.ok) throw new Error(`WASM download failed (${response.status})`);
    const bytes = await response.arrayBuffer();
    stage('download', performance.now() - start);
    stage('compile');
    start = performance.now();
    // Deliberately separate these phases for measurement. Streaming compilation
    // normally overlaps network and compilation instead.
    const module = await WebAssembly.compile(bytes);
    stage('compile', performance.now() - start);
    stage('initialize');
    start = performance.now();
    bindings = await import('./field.mjs');
    await bindings.default({ module_or_path: module });
    if (bindings.voo_abi_version() !== 1) throw new Error('Unsupported Vooya ABI');
    handle = bindings.voo_field_store_create();
    stage('initialize', performance.now() - start);
    return bytes.byteLength;
  })().catch(error => {
    ready = undefined;
    throw error;
  });
  return ready;
}

self.onmessage = async ({ data }) => {
  try {
    const size = await prepare();
    if (data.type === 'prepare') {
      self.postMessage({ type: 'ready', size });
      return;
    }
    stage('compute');
    const start = performance.now();
    bindings.voo_field_store_render(handle, data.seed);
    const snapshot = bindings.voo_field_store_snapshot(handle);
    const pixels = new Uint8ClampedArray(snapshot.pixels);
    stage('compute', performance.now() - start);
    self.postMessage({ type: 'result', size, checksum: snapshot.checksum, pixels }, [
      pixels.buffer,
    ]);
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
