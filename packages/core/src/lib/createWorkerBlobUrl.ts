export enum WorkerStatusType {
  SUCCESS = 0,
  ERROR = 1,
  TIMEOUT = 2,
  RUNNING = 3,
  PENDING = 4,
}

export type WebWorkerStatus =
  | WorkerStatusType.PENDING
  | WorkerStatusType.SUCCESS
  | WorkerStatusType.ERROR
  | WorkerStatusType.TIMEOUT
  | WorkerStatusType.RUNNING;

function createWorkerBlobUrl(
  fn: (...args: any[]) => any,
  dependencies: string[] = [],
  localDependencies: ((...args: any[]) => any)[] = []
) {
  // Each task owns its URL; the hook revokes it when that task settles.
  const blobCode = `
${dependencies.map(d => `importScripts(${JSON.stringify(d)});`).join('\n')}
${localDependencies.map(f => `${f.toString()}`).join('\n')}
const fnString = ${fn.toString()};
self.onmessage = async function(e) {
  const [args] = e.data;
  try {
    const result = await fnString.apply(null, [...args, self]);
    self.postMessage([${WorkerStatusType.SUCCESS}, result]);
  } catch (error) {
    self.postMessage([${WorkerStatusType.ERROR}, error instanceof Error ? error.message : String(error)]);
  }
}`;

  const blob = new Blob([blobCode], { type: 'text/javascript' });
  return URL.createObjectURL(blob);
}

export default createWorkerBlobUrl;
