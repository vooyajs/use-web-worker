import { createElement, StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import useWebWorkerFn from '../src/useWebWorkerFn.js';
import { WorkerStatusType } from '../src/lib/createWorkerBlobUrl.js';

function makeWorker() {
  return {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null as ((event: MessageEvent) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    onmessageerror: null as (() => void) | null,
  };
}

let workers: ReturnType<typeof makeWorker>[];
beforeEach(() => {
  workers = [];
  vi.mocked(Worker)
    .mockReset()
    .mockImplementation(() => {
      const worker = makeWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    });
  vi.mocked(URL.createObjectURL)
    .mockReset()
    .mockImplementation(() => `blob:task-${workers.length}`);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function success(index: number, value: unknown) {
  act(() =>
    workers[index].onmessage?.({ data: [WorkerStatusType.SUCCESS, value] } as MessageEvent)
  );
}

describe('useWebWorkerFn task lifecycle', () => {
  it('rejects same-tick overlap without losing the first task and can run again', async () => {
    const { result } = renderHook(() => useWebWorkerFn((n: number) => n * 2));
    let first!: Promise<number>;
    let second!: Promise<number>;
    act(() => {
      first = result.current[0](2);
      second = result.current[0](3);
    });
    await expect(second).rejects.toThrow('already running');
    expect(workers).toHaveLength(1);
    expect(workers[0].postMessage).toHaveBeenCalledWith([[2]]);
    success(0, 4);
    await expect(first).resolves.toBe(4);
    expect(result.current[1]).toBe(WorkerStatusType.SUCCESS);
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:task-0');
    act(() => {
      second = result.current[0](3);
    });
    success(1, 6);
    await expect(second).resolves.toBe(6);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it('settles termination and ignores a queued message from the cancelled task', async () => {
    const { result } = renderHook(() => useWebWorkerFn((n: number) => n));
    let first!: Promise<number>;
    act(() => {
      first = result.current[0](1);
    });
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    const staleMessage = workers[0].onmessage!;
    act(() => result.current[2]());
    await rejected;
    expect(result.current[1]).toBe(WorkerStatusType.PENDING);
    let next!: Promise<number>;
    act(() => {
      next = result.current[0](2);
    });
    act(() => staleMessage({ data: [WorkerStatusType.SUCCESS, 99] } as MessageEvent));
    expect(result.current[1]).toBe(WorkerStatusType.RUNNING);
    expect(workers[1].terminate).not.toHaveBeenCalled();
    success(1, 2);
    await expect(next).resolves.toBe(2);
  });

  it('rejects pending and retained calls after unmount, with no new worker', async () => {
    const { result, unmount } = renderHook(() => useWebWorkerFn(() => 1));
    const execute = result.current[0];
    let pending!: Promise<number>;
    act(() => {
      pending = execute();
    });
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    unmount();
    await rejected;
    await expect(execute()).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers).toHaveLength(1);
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it('still executes after the StrictMode effect cleanup/setup cycle', async () => {
    const { result } = renderHook(() => useWebWorkerFn(() => 1), {
      wrapper: ({ children }) => createElement(StrictMode, null, children),
    });
    let pending!: Promise<number>;
    act(() => {
      pending = result.current[0]();
    });
    success(0, 1);
    await expect(pending).resolves.toBe(1);
  });

  it('times out, reports the error once and clears resources', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const { result } = renderHook(() => useWebWorkerFn(() => 1, { timeout: 20, onError }));
    let pending!: Promise<number>;
    act(() => {
      pending = result.current[0]();
    });
    const rejected = expect(pending).rejects.toThrow('Timeout');
    act(() => vi.advanceTimersByTime(20));
    await rejected;
    expect(result.current[1]).toBe(WorkerStatusType.TIMEOUT);
    expect(onError).toHaveBeenCalledOnce();
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the timer when successful', async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const { result } = renderHook(() => useWebWorkerFn(() => 1, { timeout: 20, onError }));
    let pending!: Promise<number>;
    act(() => {
      pending = result.current[0]();
    });
    success(0, 1);
    await pending;
    act(() => vi.advanceTimersByTime(30));
    expect(onError).not.toHaveBeenCalled();
    expect(result.current[1]).toBe(WorkerStatusType.SUCCESS);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('revokes the URL and rejects constructor failures as a Promise', async () => {
    vi.mocked(Worker).mockImplementationOnce(() => {
      throw new Error('CSP blocked worker');
    });
    const onError = vi.fn();
    const { result } = renderHook(() => useWebWorkerFn(() => 1, { onError }));
    let pending!: Promise<number>;
    act(() => {
      pending = result.current[0]();
    });
    await expect(pending).rejects.toThrow('CSP blocked worker');
    expect(result.current[1]).toBe(WorkerStatusType.ERROR);
    expect(onError).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:task-0');
  });

  it('cleans up a postMessage serialization failure and permits retry', async () => {
    vi.mocked(Worker).mockImplementationOnce(() => {
      const worker = makeWorker();
      worker.postMessage.mockImplementationOnce(() => {
        throw new Error('DataCloneError');
      });
      workers.push(worker);
      return worker as unknown as Worker;
    });
    const { result } = renderHook(() => useWebWorkerFn(() => 1, { timeout: 1000 }));
    let pending!: Promise<number>;
    act(() => {
      pending = result.current[0]();
    });
    await expect(pending).rejects.toThrow('DataCloneError');
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    expect(result.current[1]).toBe(WorkerStatusType.ERROR);
    act(() => {
      pending = result.current[0]();
    });
    success(1, 1);
    await expect(pending).resolves.toBe(1);
  });

  it.each(['task', 'worker', 'message'] as const)('settles %s errors', async kind => {
    const onError = vi.fn();
    const { result } = renderHook(() => useWebWorkerFn(() => 1, { onError }));
    let pending!: Promise<number>;
    act(() => {
      pending = result.current[0]();
    });
    const rejected = expect(pending).rejects.toBeInstanceOf(Error);
    act(() => {
      if (kind === 'task')
        workers[0].onmessage?.({ data: [WorkerStatusType.ERROR, 'failed'] } as MessageEvent);
      if (kind === 'worker')
        workers[0].onerror?.({
          message: 'failed',
          preventDefault: vi.fn(),
        } as unknown as ErrorEvent);
      if (kind === 'message') workers[0].onmessageerror?.();
    });
    await rejected;
    expect(onError).toHaveBeenCalledOnce();
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it('settles and releases even when onError throws', async () => {
    const { result } = renderHook(() =>
      useWebWorkerFn(() => 1, {
        onError: () => {
          throw new Error('callback failed');
        },
      })
    );
    let pending!: Promise<number>;
    act(() => {
      pending = result.current[0]();
    });
    const rejected = expect(pending).rejects.toThrow('task failed');
    act(() => {
      expect(() =>
        workers[0].onmessage?.({ data: [WorkerStatusType.ERROR, 'task failed'] } as MessageEvent)
      ).toThrow('callback failed');
    });
    await rejected;
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it('forwards progress without ending the task and flattens async result types', async () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() => useWebWorkerFn(async () => 1, { onMessage }));
    expectTypeOf(result.current[0]).returns.toEqualTypeOf<Promise<number>>();
    let pending!: Promise<number>;
    act(() => {
      pending = result.current[0]();
    });
    act(() => workers[0].onmessage?.({ data: ['PROGRESS', 50] } as MessageEvent));
    expect(onMessage).toHaveBeenCalledWith({ type: 'PROGRESS', data: 50 });
    expect(result.current[1]).toBe(WorkerStatusType.RUNNING);
    expect(workers[0].terminate).not.toHaveBeenCalled();
    success(0, 1);
    await expect(pending).resolves.toBe(1);
  });
});
