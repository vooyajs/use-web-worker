<div align="center">
  <img src="assets/uww_128.svg" alt="useWebWorker Logo" width="64" height="64" />
  <h1>use-web-worker</h1>
  <p>
    <a href="README_CN.md">中文</a> | <strong>English</strong>
  </p>
  <p>React hooks for running CPU-heavy functions in Web Workers with TypeScript support, status tracking, timeout handling, and cleanup.</p>

[![NPM version](https://img.shields.io/npm/v/@atom-universe/use-web-worker.svg?style=flat)](https://npmjs.com/package/@atom-universe/use-web-worker)
[![NPM downloads](http://img.shields.io/npm/dm/@atom-universe/use-web-worker.svg?style=flat)](https://npmjs.com/package/@atom-universe/use-web-worker)

  <p>
    <strong><a href="https://use-web-worker-docs.vercel.app/">Documentation</a></strong>
  </p>
</div>

## Quick Start

- **Function-like API** - call a worker task like an async function.
- **Responsive UI** - move CPU-heavy work away from the main thread.
- **TypeScript first** - infer call arguments and return values from your worker function.
- **Lifecycle helpers** - status, timeout, error handling, and automatic cleanup.

```bash
npm install @atom-universe/use-web-worker
```

## Basic Usage

```tsx
import { useWebWorkerFn } from '@atom-universe/use-web-worker';

function App() {
  const [workerFn, status] = useWebWorkerFn((a: number, b: number) => a + b);

  const handleClick = async () => {
    const result = await workerFn(1, 2);
    console.log(result); // 3
  };

  return (
    <div>
      <button onClick={handleClick}>Calculate</button>
      <div>Current status: {status}</div>
    </div>
  );
}
```

## API Reference

### useWebWorkerFn

Creates a generated Web Worker from a function and returns an executor.

```tsx
const [workerFn, workerStatus, workerTerminate] = useWebWorkerFn(
  fn: T,
  options?: UseWebWorkerFnOptions
);
```

#### Options

```tsx
interface UseWebWorkerFnOptions {
  timeout?: number;
  dependencies?: string[]; // external scripts loaded with importScripts()
  localDependencies?: ((...args: unknown[]) => unknown)[]; // helper functions stringified into the worker
  onError?: (error: Error) => void;
  onMessage?: (message: any) => void; // custom messages posted by the worker
}
```

#### Returns

- `workerFn: (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>` - execute the worker function.
- `workerStatus: WebWorkerStatus` - current status enum value.
- `workerTerminate: (status?: WebWorkerStatus) => void` - terminate the active worker and set a status.

`WorkerStatusType` values are exported as `SUCCESS = 0`, `ERROR = 1`, `TIMEOUT = 2`, `RUNNING = 3`, and `PENDING = 4`.

### Progress and custom messages

The worker global scope is injected as the last argument. You do not pass it when calling `workerFn`.

```tsx
import { useWebWorkerFn } from '@atom-universe/use-web-worker';

function compute(total: number, workerContext: Worker) {
  workerContext.postMessage(['PROGRESS', { percent: 50 }]);
  return total * 2;
}

function App() {
  const [workerFn] = useWebWorkerFn(compute, {
    onMessage: message => {
      if (message.type === 'PROGRESS') {
        console.log(message.data.percent);
      }
    },
  });

  workerFn(21);
}
```

### Task lifecycle

Only one task can run per hook instance. Overlapping calls reject without interrupting the active task. Async worker functions resolve to their awaited result.

`workerTerminate()` and component unmount reject an active task with an error named `AbortError`. Handle the returned Promise, including cancellation. Timeout, worker startup, message serialization, and worker execution failures reject the task and invoke `onError`. A settled task releases its worker, timer, and Blob URL; later calls can start a new task.

The function and local helpers are serialized into a separate worker scope. They cannot capture component variables, module imports, or the DOM. Pass data as arguments. `dependencies` loads classic scripts with `importScripts()`; it does not provide an ESM/WASM module loader. A restrictive Content Security Policy may disallow Blob workers.

### useWebWorker

`useWebWorker` is the older direct-worker hook. Prefer `useWebWorkerFn` for new function-style usage.

```tsx
const [data, post, terminate, worker, isRunning] = useWebWorker<Data>(
  urlOrFactoryOrWorker,
  workerOptions
);
```

The first argument can be a worker script URL, a `() => Worker` factory, or a `Worker` instance.

## Benchmark

This repo includes a reproducible benchmark that compares a CPU workload on the main thread and in a worker thread:

```bash
pnpm benchmark
```

The script writes `BENCHMARK.md` and updates the docs data file used by the website.

## Contributing

Contributions are welcome. Please feel free to submit a Pull Request.

## License

MIT License
