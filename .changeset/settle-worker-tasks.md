---
'@atom-universe/use-web-worker': patch
---

Fix worker task settlement and resource ownership.

- Reject overlapping calls without replacing the active task, including calls made before React renders again.
- Reject active tasks with an `AbortError` on manual termination or component unmount instead of leaving their Promises pending. Consumers must handle cancellation in their existing Promise error path.
- Release workers, timers, and owned Blob URLs after success, cancellation, timeout, startup failure, serialization failure, or worker errors. Ignore stale messages from an earlier task and allow later calls to start fresh.
- Prevent tasks with different local helper implementations from sharing a cached worker script. Escape dependency URLs and preserve non-Error thrown messages.
- Correct async task return types to `Promise<Awaited<ReturnType<T>>>` and report timeouts consistently through `onError`.

Add React-mounted lifecycle regression tests and clarify the isolated function scope and classic-script dependency limitations. The hook tuple, package name, and React peer range remain unchanged.
