import { useState, useEffect, useRef } from 'react';
import createWorkerBlobUrl, {
  WebWorkerStatus,
  WorkerStatusType,
} from './lib/createWorkerBlobUrl.js';

export interface UseWebWorkerFnOptions {
  timeout?: number;
  /** External scripts loaded inside the generated worker. */
  dependencies?: string[];
  /** Self-contained helper functions serialized into the generated worker. */
  localDependencies?: ((...args: unknown[]) => unknown)[];
  onError?: (error: Error) => void;
  onMessage?: (message: any) => void;
}

type StripWorkerParam<Args extends readonly unknown[]> = Args extends [...infer H, Worker]
  ? H
  : Args;

export type UseWebWorkerFnReturn<T extends (...args: any[]) => any> = [
  (...fnArgs: StripWorkerParam<Parameters<T>>) => Promise<Awaited<ReturnType<T>>>,
  WebWorkerStatus,
  (status?: WebWorkerStatus) => void,
];

interface WorkerTask<Result> {
  worker?: Worker;
  url?: string;
  timer?: ReturnType<typeof setTimeout>;
  resolve: (value: Result) => void;
  reject: (error: Error) => void;
}

function abortError(): Error {
  const error = new Error('Worker task was terminated');
  error.name = 'AbortError';
  return error;
}

function useWebWorkerFn<T extends (...args: any[]) => any>(
  fn: T,
  options: UseWebWorkerFnOptions = {}
): UseWebWorkerFnReturn<T> {
  type Result = Awaited<ReturnType<T>>;
  const [workerStatus, setWorkerStatus] = useState<WebWorkerStatus>(WorkerStatusType.PENDING);
  const taskRef = useRef<WorkerTask<Result> | null>(null);
  const mountedRef = useRef(true);

  const release = (task: WorkerTask<Result>, status: WebWorkerStatus) => {
    if (taskRef.current !== task) return false;
    taskRef.current = null;
    clearTimeout(task.timer);
    if (task.worker) {
      task.worker.onmessage = null;
      task.worker.onerror = null;
      task.worker.onmessageerror = null;
      task.worker.terminate();
    }
    if (task.url) URL.revokeObjectURL(task.url);
    if (mountedRef.current) setWorkerStatus(status);
    return true;
  };

  const workerTerminate = (status: WebWorkerStatus = WorkerStatusType.PENDING) => {
    const task = taskRef.current;
    if (task && release(task, status)) task.reject(abortError());
  };

  const workerFn = (...fnArgs: StripWorkerParam<Parameters<T>>): Promise<Result> => {
    if (!mountedRef.current) return Promise.reject(abortError());
    // React state may not have rendered yet when two calls happen in one event.
    if (taskRef.current) return Promise.reject(new Error('Worker is already running'));

    return new Promise<Result>((resolve, reject) => {
      const task: WorkerTask<Result> = { resolve, reject };
      taskRef.current = task;
      setWorkerStatus(WorkerStatusType.RUNNING);

      const fail = (error: Error, status: WebWorkerStatus = WorkerStatusType.ERROR) => {
        if (!release(task, status)) return;
        task.reject(error);
        // Settle and release first, even if the consumer's callback throws.
        options.onError?.(error);
      };

      try {
        task.url = createWorkerBlobUrl(fn, options.dependencies, options.localDependencies);
        const worker = new Worker(task.url);
        task.worker = worker;
        worker.onmessage = (event: MessageEvent) => {
          if (taskRef.current !== task) return;
          const [status, result] = event.data as [number | string, Result];
          switch (status) {
            case WorkerStatusType.SUCCESS:
              if (release(task, WorkerStatusType.SUCCESS)) task.resolve(result);
              break;
            case WorkerStatusType.TIMEOUT:
              fail(new Error('Timeout'), WorkerStatusType.TIMEOUT);
              break;
            case WorkerStatusType.ERROR:
              fail(new Error(String(result)));
              break;
            default:
              options.onMessage?.({ type: status, data: result });
          }
        };
        worker.onerror = (event: ErrorEvent) => {
          event.preventDefault();
          fail(new Error(event.message));
        };
        worker.onmessageerror = () => fail(new Error('Could not deserialize worker message'));
        if (options.timeout) {
          task.timer = setTimeout(() => {
            fail(new Error('Timeout'), WorkerStatusType.TIMEOUT);
          }, options.timeout);
        }
        worker.postMessage([fnArgs]);
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    });
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      workerTerminate();
    };
  }, []);

  return [workerFn, workerStatus, workerTerminate];
}

export default useWebWorkerFn;
