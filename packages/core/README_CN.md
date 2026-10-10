<div align="center">
  <img src="assets/uww_128.svg" alt="useWebWorker Logo" width="64" height="64" />
  <h1>use-web-worker</h1>
  <p>
    <a href="README.md">English</a> | <strong>中文</strong>
  </p>
  <p>用于在 Web Worker 中运行 CPU 密集函数的 React Hooks，支持 TypeScript、状态追踪、超时处理和自动清理。</p>

[![NPM version](https://img.shields.io/npm/v/@atom-universe/use-web-worker.svg?style=flat)](https://npmjs.com/package/@atom-universe/use-web-worker)
[![NPM downloads](http://img.shields.io/npm/dm/@atom-universe/use-web-worker.svg?style=flat)](https://npmjs.com/package/@atom-universe/use-web-worker)

  <p>
    <strong><a href="https://use-web-worker-docs.vercel.app/">文档</a></strong>
  </p>
</div>

## 快速开始

- **函数式 API** - 像调用异步函数一样调用 worker 任务。
- **保持 UI 响应** - 将 CPU 密集任务移出主线程。
- **TypeScript 优先** - 根据 worker 函数推导调用参数和返回值。
- **生命周期辅助** - 提供状态、超时、错误处理和自动清理。

```bash
npm install @atom-universe/use-web-worker
```

## 基本用法

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
      <button onClick={handleClick}>计算</button>
      <div>当前状态: {status}</div>
    </div>
  );
}
```

## API 参考

### useWebWorkerFn

根据函数创建生成式 Web Worker，并返回执行函数。

```tsx
const [workerFn, workerStatus, workerTerminate] = useWebWorkerFn(
  fn: T,
  options?: UseWebWorkerFnOptions
);
```

#### 选项

```tsx
interface UseWebWorkerFnOptions {
  timeout?: number;
  dependencies?: string[]; // 通过 importScripts() 加载的外部脚本
  localDependencies?: ((...args: unknown[]) => unknown)[]; // 被字符串化写入 worker 的辅助函数
  onError?: (error: Error) => void;
  onMessage?: (message: any) => void; // worker 主动发出的自定义消息
}
```

#### 返回值

- `workerFn: (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>` - 执行 worker 函数。
- `workerStatus: WebWorkerStatus` - 当前状态枚举值。
- `workerTerminate: (status?: WebWorkerStatus) => void` - 终止当前 worker 并设置状态。

`WorkerStatusType` 导出值包括 `SUCCESS = 0`、`ERROR = 1`、`TIMEOUT = 2`、`RUNNING = 3` 和 `PENDING = 4`。

### 进度和自定义消息

worker 全局作用域会作为最后一个参数自动注入。调用 `workerFn` 时不需要传入它。

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

### 任务生命周期

每个 hook 实例同一时间只运行一个任务。重叠调用会返回 rejected Promise，不会打断正在运行的任务。异步函数的返回值会自动等待后再交给调用者。

`workerTerminate()` 和组件卸载会使进行中的任务以名称为 `AbortError` 的错误结束。请处理返回的 Promise，包括取消情况。超时、Worker 启动、消息序列化和任务执行失败都会 reject，并调用 `onError`。任务结束后释放 Worker、定时器及 Blob URL；后续调用可以启动新任务。

函数和本地辅助函数会被序列化到独立的 Worker 作用域，不能捕获组件变量、模块导入或 DOM，请通过参数传递数据。`dependencies` 使用 `importScripts()` 加载传统脚本，不是 ESM/WASM 模块加载器。严格的 Content Security Policy 可能禁止 Blob Worker。

### useWebWorker

`useWebWorker` 是较早的直接 worker 控制 hook。新的函数式场景建议优先使用 `useWebWorkerFn`。

```tsx
const [data, post, terminate, worker, isRunning] = useWebWorker<Data>(
  urlOrFactoryOrWorker,
  workerOptions
);
```

第一个参数可以是 worker 脚本 URL、`() => Worker` 工厂函数，或已有的 `Worker` 实例。

## Benchmark

仓库包含一个可复现 benchmark，用于对比 CPU 任务在主线程和 worker 线程中的响应性：

```bash
pnpm benchmark
```

脚本会写入 `BENCHMARK.md`，并更新官网使用的数据文件。

## 贡献

欢迎贡献，请随时提交 Pull Request。

## 许可证

MIT 许可证
