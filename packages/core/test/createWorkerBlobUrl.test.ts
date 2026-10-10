import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import createWorkerBlobUrl, { WorkerStatusType } from '../src/lib/createWorkerBlobUrl.js';

function generatedSource(): string {
  const calls = vi.mocked(Blob).mock.calls;
  return String(calls[calls.length - 1][0]![0]);
}

it("does not reuse another task's URL or helper implementation", async () => {
  const run = new Function('return helper();') as () => number;
  for (const value of [1, 2]) {
    const helper = new Function(`return function helper() { return ${value}; };`)();
    createWorkerBlobUrl(run, [], [helper]);
    const self = { onmessage: undefined as any, postMessage: vi.fn() };
    runInNewContext(generatedSource(), { self });
    await self.onmessage({ data: [[]] });
    expect(self.postMessage).toHaveBeenCalledWith([WorkerStatusType.SUCCESS, value]);
  }
  expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
});

it('preserves quoted dependency URLs when generating importScripts', () => {
  const dependency = 'https://example.com/script.js?name="quoted"\\value';
  createWorkerBlobUrl(() => 1, [dependency]);
  const importScripts = vi.fn();
  runInNewContext(generatedSource(), { self: {}, importScripts });
  expect(importScripts).toHaveBeenCalledWith(dependency);
});

it('reports non-Error rejections from generated worker code', async () => {
  createWorkerBlobUrl(() => {
    throw 'task failed';
  });
  const self = { onmessage: undefined as any, postMessage: vi.fn() };
  runInNewContext(generatedSource(), { self });
  await self.onmessage({ data: [[]] });
  expect(self.postMessage).toHaveBeenCalledWith([WorkerStatusType.ERROR, 'task failed']);
});
