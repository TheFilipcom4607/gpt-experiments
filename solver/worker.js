importScripts('cube.js', 'solve.js');

let initialized = false;
let workerIndex = 0;
// Per-solve cached searcher + orientation, reused across every depth/prefix job
// so the tables and root coordinates are computed only once per solve.
let searcher = null;
let rotation = null;

self.onmessage = (event) => {
  const msg = event.data || {};
  const { type, id } = msg;
  try {
    if (type === 'init') {
      if (typeof msg.workerIndex === 'number') workerIndex = msg.workerIndex;
      if (!initialized) {
        Cube.initSolver();
        initialized = true;
      }
      self.postMessage({ type: 'ready', id, workerIndex });
      return;
    }

    if (type === 'prepare') {
      // Establish the shared inputs (upright cube, rotation, bounds) once.
      if (!initialized) throw new Error('Solver is not initialized.');
      const cube = new Cube(msg.cube);
      const prep = cube.optimalPrepare(msg.maxDepth == null ? 20 : msg.maxDepth);
      self.postMessage({ type: 'prepared', id, workerIndex, ...prep });
      return;
    }

    if (type === 'loadSlice') {
      // Build (or rebuild) this worker's searcher for the current solve.
      if (!initialized) throw new Error('Solver is not initialized.');
      rotation = msg.rotation;
      const upright = new Cube(msg.upright);
      searcher = Cube.buildOptimalSearcher(upright, msg.reportEvery || 400000, (progress) => {
        self.postMessage({ type: 'sliceProgress', workerIndex, nodes: progress.nodes });
      });
      self.postMessage({ type: 'sliceReady', id, workerIndex });
      return;
    }

    if (type === 'sliceDepth') {
      // Search a single total depth over the assigned root prefix.
      if (!searcher) throw new Error('Slice searcher not loaded.');
      const r = searcher.run(msg.depth, msg.prefix, msg.upperBound);
      let algorithm = null;
      if (r.found) {
        const tokens = [];
        for (let i = 0; i < r.solutionLength; i++) {
          tokens.push(searcher.moveNames[searcher.moveStack[i]]);
        }
        algorithm = Cube.remapSolution(tokens.join(' '), rotation);
      }
      self.postMessage({
        type: 'sliceResult',
        jobId: msg.jobId,
        workerIndex,
        found: r.found,
        algorithm,
        optimalLength: r.found ? r.solutionLength : -1,
        nodes: r.nodes,
      });
      return;
    }

    if (type === 'solve') {
      // Single-worker fallback path (used when the pool is unavailable).
      if (!initialized) throw new Error('Solver is not initialized.');
      const instance = new Cube(msg.cube);
      const result = instance.solveOptimal({
        maxDepth: 20,
        reportEvery: 500000,
        onProgress(progress) {
          self.postMessage({ type: 'progress', id, ...progress });
        },
      });
      self.postMessage({ type: 'solution', id, ...result });
      return;
    }
  } catch (error) {
    self.postMessage({ type: 'error', id, jobId: msg.jobId, workerIndex, message: error?.message || String(error) });
  }
};
