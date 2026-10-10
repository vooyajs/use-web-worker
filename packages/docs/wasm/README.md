# Vooya compute lab

This site-local experiment compiles `src/Field.rs` with the published
`@vooya/provider-rust@0.2.0-alpha.0`. It uses a pure-compute Vooya Store inside a
native module Worker. No DOM APIs are called by the Store. The worker invokes
the generated Vooya ABI bindings directly; it is **not** a new public API of
`useWebWorkerFn`, nor a general precompiled Next.js adapter.

## Build and verify

The generated `public/vooya/field.mjs` and `field.wasm` are checked in so normal
Next.js builds and preview deployments do not need Rust. Source and artifact
hashes are verified by the site build. After editing Rust or the build script:

```sh
# Rust 1.94.0 used for the checked-in build; wasm32 target required.
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.115 --locked
pnpm --filter docs build:wasm
pnpm --filter docs verify:wasm
pnpm --filter docs test:wasm
pnpm --filter docs build
```

Commit the updated source, manifest, JS binding and WASM together. The Cargo
lockfile pins the provider-generated application's registry dependencies. This
is a reproducible source workflow, not a promise of byte-identical binaries
across arbitrary Rust toolchains.

## Loading policy and measurements

- Initial HTML and hydration do not create a Worker or request WASM.
- **Prepare WASM** creates a Worker, fetches the binary, calls
  `WebAssembly.compile`, loads the JS binding, initializes the module and creates
  a Store. It does not render the fractal.
- **Run Rust field** prepares on demand and runs the Store action. Later runs
  retain the same Worker, module and Store, avoiding repeated initialization.
- Fetch and compilation are separate to make timing observable. In a production
  loader, `compileStreaming`/`instantiateStreaming` can overlap these phases.
- Initialization includes binding download/import and Store creation. Compute
  includes action execution, snapshot conversion and pixel-buffer creation;
  it excludes worker messaging and canvas painting. This is not a Rust/JS
  performance comparison. The JavaScript benchmark below is a separate demo.
- Reset/unmount terminates the Worker, releasing its module, Store and memory.
  Reset clears measurements, but cannot promise cold HTTP/compiler caches.
- Startup errors and a 30-second timeout allow retry. Reset also cancels an
  in-flight calculation. There is no background prefetch or idle computation.

`test:wasm` executes the actual generated WASM and worker bridge under Node's
Worker API (with a local-file fetch adapter), checking image output, deterministic
results, changed inputs, one-time preparation, first-run preparation and retry
after a failed fetch. Browser behavior and layout are also checked manually.
