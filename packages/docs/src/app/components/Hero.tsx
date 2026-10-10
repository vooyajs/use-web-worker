import benchmark from '../data/benchmark-results.json';
import { CodeBlock } from './CodeBlock';
import { CopyButton } from './CopyButton';
import { InteractiveBenchmark } from './InteractiveBenchmark';
import { WasmLab } from './WasmLab';

const installCommand = 'pnpm add @atom-universe/use-web-worker';

const quickStart = `import { useWebWorkerFn } from '@atom-universe/use-web-worker';

function App() {
  const [workerFn, status] = useWebWorkerFn(
    (items: number[]) => items.reduce((total, item) => total + item, 0)
  );

  async function calculate() {
    const result = await workerFn([1, 2, 3]);
    console.log(result);
  }

  return <button onClick={calculate}>Run in worker: {status}</button>;
}`;

const progressExample = `export function computeMandelbrot(
  width: number,
  height: number,
  maxIterations: number,
  workerContext: Worker
) {
  workerContext.postMessage(['PROGRESS', { percent: 25 }]);
  return new Array(width * height).fill(maxIterations);
}`;

const sections = [
  { href: '#install', label: 'Install' },
  { href: '#lab', label: 'Compute lab' },
  { href: '#benchmark', label: 'Benchmark' },
  { href: '#api', label: 'API' },
  { href: '#examples', label: 'Examples' },
  { href: '#updates', label: 'Updates' },
];

const statusRows = [
  ['PENDING', '4', 'Idle or reset state'],
  ['RUNNING', '3', 'Worker is executing'],
  ['SUCCESS', '0', 'Last run completed'],
  ['ERROR', '1', 'Worker reported an error'],
  ['TIMEOUT', '2', 'Timeout guard fired'],
];

