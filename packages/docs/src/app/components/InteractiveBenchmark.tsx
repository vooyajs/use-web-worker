'use client';

import { RefObject, useRef, useState } from 'react';

type BenchmarkMode = 'main' | 'worker';

interface FractalResult {
  checksum: number;
  durationMs: number;
  maxTimerGapMs: number;
  missedFramesAt60hz: number;
  pixels: Uint8ClampedArray;
}

interface PanelState {
  running: boolean;
  result?: Omit<FractalResult, 'pixels'>;
}

const workload = {
  width: 520,
  height: 360,
  maxIterations: 760,
  zoom: 0.76,
};

const workerSource = `
function computeFractal(workload) {
  const { width, height, maxIterations, zoom } = workload;
  const pixels = new Uint8ClampedArray(width * height * 4);
  let checksum = 0;
  const centerX = -0.5;
  const centerY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const x0 = (x - width / 2) / (width * zoom) + centerX;
      const y0 = (y - height / 2) / (height * zoom) + centerY;
      let xi = x0;
      let yi = y0;
      let iteration = 0;

      while (iteration < maxIterations && xi * xi + yi * yi <= 4) {
        const nextX = xi * xi - yi * yi + x0;
        yi = 2 * xi * yi + y0;
        xi = nextX;
        iteration += 1;
      }

      const index = (y * width + x) * 4;
      const escaped = iteration !== maxIterations;
      const tone = escaped ? Math.floor((iteration / maxIterations) * 255) : 0;
      pixels[index] = escaped ? 28 + tone * 0.35 : 13;
      pixels[index + 1] = escaped ? 92 + tone * 0.5 : 24;
      pixels[index + 2] = escaped ? 70 + tone * 0.28 : 18;
      pixels[index + 3] = 255;
      checksum = (checksum + iteration) % 1000000007;
    }
  }

  return { pixels, checksum };
}

self.onmessage = event => {
  const result = computeFractal(event.data);
  self.postMessage(result, [result.pixels.buffer]);
};
`;

function computeFractal(): Pick<FractalResult, 'pixels' | 'checksum'> {
  const { width, height, maxIterations, zoom } = workload;
  const pixels = new Uint8ClampedArray(width * height * 4);
  let checksum = 0;
  const centerX = -0.5;
  const centerY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const x0 = (x - width / 2) / (width * zoom) + centerX;
      const y0 = (y - height / 2) / (height * zoom) + centerY;
      let xi = x0;
      let yi = y0;
      let iteration = 0;

      while (iteration < maxIterations && xi * xi + yi * yi <= 4) {
        const nextX = xi * xi - yi * yi + x0;
        yi = 2 * xi * yi + y0;
        xi = nextX;
        iteration += 1;
      }

      const index = (y * width + x) * 4;
      const escaped = iteration !== maxIterations;
      const tone = escaped ? Math.floor((iteration / maxIterations) * 255) : 0;
      pixels[index] = escaped ? 28 + tone * 0.35 : 13;
      pixels[index + 1] = escaped ? 92 + tone * 0.5 : 24;
      pixels[index + 2] = escaped ? 70 + tone * 0.28 : 18;
      pixels[index + 3] = 255;
      checksum = (checksum + iteration) % 1_000_000_007;
    }
  }

  return { pixels, checksum };
}

function wait(ms: number) {
  return new Promise(resolve => {
    window.setTimeout(resolve, ms);
  });
}

function startProbe() {
  const frameBudgetMs = 16.67;
  const gaps: number[] = [];
  let lastTick = performance.now();
  const interval = window.setInterval(() => {
    const now = performance.now();
    gaps.push(now - lastTick);
    lastTick = now;
  }, frameBudgetMs);

  return {
    stop() {
      window.clearInterval(interval);
      const maxTimerGapMs = gaps.length === 0 ? 0 : Math.max(...gaps);
      return {
        maxTimerGapMs: Number(maxTimerGapMs.toFixed(2)),
        missedFramesAt60hz: Math.max(0, Math.round(maxTimerGapMs / frameBudgetMs) - 1),
      };
    },
  };
}

function drawFractal(canvas: HTMLCanvasElement | null, pixels: Uint8ClampedArray) {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  canvas.width = workload.width;
  canvas.height = workload.height;
  const imageData = new ImageData(pixels, workload.width, workload.height);
  context.putImageData(imageData, 0, 0);
}

async function runWorkerFractal() {
  return new Promise<Pick<FractalResult, 'pixels' | 'checksum'>>((resolve, reject) => {
    const blob = new Blob([workerSource], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    worker.onmessage = event => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({
        pixels: new Uint8ClampedArray(event.data.pixels),
        checksum: event.data.checksum,
      });
    };

    worker.onerror = error => {
      worker.terminate();
      URL.revokeObjectURL(url);
      reject(error);
    };

    worker.postMessage(workload);
  });
}

export function InteractiveBenchmark() {
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const workerCanvasRef = useRef<HTMLCanvasElement>(null);
  const [mainState, setMainState] = useState<PanelState>({ running: false });
  const [workerState, setWorkerState] = useState<PanelState>({ running: false });

  async function run(mode: BenchmarkMode) {
    const setState = mode === 'main' ? setMainState : setWorkerState;
    const canvas = mode === 'main' ? mainCanvasRef.current : workerCanvasRef.current;
    setState(current => ({ ...current, running: true }));

    const probe = startProbe();
    await wait(60);
    const start = performance.now();
    const computed = mode === 'main' ? computeFractal() : await runWorkerFractal();
    const durationMs = performance.now() - start;
    await wait(60);
    const responsiveness = probe.stop();

    drawFractal(canvas, computed.pixels);
    setState({
      running: false,
      result: {
        checksum: computed.checksum,
        durationMs: Number(durationMs.toFixed(2)),
        ...responsiveness,
      },
    });
  }

  const checksumMatch =
    mainState.result && workerState.result
      ? mainState.result.checksum === workerState.result.checksum
      : undefined;

  return (
    <div className="fractal-benchmark">
      <div className="section-heading fractal-heading">
        <p className="eyebrow">Interactive comparison</p>
        <h3>Generate the same fractal on each side.</h3>
        <p>
          The left panel runs a heavier Mandelbrot-style stress test on the main thread. The right
          panel uses a Web Worker, so the pulse indicator should keep moving while the canvas is
          generated.
        </p>
      </div>

      <div className="fractal-panels">
        <FractalPanel
          canvasRef={mainCanvasRef}
          description="Blocks the UI while computing."
          mode="main"
          onRun={() => run('main')}
          state={mainState}
          title="Main thread"
        />
        <FractalPanel
          canvasRef={workerCanvasRef}
          description="Keeps the page responsive."
          mode="worker"
          onRun={() => run('worker')}
          state={workerState}
          title="Web Worker"
        />
      </div>

      <div className="checksum-row">
        <span>
          Stress workload: {workload.width} x {workload.height}, {workload.maxIterations} max
          iterations
        </span>
        <strong>
          {checksumMatch === undefined
            ? 'Run both panels to compare checksums'
            : checksumMatch
              ? 'Checksums match'
              : 'Checksum mismatch'}
        </strong>
      </div>
    </div>
  );
}

interface FractalPanelProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  description: string;
  mode: BenchmarkMode;
  onRun: () => void;
  state: PanelState;
  title: string;
}

function FractalPanel({ canvasRef, description, mode, onRun, state, title }: FractalPanelProps) {
  const result = state.result;

  return (
    <article className="fractal-panel">
      <div className="fractal-panel-header">
        <div>
          <span>{mode === 'main' ? 'Blocking path' : 'Responsive path'}</span>
          <h4>{title}</h4>
          <p>{description}</p>
        </div>
        <div className="pulse-indicator" aria-label={`${title} responsiveness indicator`}>
          <i />
        </div>
      </div>

      <div className="fractal-canvas-frame">
        <canvas ref={canvasRef} width={workload.width} height={workload.height} />
        {!result && !state.running && <span>Canvas waits for generation</span>}
        {state.running && <span>Generating...</span>}
      </div>

      <button type="button" onClick={onRun} disabled={state.running}>
        {state.running ? 'Generating...' : `Run stress test on ${title}`}
      </button>

      <div className="fractal-stats">
        <div>
          <span>Elapsed</span>
          <strong>{result ? `${result.durationMs} ms` : '--'}</strong>
        </div>
        <div>
          <span>Max gap</span>
          <strong>{result ? `${result.maxTimerGapMs} ms` : '--'}</strong>
        </div>
        <div>
          <span>Est. missed frames</span>
          <strong>{result ? result.missedFramesAt60hz : '--'}</strong>
        </div>
      </div>
    </article>
  );
}