export function Hero() {
  const summary = benchmark.summary;

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="useWebWorker home">
          <span className="brand-mark" aria-hidden="true">
            w<span>↗</span>
          </span>
          <span>useWebWorker</span>
        </a>
        <nav aria-label="Page sections">
          {sections.map(section => (
            <a key={section.href} href={section.href}>
              {section.label}
            </a>
          ))}
        </nav>
        <a className="github-link" href="https://github.com/vooyajs/use-web-worker">
          GitHub
        </a>
      </header>

      <section id="top" className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">React hooks for Web Workers</p>
          <h1>
            Give your UI
            <br />
            <span>room to breathe.</span>
          </h1>
          <p className="lead">
            Move the heavy work off the main thread.
            <br className="desktop-break" /> Keep every click, scroll, and interaction feeling
            light.
          </p>
          <div className="hero-links">
            <a className="primary-link" href="#install">
              Get started <span aria-hidden="true">↗</span>
            </a>
            <a href="#lab">
              Explore the lab <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="hero-actions" id="install">
            <code>{installCommand}</code>
            <CopyButton text={installCommand} />
          </div>
          <p className="hero-meta">
            TYPED CALLS <span>/</span> ZERO RUNTIME DEPS <span>/</span> REACT HOOKS
          </p>
        </div>
        <WasmLab />
      </section>

      <div className="runtime-strip">
        <span>BUILT FOR THE BROWSER</span>
        <p>
          JavaScript convenience. <strong>Room for Rust.</strong>
        </p>
        <a href="#wasm-lifecycle">How the lab works ↓</a>
      </div>
      <section id="wasm-lifecycle" className="section-band lifecycle-section">
        <div className="section-heading">
          <p className="eyebrow">01 / LOAD WHEN IT MATTERS</p>
          <h2>
            Fast first paint.
            <br />
            Compute when you need it.
          </h2>
          <p>
            This experiment uses Vooya’s Rust provider to build a pure-compute Store. A dedicated
            Worker loads its WASM only on demand.
          </p>
        </div>
        <div className="lifecycle-notes">
          <article>
            <span>BUILD TIME</span>
            <h3>Rust → WebAssembly</h3>
            <p>Compile Rust ahead of deployment. Visitors need a browser, not a Rust toolchain.</p>
          </article>
          <article>
            <span>FIRST INTERACTION</span>
            <h3>Fetch. Compile. Initialize.</h3>
            <p>
              Choose “Prepare WASM” to pay startup cost before running, or let the first run do it.
              The lab measures these phases separately.
            </p>
          </article>
          <article>
            <span>NEXT INTERACTION</span>
            <h3>Reuse the ready module.</h3>
            <p>
              Subsequent runs reuse the same Worker and WASM instance. Reset starts a new session;
              the browser’s HTTP and compiler caches may still apply.
            </p>
          </article>
        </div>
        <p className="note lifecycle-caveat">
          Lab timings are local measurements, not a JS-versus-Rust speed claim. Compute includes the
          Store action, snapshot conversion, and pixel-buffer creation. Initialization includes the
          JS binding import. This bridge is specific to this demo; it is not a useWebWorkerFn WASM
          API. Streaming compilation can overlap fetch and compile in production.
        </p>
      </section>

      <section className="section-band">
        <div className="section-heading">
          <p className="eyebrow">02 / THE EVERYDAY API</p>
          <h2>A function call. Another thread.</h2>
        </div>
        <CodeBlock code={quickStart} title="quick-start.tsx" />
        <div className="feature-grid">
          <article>
            <h3>Function-like calls</h3>
            <p>
              Call a worker function and await the result without maintaining worker files by hand.
            </p>
          </article>
          <article>
            <h3>Progress messages</h3>
            <p>Use the injected worker context to stream progress updates back to React state.</p>
          </article>
          <article>
            <h3>Lifecycle cleanup</h3>
            <p>The hook terminates generated workers on completion, timeout, error, or unmount.</p>
          </article>
        </div>
      </section>

      <section id="benchmark" className="section-band">
        <div className="section-heading">
          <p className="eyebrow">Benchmark</p>
          <h2>Feel the difference. Then measure it.</h2>
          <p>
            The reproducible script runs a Mandelbrot-style workload on the main thread and in a
            worker thread. Total runtime can be similar, but the worker path keeps frame scheduling
            available for the page.
          </p>
        </div>

        <InteractiveBenchmark />

        <div className="section-heading benchmark-script-heading">
          <p className="eyebrow">Reproducible script result</p>
          <h3>Same workload, measured from a repeatable local script.</h3>
        </div>

        <div className="benchmark-grid">
          <div className="benchmark-card highlight">
            <span>Max timer gap reduction</span>
            <strong>{summary.blockingReductionPercent}%</strong>
            <p>
              Lower timer gaps mean the main thread has more room to paint and respond to input.
            </p>
          </div>
          <div className="benchmark-card">
            <span>Main thread gap</span>
            <strong>{summary.mainThreadMaxTimerGapMs} ms</strong>
            <p>{summary.mainThreadMissedFramesAt60hz} estimated missed 60Hz frame opportunities.</p>
          </div>
          <div className="benchmark-card">
            <span>Worker path gap</span>
            <strong>{summary.workerMaxTimerGapMs} ms</strong>
            <p>{summary.workerMissedFramesAt60hz} estimated missed 60Hz frame opportunities.</p>
          </div>
        </div>

        <div className="benchmark-table" aria-label="Benchmark results">
          <div>
            <span>Scenario</span>
            <span>Total time</span>
            <span>Max timer gap</span>
            <span>Estimated missed frames</span>
          </div>
          <div>
            <span>Main thread</span>
            <span>{summary.mainThreadDurationMs} ms</span>
            <span>{summary.mainThreadMaxTimerGapMs} ms</span>
            <span>{summary.mainThreadMissedFramesAt60hz}</span>
          </div>
          <div>
            <span>Worker thread</span>
            <span>{summary.workerDurationMs} ms</span>
            <span>{summary.workerMaxTimerGapMs} ms</span>
            <span>{summary.workerMissedFramesAt60hz}</span>
          </div>
        </div>

        <p className="note">
          Generated by <code>pnpm benchmark</code> on {benchmark.environment.runtime}. Checksum
          matched: {summary.checksumMatched ? 'yes' : 'no'}. This saved Node.js run measures timer
          gaps, not browser paint frames or hook overhead. Results vary by device; try the browser
          comparison above.
        </p>
      </section>

      <section id="api" className="section-band">
        <div className="section-heading">
          <p className="eyebrow">API quick reference</p>
          <h2>One hook. A familiar workflow.</h2>
        </div>
        <div className="api-grid">
          <article>
            <h3>useWebWorkerFn</h3>
            <CodeBlock
              title="api.ts"
              code={`const [run, status, terminate] = useWebWorkerFn(fn, {
  dependencies,
  localDependencies,
  timeout,
  onError,
  onMessage,
});`}
            />
          </article>
          <article>
            <h3>WorkerStatusType</h3>
            <div className="status-table">
              {statusRows.map(([name, value, description]) => (
                <div key={name}>
                  <code>{name}</code>
                  <span>{value}</span>
                  <p>{description}</p>
                </div>
              ))}
            </div>
            <p className="api-note">
              <code>localDependencies</code> accepts functions that are stringified into the
              generated worker. <code>onMessage</code> receives custom worker messages.
            </p>
          </article>
        </div>
      </section>

      <section id="examples" className="section-band">
        <div className="section-heading">
          <p className="eyebrow">Examples</p>
          <h2>Progress messages are plain worker messages.</h2>
        </div>
        <CodeBlock code={progressExample} title="progress-worker.ts" className="full-width" />
      </section>

      <section id="updates" className="section-band release-band">
        <div>
          <p className="eyebrow">Maintenance update · unreleased</p>
          <h2>A more dependable lifecycle.</h2>
          <p>
            The next patch, 2.2.2, focuses on task settlement and cleanup. The published package is
            still 2.2.1.
          </p>
        </div>
        <div className="release-detail">
          <span className="release-badge">2.2.2 · pending</span>
          <ul>
            <li>Overlapping calls leave the active task intact.</li>
            <li>
              Cancellation settles with an <code>AbortError</code>.
            </li>
            <li>Workers, timers, and Blob URLs are released when a task ends.</li>
          </ul>
          <a href="https://github.com/vooyajs/use-web-worker/pull/1">
            Read the patch notes <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>
      <footer className="site-footer">
        <a className="brand" href="#top">
          useWebWorker
        </a>
        <span>A small part of the Vooya ecosystem.</span>
        <a href="https://github.com/vooyajs/use-web-worker">Source on GitHub ↗</a>
      </footer>
    </main>
  );
}
