'use strict';

const FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];
const FACE_META = {
  U: { name: 'Up', colorName: 'White', colorCode: 'W', topFace: 'B', fallback: '#f5f7ff' },
  R: { name: 'Right', colorName: 'Red', colorCode: 'R', topFace: 'U', fallback: '#ef3f58' },
  F: { name: 'Front', colorName: 'Green', colorCode: 'G', topFace: 'U', fallback: '#39b86b' },
  D: { name: 'Down', colorName: 'Yellow', colorCode: 'Y', topFace: 'F', fallback: '#ffd43b' },
  L: { name: 'Left', colorName: 'Orange', colorCode: 'O', topFace: 'U', fallback: '#ff8b2c' },
  B: { name: 'Back', colorName: 'Blue', colorCode: 'B', topFace: 'U', fallback: '#377cf5' },
};
const STORAGE_KEY = 'cubescan-state-v1';

const state = {
  faces: Object.fromEntries(FACE_ORDER.map((face) => [face, null])),
  currentFaceIndex: 0,
  selectedSticker: null,
  stream: null,
  track: null,
  torchOn: false,
  rescanSingle: false,
  solution: [],
  solutionIndex: 0,
  solutionMeta: null,
  solvedCube: null,
  solving: false,
  solveCancelled: false,
};

const dom = {};

// 3D cube preview shown on the solve screen. The logical cube state is kept
// in `baseCube` (the scanned cube); `displayCube` tracks whatever the cube
// currently shows so a single move can be animated in place.
const view3d = {
  baseCube: null,
  displayCube: null,
  index: 0,
  animating: false,
  rotX: -26,
  rotY: -34,
  cubies: [],
  faceletEls: null,
};

// Facelet-string layout is U R F D L B, nine stickers each. For a cubie at
// grid (x,y,z) with x,y,z in {-1,0,1} (x right, y up, z toward viewer), map
// each outward face to its index in that 54-char string.
const FACELET_BASE = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };
function faceletIndexFor(face, x, y, z) {
  let row;
  let col;
  switch (face) {
    case 'U': row = z + 1; col = x + 1; break;          // looking down, back row first
    case 'D': row = 1 - z; col = x + 1; break;          // looking up, front row first
    case 'F': row = 1 - y; col = x + 1; break;
    case 'B': row = 1 - y; col = 1 - x; break;
    case 'R': row = 1 - y; col = 1 - z; break;
    case 'L': row = 1 - y; col = z + 1; break;
    default: return -1;
  }
  return FACELET_BASE[face] + row * 3 + col;
}

// Which CSS transform orients a small cubie face outward, per face.
const CUBIE_FACE_TRANSFORM = {
  U: 'rotateX(90deg)',
  D: 'rotateX(-90deg)',
  F: '',
  B: 'rotateY(180deg)',
  R: 'rotateY(90deg)',
  L: 'rotateY(-90deg)',
};

// Move -> rotation axis and the sign of a clockwise (unprimed) quarter turn,
// plus which layer coordinate it turns. Calibrated to the coordinate system
// above and CSS's left-handed rotation sense.
const MOVE_GEOMETRY = {
  U: { axis: 'Y', coord: 'y', layer: 1, sign: -1 },
  D: { axis: 'Y', coord: 'y', layer: -1, sign: 1 },
  R: { axis: 'X', coord: 'x', layer: 1, sign: -1 },
  L: { axis: 'X', coord: 'x', layer: -1, sign: 1 },
  F: { axis: 'Z', coord: 'z', layer: 1, sign: 1 },
  B: { axis: 'Z', coord: 'z', layer: -1, sign: -1 },
};

let deferredInstallPrompt = null;
let toastTimer = null;
// Pool of solver workers, one per available core, so the exact-optimal proof can
// be searched in parallel. Falls back to a single worker where only one exists.
let solverPool = [];
const SOLVER_POOL_SIZE = Math.max(1, Math.min((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4, 8));
let activeSolveReject = null;
let wakeLock = null;
let solverReadyResolve;
let solverReadyReject;
let solverReady = new Promise((resolve, reject) => {
  solverReadyResolve = resolve;
  solverReadyReject = reject;
});

function resetSolverReadyPromise() {
  solverReady = new Promise((resolve, reject) => {
    solverReadyResolve = resolve;
    solverReadyReject = reject;
  });
}
let workerRequestId = 0;

window.addEventListener('DOMContentLoaded', init);

function init() {
  cacheDom();
  bindEvents();
  loadSavedState();
  initSolverPool();
  initInstallHandling();
  registerServiceWorker();
  renderHomeState();
  buildCube3D();
  initCubeDrag();
  showView('homeView');
}

function cacheDom() {
  const ids = [
    'homeButton', 'installButton', 'homeView', 'scanView', 'reviewView', 'solveView',
    'startButton', 'resumeButton', 'solverStatus', 'scanProgress', 'scanTitle',
    'orientationText', 'faceBadge', 'cameraStage', 'camera', 'captureCanvas', 'scanGrid',
    'cameraMessage', 'torchButton', 'backFaceButton', 'captureButton', 'skipToReviewButton',
    'cubeNet', 'selectedStickerText', 'colorPalette', 'colorCounts', 'validationBox',
    'solveProgress', 'solveProgressTitle', 'solveProgressDetail', 'solveProgressBar', 'solveButton',
    'proofLadder', 'ladderProven', 'ladderDepth', 'ladderBound', 'proofStats',
    'statNodes', 'statRate', 'statCores', 'statJobs', 'statElapsed',
    'cancelSolveButton', 'rescanButton', 'clearButton', 'moveCounter', 'optimalProof', 'solvedMessage',
    'solutionPlayer', 'cubeViewport', 'cube3d', 'arCamera', 'arToggleButton', 'replayMoveButton',
    'movePosition', 'moveNotation',
    'moveInstruction', 'previousMoveButton', 'nextMoveButton', 'algorithmText',
    'newScanButton', 'toast',
    'solveComplete', 'solveCompleteTitle', 'solveCompleteSummary', 'solveCompleteReplay', 'solveCompleteScan'
  ];
  ids.forEach((id) => { dom[id] = document.getElementById(id); });
}

function bindEvents() {
  dom.startButton.addEventListener('click', () => beginScan(firstMissingFaceIndex()));
  dom.resumeButton.addEventListener('click', resumeSavedScan);
  dom.homeButton.addEventListener('click', goHome);
  document.querySelector('.brand').addEventListener('click', (event) => {
    event.preventDefault();
    goHome();
  });
  dom.captureButton.addEventListener('click', captureCurrentFace);
  dom.backFaceButton.addEventListener('click', previousFace);
  dom.skipToReviewButton.addEventListener('click', openReview);
  dom.torchButton.addEventListener('click', toggleTorch);
  dom.solveButton.addEventListener('click', solveCube);
  dom.cancelSolveButton.addEventListener('click', cancelOptimalSearch);
  dom.rescanButton.addEventListener('click', rescanSelectedFace);
  dom.clearButton.addEventListener('click', clearScan);
  dom.previousMoveButton.addEventListener('click', () => setSolutionStep(state.solutionIndex - 1));
  dom.nextMoveButton.addEventListener('click', nextSolutionStep);
  dom.replayMoveButton.addEventListener('click', () => previewTurn3D(state.solution[state.solutionIndex]));
  dom.arToggleButton.addEventListener('click', toggleAR);
  dom.newScanButton.addEventListener('click', clearScan);
  dom.solveCompleteScan.addEventListener('click', () => { hideSolveComplete(); clearScan(); });
  dom.solveCompleteReplay.addEventListener('click', () => { hideSolveComplete(); setSolutionStep(0); });
  dom.solveComplete.addEventListener('click', (event) => { if (event.target === dom.solveComplete) hideSolveComplete(); });
  window.addEventListener('resize', () => {
    positionCameraShades();
    if (dom.solveView.classList.contains('active')) sizeCube3D();
  });
  document.addEventListener('keydown', (event) => {
    if (!dom.solveView.classList.contains('active') || !state.solution.length) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); nextSolutionStep(); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); setSolutionStep(state.solutionIndex - 1); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && dom.scanView.classList.contains('active')) stopCamera();
    if (!document.hidden && state.solving) acquireWakeLock();
  });
}

function showView(id) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === id));
  dom.homeButton.classList.toggle('hidden', id === 'homeView');
  window.scrollTo({ top: 0, behavior: 'auto' });
  if (id !== 'solveView') stopAR();
  if (id === 'solveView') requestAnimationFrame(sizeCube3D);
}

function goHome() {
  if (state.solving) {
    showToast('Cancel the optimal search before leaving this screen.');
    return;
  }
  stopCamera();
  renderHomeState();
  showView('homeView');
}

function renderHomeState() {
  const captured = FACE_ORDER.filter((face) => state.faces[face]?.samples?.length === 9).length;
  dom.resumeButton.classList.toggle('hidden', captured === 0);
  dom.resumeButton.textContent = captured === 6 ? 'Review saved scan' : `Resume scan (${captured}/6)`;
}

function resumeSavedScan() {
  const captured = FACE_ORDER.filter((face) => state.faces[face]?.samples?.length === 9).length;
  if (captured === 6) openReview();
  else beginScan(firstMissingFaceIndex());
}

function firstMissingFaceIndex() {
  const index = FACE_ORDER.findIndex((face) => !state.faces[face]?.samples?.length);
  return index === -1 ? 0 : index;
}

async function beginScan(faceIndex = 0, singleFace = false) {
  if (state.solving) {
    showToast('Cancel the optimal search before rescanning.');
    return;
  }
  state.currentFaceIndex = Math.max(0, Math.min(5, faceIndex));
  state.rescanSingle = singleFace;
  updateScanHeader();
  showView('scanView');
  await startCamera();
}

function updateScanHeader() {
  const face = FACE_ORDER[state.currentFaceIndex];
  const meta = FACE_META[face];
  const topColor = FACE_META[meta.topFace].colorName;
  const colorName = meta.colorName.toLowerCase();

  dom.scanProgress.textContent = state.rescanSingle
    ? `Rescanning ${meta.colorName} face`
    : `Face ${state.currentFaceIndex + 1} of 6`;
  dom.scanTitle.textContent = `Scan the ${colorName} face`;
  dom.orientationText.textContent = `Keep the ${topColor.toLowerCase()} center at the top edge.`;
  dom.faceBadge.textContent = meta.colorCode;
  dom.faceBadge.style.background = meta.fallback;
  dom.faceBadge.style.color = face === 'U' || face === 'D' ? '#111522' : '#ffffff';
  dom.captureButton.setAttribute('aria-label', `Capture ${colorName} face`);
  dom.backFaceButton.disabled = state.currentFaceIndex === 0 || state.rescanSingle;
  dom.backFaceButton.classList.toggle('hidden', state.rescanSingle);
  dom.skipToReviewButton.classList.toggle('hidden', !allFacesCaptured() || state.rescanSingle);
}

async function startCamera() {
  stopCamera();
  dom.cameraMessage.classList.add('hidden');
  dom.captureButton.disabled = true;

  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    showCameraError('The camera requires HTTPS. Host this folder on an HTTPS site or open it through localhost.');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    showCameraError('This browser does not expose the camera API. Try Safari, Chrome, or Edge on a phone.');
    return;
  }

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
    dom.camera.srcObject = state.stream;
    await dom.camera.play();
    state.track = state.stream.getVideoTracks()[0] || null;
    dom.captureButton.disabled = false;
    updateTorchAvailability();
    requestAnimationFrame(positionCameraShades);
  } catch (error) {
    const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
    showCameraError(denied
      ? 'Camera access was denied. Allow camera access in your browser settings, then open the scanner again.'
      : `The camera could not start: ${error?.message || error}`);
  }
}

function stopCamera() {
  if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
  state.stream = null;
  state.track = null;
  state.torchOn = false;
  dom.torchButton.classList.add('hidden');
  dom.torchButton.classList.remove('active');
  dom.camera.srcObject = null;
}

// Opt-in AR overlay: the rear camera behind the transparent CSS cube. Reuses the
// same getUserMedia constraints and secure-context / permission handling as the
// scanner, but with its own stream so it never clashes with scanning.
let arStream = null;

async function toggleAR() {
  if (arStream) { stopAR(); return; }
  await startAR();
}

async function startAR() {
  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    showToast('AR view needs HTTPS or localhost to use the camera.');
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('This browser does not expose the camera API.');
    return;
  }
  try {
    arStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    });
    dom.arCamera.srcObject = arStream;
    await dom.arCamera.play();
    dom.arCamera.classList.remove('hidden');
    dom.cubeViewport.closest('.move-visual-card')?.classList.add('ar-active');
    dom.arToggleButton.classList.add('active');
    dom.arToggleButton.setAttribute('aria-pressed', 'true');
    dom.arToggleButton.textContent = 'Exit AR';
  } catch (error) {
    stopAR();
    const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
    showToast(denied ? 'Camera access was denied for AR view.' : `AR view could not start: ${error?.message || error}`);
  }
}

function stopAR() {
  if (arStream) arStream.getTracks().forEach((track) => track.stop());
  arStream = null;
  dom.arCamera.srcObject = null;
  dom.arCamera.classList.add('hidden');
  dom.cubeViewport.closest('.move-visual-card')?.classList.remove('ar-active');
  dom.arToggleButton.classList.remove('active');
  dom.arToggleButton.setAttribute('aria-pressed', 'false');
  dom.arToggleButton.textContent = 'AR view';
}

function showCameraError(message) {
  dom.cameraMessage.textContent = message;
  dom.cameraMessage.classList.remove('hidden');
  dom.captureButton.disabled = true;
}

function updateTorchAvailability() {
  try {
    const capabilities = state.track?.getCapabilities?.();
    dom.torchButton.classList.toggle('hidden', !capabilities?.torch);
  } catch {
    dom.torchButton.classList.add('hidden');
  }
}

async function toggleTorch() {
  if (!state.track) return;
  try {
    state.torchOn = !state.torchOn;
    await state.track.applyConstraints({ advanced: [{ torch: state.torchOn }] });
    dom.torchButton.classList.toggle('active', state.torchOn);
  } catch {
    state.torchOn = false;
    dom.torchButton.classList.remove('active');
    showToast('Flashlight control is unavailable on this camera.');
  }
}

function positionCameraShades() {
  if (!dom.scanView.classList.contains('active')) return;
  const stage = dom.cameraStage.getBoundingClientRect();
  const grid = dom.scanGrid.getBoundingClientRect();
  const top = Math.max(0, grid.top - stage.top);
  const bottom = Math.max(0, stage.bottom - grid.bottom);
  const left = Math.max(0, grid.left - stage.left);
  const right = Math.max(0, stage.right - grid.right);
  const [shadeTop, shadeBottom, shadeLeft, shadeRight] = document.querySelectorAll('.camera-shade');
  Object.assign(shadeTop.style, { top: '0', left: '0', right: '0', height: `${top}px` });
  Object.assign(shadeBottom.style, { bottom: '0', left: '0', right: '0', height: `${bottom}px` });
  Object.assign(shadeLeft.style, { top: `${top}px`, bottom: `${bottom}px`, left: '0', width: `${left}px` });
  Object.assign(shadeRight.style, { top: `${top}px`, bottom: `${bottom}px`, right: '0', width: `${right}px` });
}

function captureCurrentFace() {
  if (!state.stream || dom.camera.readyState < 2) {
    showToast('The camera is not ready yet.');
    return;
  }

  try {
    const samples = sampleStickerGrid();
    const averageLuma = samples.reduce((sum, color) => sum + relativeLuminance(color), 0) / 9;
    if (averageLuma < 0.025) {
      showToast('The image is too dark. Add more light or use the flashlight.');
      return;
    }

    const face = FACE_ORDER[state.currentFaceIndex];
    state.faces[face] = { samples, labels: null, confidence: null };
    saveState();
    flashCapture();

    if (state.rescanSingle) {
      classifyAllStickers();
      stopCamera();
      openReview();
      return;
    }

    if (state.currentFaceIndex === 5) {
      classifyAllStickers();
      stopCamera();
      openReview();
    } else {
      state.currentFaceIndex += 1;
      updateScanHeader();
      showToast(`${FACE_META[face].colorName} face captured.`);
    }
  } catch (error) {
    showToast(error?.message || 'Could not sample the camera image.');
  }
}

function flashCapture() {
  const flash = document.createElement('div');
  Object.assign(flash.style, {
    position: 'absolute', inset: '0', background: '#fff', opacity: '.7', pointerEvents: 'none', zIndex: '20', transition: 'opacity .22s ease'
  });
  dom.cameraStage.appendChild(flash);
  requestAnimationFrame(() => { flash.style.opacity = '0'; });
  setTimeout(() => flash.remove(), 250);
}

function previousFace() {
  if (state.currentFaceIndex <= 0) return;
  state.currentFaceIndex -= 1;
  updateScanHeader();
}

function sampleStickerGrid() {
  const video = dom.camera;
  const canvas = dom.captureCanvas;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  if (!videoWidth || !videoHeight) throw new Error('The camera frame is not available yet.');

  canvas.width = videoWidth;
  canvas.height = videoHeight;
  context.drawImage(video, 0, 0, videoWidth, videoHeight);

  const videoRect = video.getBoundingClientRect();
  const gridRect = dom.scanGrid.getBoundingClientRect();
  const scale = Math.max(videoRect.width / videoWidth, videoRect.height / videoHeight);
  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const offsetX = (videoRect.width - renderedWidth) / 2;
  const offsetY = (videoRect.height - renderedHeight) / 2;
  const gridX = gridRect.left - videoRect.left;
  const gridY = gridRect.top - videoRect.top;
  const cellWidth = gridRect.width / 3;
  const cellHeight = gridRect.height / 3;
  const samples = [];

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const centerCssX = gridX + (col + 0.5) * cellWidth;
      const centerCssY = gridY + (row + 0.5) * cellHeight;
      const centerX = (centerCssX - offsetX) / scale;
      const centerY = (centerCssY - offsetY) / scale;
      const sampleWidth = Math.max(8, (cellWidth * 0.34) / scale);
      const sampleHeight = Math.max(8, (cellHeight * 0.34) / scale);
      const x = Math.max(0, Math.round(centerX - sampleWidth / 2));
      const y = Math.max(0, Math.round(centerY - sampleHeight / 2));
      const width = Math.min(videoWidth - x, Math.round(sampleWidth));
      const height = Math.min(videoHeight - y, Math.round(sampleHeight));
      const pixels = context.getImageData(x, y, width, height).data;
      samples.push(robustMedianColor(pixels));
    }
  }
  return samples;
}

function robustMedianColor(pixelData) {
  const reds = [];
  const greens = [];
  const blues = [];
  for (let i = 0; i < pixelData.length; i += 16) {
    const r = pixelData[i];
    const g = pixelData[i + 1];
    const b = pixelData[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max > 248 && max - min < 10) continue;
    reds.push(r); greens.push(g); blues.push(b);
  }
  if (!reds.length) {
    for (let i = 0; i < pixelData.length; i += 16) {
      reds.push(pixelData[i]); greens.push(pixelData[i + 1]); blues.push(pixelData[i + 2]);
    }
  }
  return { r: median(reds), g: median(greens), b: median(blues) };
}

function median(values) {
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : Math.round((values[mid - 1] + values[mid]) / 2);
}

function allFacesCaptured() {
  return FACE_ORDER.every((face) => state.faces[face]?.samples?.length === 9);
}

function classifyAllStickers() {
  if (!allFacesCaptured()) return false;
  const references = Object.fromEntries(FACE_ORDER.map((face) => [face, state.faces[face].samples[4]]));
  const rows = [];
  const stickerRefs = [];

  FACE_ORDER.forEach((face) => {
    state.faces[face].labels = new Array(9).fill(null);
    state.faces[face].confidence = new Array(9).fill(Infinity);
    state.faces[face].labels[4] = face;
    state.faces[face].samples.forEach((sample, index) => {
      if (index === 4) return;
      const costs = FACE_ORDER.flatMap((candidate) => Array(8).fill(colorDistance(sample, references[candidate])));
      rows.push(costs);
      stickerRefs.push({ face, index, sample });
    });
  });

  const assignment = hungarian(rows);
  stickerRefs.forEach((ref, rowIndex) => {
    const slot = assignment[rowIndex];
    const label = FACE_ORDER[Math.floor(slot / 8)];
    state.faces[ref.face].labels[ref.index] = label;
    const directCosts = FACE_ORDER.map((candidate) => colorDistance(ref.sample, references[candidate])).sort((a, b) => a - b);
    state.faces[ref.face].confidence[ref.index] = directCosts[1] - directCosts[0];
  });
  saveState();
  return true;
}

// Minimum-cost square assignment. Returns the selected column for each row.
function hungarian(cost) {
  const n = cost.length;
  const m = cost[0]?.length || 0;
  if (!n || n !== m) throw new Error('Color assignment matrix must be square.');
  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0);
  const way = new Array(m + 1).fill(0);

  for (let i = 1; i <= n; i += 1) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(Infinity);
    const used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= m; j += 1) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j += 1) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const assignment = new Array(n).fill(-1);
  for (let j = 1; j <= m; j += 1) assignment[p[j] - 1] = j - 1;
  return assignment;
}

function colorDistance(a, b) {
  const labA = rgbToLab(a);
  const labB = rgbToLab(b);
  const dl = labA.l - labB.l;
  const da = labA.a - labB.a;
  const db = labA.b - labB.b;
  const labDistance = Math.sqrt(dl * dl + da * da + db * db);
  const hsvA = rgbToHsv(a);
  const hsvB = rgbToHsv(b);
  const hueDelta = Math.min(Math.abs(hsvA.h - hsvB.h), 360 - Math.abs(hsvA.h - hsvB.h)) / 180;
  const saturationWeight = Math.min(hsvA.s, hsvB.s);
  return labDistance + hueDelta * 42 * saturationWeight + Math.abs(hsvA.s - hsvB.s) * 9;
}

function rgbToLab({ r, g, b }) {
  let rr = r / 255; let gg = g / 255; let bb = b / 255;
  rr = rr > 0.04045 ? ((rr + 0.055) / 1.055) ** 2.4 : rr / 12.92;
  gg = gg > 0.04045 ? ((gg + 0.055) / 1.055) ** 2.4 : gg / 12.92;
  bb = bb > 0.04045 ? ((bb + 0.055) / 1.055) ** 2.4 : bb / 12.92;
  const x = (rr * 0.4124 + gg * 0.3576 + bb * 0.1805) / 0.95047;
  const y = rr * 0.2126 + gg * 0.7152 + bb * 0.0722;
  const z = (rr * 0.0193 + gg * 0.1192 + bb * 0.9505) / 1.08883;
  const f = (value) => value > 0.008856 ? value ** (1 / 3) : (7.787 * value) + (16 / 116);
  const fx = f(x); const fy = f(y); const fz = f(z);
  return { l: (116 * fy) - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function rgbToHsv({ r, g, b }) {
  const rr = r / 255; const gg = g / 255; const bb = b / 255;
  const max = Math.max(rr, gg, bb); const min = Math.min(rr, gg, bb);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === rr) h = 60 * (((gg - bb) / delta) % 6);
    else if (max === gg) h = 60 * (((bb - rr) / delta) + 2);
    else h = 60 * (((rr - gg) / delta) + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

function relativeLuminance({ r, g, b }) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function openReview() {
  if (!allFacesCaptured()) {
    showToast('Capture all six faces first.');
    return;
  }
  if (!FACE_ORDER.every((face) => state.faces[face].labels?.length === 9)) classifyAllStickers();
  stopCamera();
  state.selectedSticker = null;
  renderReview();
  showView('reviewView');
}

function renderReview() {
  renderCubeNet();
  renderColorPalette();
  renderColorCounts();
  renderValidation();
}

function renderCubeNet() {
  dom.cubeNet.innerHTML = '';
  const netOrder = ['U', 'L', 'F', 'R', 'B', 'D'];
  netOrder.forEach((face) => {
    const faceElement = document.createElement('div');
    faceElement.className = 'net-face';
    faceElement.dataset.face = face;
    const label = document.createElement('span');
    label.className = 'face-label';
    label.textContent = `${face} · ${FACE_META[face].name}`;
    faceElement.appendChild(label);

    state.faces[face].labels.forEach((stickerFace, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sticker';
      button.style.background = displayColor(stickerFace);
      button.ariaLabel = `${FACE_META[face].name} face, sticker ${index + 1}: ${FACE_META[stickerFace].name} color`;
      if (index === 4) {
        button.classList.add('center');
        button.disabled = true;
      } else {
        button.addEventListener('click', () => selectSticker(face, index));
      }
      if (state.selectedSticker?.face === face && state.selectedSticker?.index === index) button.classList.add('selected');
      const confidence = state.faces[face].confidence?.[index];
      if (Number.isFinite(confidence) && confidence < 7) button.classList.add('low-confidence');
      faceElement.appendChild(button);
    });
    dom.cubeNet.appendChild(faceElement);
  });
}

function selectSticker(face, index) {
  state.selectedSticker = { face, index };
  const currentLabel = state.faces[face].labels[index];
  dom.selectedStickerText.textContent = `${FACE_META[face].name} face, sticker ${index + 1}. Currently classified as ${FACE_META[currentLabel].name}.`;
  renderCubeNet();
  renderColorPalette();
}

function renderColorPalette() {
  dom.colorPalette.innerHTML = '';
  FACE_ORDER.forEach((face) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'palette-color';
    button.style.background = displayColor(face);
    button.title = FACE_META[face].name;
    button.ariaLabel = `Set selected sticker to ${FACE_META[face].name}`;
    button.disabled = !state.selectedSticker;
    button.addEventListener('click', () => setSelectedSticker(face));
    dom.colorPalette.appendChild(button);
  });
}

function setSelectedSticker(label) {
  if (state.solving) {
    showToast('Cancel the optimal search before editing stickers.');
    return;
  }
  if (!state.selectedSticker) return;
  const { face, index } = state.selectedSticker;
  state.faces[face].labels[index] = label;
  state.faces[face].confidence[index] = Infinity;
  saveState();
  renderReview();
  dom.selectedStickerText.textContent = `${FACE_META[face].name} face, sticker ${index + 1}. Set to ${FACE_META[label].name}.`;
}

function renderColorCounts() {
  const counts = Object.fromEntries(FACE_ORDER.map((face) => [face, 0]));
  FACE_ORDER.forEach((face) => state.faces[face].labels.forEach((label) => { counts[label] += 1; }));
  dom.colorCounts.innerHTML = '';
  FACE_ORDER.forEach((face) => {
    const row = document.createElement('div');
    row.className = `count-row${counts[face] === 9 ? '' : ' bad'}`;
    row.innerHTML = `<span class="count-dot" style="background:${displayColor(face)}"></span><span>${FACE_META[face].name} color</span><strong>${counts[face]}/9</strong>`;
    dom.colorCounts.appendChild(row);
  });
}

function renderValidation() {
  const result = validateCubeState();
  dom.validationBox.className = `validation-box ${result.valid ? 'good' : 'bad'}`;
  dom.validationBox.innerHTML = `<strong>${escapeHtml(result.title)}</strong><span>${escapeHtml(result.message)}</span>`;
  dom.solveButton.disabled = !result.valid || state.solving;
  return result;
}

function faceletString() {
  return FACE_ORDER.map((face) => state.faces[face].labels.join('')).join('');
}

function validateCubeState() {
  if (!allFacesCaptured()) return { valid: false, title: 'Scan incomplete', message: 'Capture all six faces.' };
  const labels = FACE_ORDER.flatMap((face) => state.faces[face].labels || []);
  if (labels.length !== 54 || labels.some((label) => !FACE_ORDER.includes(label))) {
    return { valid: false, title: 'Missing sticker data', message: 'One or more stickers have no recognized color.' };
  }
  const counts = Object.fromEntries(FACE_ORDER.map((face) => [face, labels.filter((label) => label === face).length]));
  const wrongCount = FACE_ORDER.find((face) => counts[face] !== 9);
  if (wrongCount) {
    return { valid: false, title: 'Color counts do not match', message: `The ${FACE_META[wrongCount].name} color appears ${counts[wrongCount]} times; it must appear exactly 9 times.` };
  }
  if (FACE_ORDER.some((face) => state.faces[face].labels[4] !== face)) {
    return { valid: false, title: 'A center color is incorrect', message: 'Center stickers define each face and cannot be changed.' };
  }

  try {
    const cube = Cube.fromString(faceletString());
    if (!isPermutation(cube.cp, 8) || !isPermutation(cube.ep, 12)) {
      return { valid: false, title: 'Impossible piece combination', message: 'At least one edge or corner appears twice, or another piece is missing. Check the marked and similarly colored stickers.' };
    }
    if (cube.co.reduce((sum, value) => sum + value, 0) % 3 !== 0) {
      return { valid: false, title: 'A corner is twisted', message: 'This scan describes a single twisted corner, which a normal cube cannot reach. Check corner stickers and face orientation.' };
    }
    if (cube.eo.reduce((sum, value) => sum + value, 0) % 2 !== 0) {
      return { valid: false, title: 'An edge is flipped', message: 'This scan describes a single flipped edge. Check edge stickers and make sure every face used the requested top edge.' };
    }
    if (permutationParity(cube.cp) !== permutationParity(cube.ep)) {
      return { valid: false, title: 'Two pieces are swapped', message: 'This state cannot be reached by legal turns. Recheck the scan orientation or two similar stickers.' };
    }
    return { valid: true, title: 'Cube state is valid', message: 'All 54 stickers form a physically solvable 3×3 cube.', cube };
  } catch (error) {
    return { valid: false, title: 'Could not read this cube', message: error?.message || 'Review the sticker colors and scan orientation.' };
  }
}

function isPermutation(values, size) {
  return Array.isArray(values)
    && values.length === size
    && [...values].sort((a, b) => a - b).every((value, index) => value === index);
}

function permutationParity(values) {
  let inversions = 0;
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) if (values[i] > values[j]) inversions += 1;
  }
  return inversions % 2;
}

function rescanSelectedFace() {
  const face = state.selectedSticker?.face || 'U';
  beginScan(FACE_ORDER.indexOf(face), true);
}

function clearScan() {
  if (state.solving) {
    showToast('Cancel the optimal search before clearing the scan.');
    return;
  }
  stopCamera();
  FACE_ORDER.forEach((face) => { state.faces[face] = null; });
  state.selectedSticker = null;
  state.solution = [];
  state.solutionMeta = null;
  localStorage.removeItem(STORAGE_KEY);
  renderHomeState();
  showView('homeView');
  showToast('Scan cleared.');
}

async function solveCube() {
  const validation = renderValidation();
  if (!validation.valid || state.solving) return;

  state.solving = true;
  state.solveCancelled = false;
  state.solutionMeta = null;
  dom.solveButton.disabled = true;
  dom.solveButton.textContent = 'Searching optimally…';
  dom.cancelSolveButton.classList.remove('hidden');
  dom.solveProgress.classList.remove('hidden');
  updateSolveProgress({ stage: 'upper-bound' });

  try {
    await acquireWakeLock();
    await solverReady;
    const cubeJSON = validation.cube.toJSON();
    let result;
    const abort = new Promise((_, reject) => { activeSolveReject = reject; });
    try {
      result = await Promise.race([runParallelSolve(cubeJSON, updateSolveProgress), abort]);
    } catch (poolError) {
      if (state.solveCancelled) throw poolError;
      if (!solverPool.length) throw poolError;
      // Fall back to a single-worker exact solve on unexpected pool failure.
      result = await requestOnce(solverPool[0].worker, { type: 'solve', cube: cubeJSON }, 'solution', updateSolveProgress);
    }
    const algorithm = result.algorithm || '';
    const verification = validation.cube.clone();
    if (algorithm) verification.move(algorithm);
    if (!verification.isSolved()) throw new Error('The generated algorithm did not verify.');

    state.solution = algorithm.trim() ? algorithm.trim().split(/\s+/) : [];
    state.solutionIndex = 0;
    state.solutionMeta = result;
    state.solvedCube = validation.cube.clone();
    renderSolution();
    showView('solveView');
  } catch (error) {
    if (state.solveCancelled || error?.message === 'Search cancelled.') {
      showToast('Optimal search cancelled.');
    } else {
      showToast(`Solver error: ${error?.message || error}`);
    }
  } finally {
    activeSolveReject = null;
    state.solving = false;
    dom.solveProgress.classList.add('hidden');
    dom.cancelSolveButton.classList.add('hidden');
    dom.cancelSolveButton.disabled = false;
    dom.solveButton.textContent = 'Find shortest solution';
    dom.solveButton.disabled = !validateCubeState().valid;
    await releaseWakeLock();
  }
}

async function acquireWakeLock() {
  if (!('wakeLock' in navigator) || document.hidden || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; }, { once: true });
  } catch {
    wakeLock = null;
  }
}

async function releaseWakeLock() {
  if (!wakeLock) return;
  const lock = wakeLock;
  wakeLock = null;
  try { await lock.release(); } catch { /* already released */ }
}

function updateSolveProgress(progress = {}) {
  const stage = progress.stage;

  if (stage === 'upper-bound') {
    dom.solveProgressTitle.textContent = 'Cracking a first solution…';
    dom.solveProgressDetail.textContent = 'Running a fast two-phase solve for an upper bound — then the exhaustive proof begins.';
    dom.proofLadder.style.display = 'none';
    dom.proofStats.style.display = 'none';
    dom.solveProgressBar.style.width = '4%';
    return;
  }

  if (stage === 'loading') {
    const cores = progress.cores || 1;
    dom.solveProgressTitle.textContent = `Arming ${cores} core${cores === 1 ? '' : 's'}…`;
    dom.solveProgressDetail.textContent = 'Splitting the move tree into independent branches for the pool.';
    dom.solveProgressBar.style.width = '6%';
    return;
  }

  if (stage !== 'proof-search') return;

  const cores = progress.cores || 1;
  const depth = progress.depth;
  const upper = progress.upperBound;

  dom.solveProgressTitle.textContent = Number.isFinite(depth)
    ? `Proving depth ${depth} — ruling out every ${depth}-move solution`
    : 'Proving optimality…';
  dom.solveProgressDetail.textContent = cores > 1
    ? `Exhaustively expanding the move tree with 3-axis admissible pruning across ${cores} cores. Anything that survives could beat ${upper}.`
    : `Exhaustively expanding the move tree with 3-axis admissible pruning. Anything that survives could beat ${upper}.`;

  dom.proofLadder.style.display = '';
  dom.ladderProven.textContent = Number.isFinite(depth) ? String(depth - 1) : '–';
  dom.ladderDepth.textContent = Number.isFinite(depth) ? String(depth) : '–';
  dom.ladderBound.textContent = Number.isFinite(upper) ? String(upper) : '–';

  dom.proofStats.style.display = '';
  const nodes = Number.isFinite(progress.nodes) ? progress.nodes : 0;
  const secs = (progress.elapsedMs || 0) / 1000;
  const rate = secs > 0.2 ? nodes / secs : 0;
  dom.statNodes.textContent = formatCompact(nodes);
  dom.statNodes.title = `${formatInteger(nodes)} positions`;
  dom.statRate.textContent = rate ? formatCompact(rate) : '—';
  dom.statRate.title = rate ? `${formatInteger(rate)} positions / sec` : '';
  dom.statCores.textContent = String(cores);
  dom.statJobs.textContent = (Number.isFinite(progress.jobsTotal) && progress.jobsTotal > 0)
    ? `${formatInteger(progress.jobsDone || 0)} / ${formatInteger(progress.jobsTotal)}`
    : '—';
  dom.statElapsed.textContent = formatDuration(progress.elapsedMs || 0);

  // Honest progress bar: the fraction of this depth's branches already cleared.
  let percent;
  if (Number.isFinite(progress.jobsTotal) && progress.jobsTotal > 0) {
    percent = Math.round(((progress.jobsDone || 0) / progress.jobsTotal) * 100);
  } else if (Number.isFinite(depth) && Number.isFinite(upper) && upper > 0) {
    percent = Math.round((depth / upper) * 100);
  } else {
    percent = 8;
  }
  dom.solveProgressBar.style.width = `${Math.max(4, Math.min(100, percent))}%`;
}

function cancelOptimalSearch() {
  if (!state.solving || state.solveCancelled) return;
  state.solveCancelled = true;
  dom.cancelSolveButton.disabled = true;
  if (activeSolveReject) activeSolveReject(new Error('Search cancelled.'));
  activeSolveReject = null;
  solverPool.forEach((entry) => entry.worker.terminate());
  solverPool = [];
  resetSolverReadyPromise();
  setSolverStatus('Restarting solver…', 'loading');
  initSolverPool();
}

function initSolverPool() {
  const readyResolve = solverReadyResolve;
  const readyReject = solverReadyReject;
  if (!window.Worker) {
    setSolverStatus('Worker unsupported', 'error');
    readyReject(new Error('This browser does not support Web Workers.'));
    return;
  }
  try {
    solverPool = [];
    for (let i = 0; i < SOLVER_POOL_SIZE; i++) {
      const worker = new Worker('solver/worker.js');
      const entry = { worker, index: i };
      worker.addEventListener('error', (event) => {
        setSolverStatus('Solver failed', 'error');
        readyReject(new Error(event.message || 'Solver worker failed.'));
      });
      solverPool.push(entry);
    }
    Promise.all(solverPool.map((entry) =>
      requestOnce(entry.worker, { type: 'init', workerIndex: entry.index }, 'ready'),
    )).then(() => {
      const cores = solverPool.length;
      setSolverStatus(cores > 1 ? `Optimal solver ready · ${cores} cores` : 'Optimal solver ready', 'ready');
      readyResolve();
    }).catch((error) => {
      setSolverStatus('Solver failed', 'error');
      readyReject(error);
    });
  } catch (error) {
    setSolverStatus('Solver failed', 'error');
    readyReject(error);
  }
}

// One request/response round-trip with a worker, matched by message id. Progress
// frames ('progress'/'sliceProgress') are streamed to onProgress without
// settling the promise.
function requestOnce(worker, message, doneType, onProgress = null) {
  const id = ++workerRequestId;
  return new Promise((resolve, reject) => {
    const listener = (event) => {
      const data = event.data || {};
      if (data.id !== id) return;
      if (data.type === 'progress' || data.type === 'sliceProgress') {
        onProgress?.(data);
        return;
      }
      worker.removeEventListener('message', listener);
      if (data.type === 'error') reject(new Error(data.message || 'Solver error.'));
      else resolve(data);
    };
    worker.addEventListener('message', listener);
    worker.postMessage({ ...message, id });
  });
}

// Move-pruning face table (mirrors nextMoves1 in solve.js): the faces allowed
// after a given last face. Keeps generated root prefixes on the solver's own
// canonical move ordering.
function nextFacesFor(lastFace) {
  const faces = [];
  for (let face = 0; face < 6; face++) {
    if (face !== lastFace && face !== lastFace - 3) faces.push(face);
  }
  return faces;
}

// Split an optimal search of total length `depth` into independent subtree jobs
// by fixing the first two moves (~240 jobs — enough to keep the pool balanced).
// Shallow depths run as a single whole-tree job.
function buildDepthPrefixes(depth) {
  if (depth < 2) return [null];
  const prefixes = [];
  for (let m0 = 0; m0 < 18; m0++) {
    const f0 = (m0 / 3) | 0;
    for (const f1 of nextFacesFor(f0)) {
      for (let p = 0; p < 3; p++) prefixes.push([m0, f1 * 3 + p]);
    }
  }
  return prefixes;
}

// Coordinate the parallel optimal proof across the pool. Optimality is preserved:
// depths are attempted in increasing order and a depth is declared solution-free
// only after every one of its jobs has completed.
async function runParallelSolve(cubeJSON, onProgress) {
  const pool = solverPool;
  if (!pool.length) throw new Error('Solver pool is unavailable.');
  const cores = pool.length;
  const started = Date.now();
  const perWorkerNodes = new Array(cores).fill(0);
  const totalNodes = () => perWorkerNodes.reduce((a, b) => a + b, 0);

  onProgress({ stage: 'upper-bound' });
  const prep = await requestOnce(pool[0].worker, { type: 'prepare', cube: cubeJSON, maxDepth: 20 }, 'prepared');
  if (prep.solved) {
    return { algorithm: '', optimalLength: 0, quickLength: 0, nodes: 0, elapsedMs: Date.now() - started, searchedThrough: 0, cores };
  }

  onProgress({ stage: 'loading', depth: prep.lowerBound, lowerBound: prep.lowerBound, upperBound: prep.quickLength, cores, jobsDone: 0, jobsTotal: 0, nodes: 0, elapsedMs: Date.now() - started });
  await Promise.all(pool.map((entry) =>
    requestOnce(entry.worker, { type: 'loadSlice', upright: prep.upright, rotation: prep.rotation, reportEvery: 400000 }, 'sliceReady'),
  ));

  for (let depth = prep.lowerBound; depth <= prep.lastDepth; depth++) {
    const found = await runDepth(depth, prep, perWorkerNodes, onProgress, started, cores);
    if (found) {
      return {
        algorithm: found.algorithm,
        optimalLength: found.optimalLength,
        quickLength: prep.quickLength,
        nodes: totalNodes(),
        elapsedMs: Date.now() - started,
        searchedThrough: depth,
        cores,
      };
    }
  }

  // Nothing shorter than the quick bound exists, so it is provably optimal.
  return {
    algorithm: prep.quickAlgorithm,
    optimalLength: prep.quickLength,
    quickLength: prep.quickLength,
    nodes: totalNodes(),
    elapsedMs: Date.now() - started,
    searchedThrough: prep.lastDepth,
    cores,
  };
}

// Search one total depth across the pool through a work queue. Resolves with the
// winning result as soon as any job finds a solution, or null once every job at
// this depth has finished with none.
function runDepth(depth, prep, perWorkerNodes, onProgress, started, cores) {
  return new Promise((resolve, reject) => {
    const prefixes = buildDepthPrefixes(depth);
    const jobsTotal = prefixes.length;
    let jobsDone = 0;
    let next = 0;
    let outstanding = 0;
    let settled = false;

    const emit = () => onProgress({
      stage: 'proof-search', depth, lowerBound: prep.lowerBound, upperBound: prep.quickLength,
      cores, jobsDone, jobsTotal, nodes: perWorkerNodes.reduce((a, b) => a + b, 0), elapsedMs: Date.now() - started,
    });

    function assign(entry) {
      if (settled || next >= prefixes.length) return;
      const jobId = next++;
      outstanding++;
      entry.worker.postMessage({ type: 'sliceDepth', depth, prefix: prefixes[jobId], upperBound: prep.quickLength, jobId });
    }

    function cleanup() {
      solverPool.forEach((entry, i) => entry.worker.removeEventListener('message', listeners[i]));
    }

    function onMessage(event) {
      const data = event.data || {};
      if (typeof data.workerIndex !== 'number') return;
      if (data.type === 'sliceProgress') {
        perWorkerNodes[data.workerIndex] = data.nodes;
        if (!settled) emit();
        return;
      }
      if (data.type === 'error') {
        if (!settled) { settled = true; cleanup(); reject(new Error(data.message || 'Slice error.')); }
        return;
      }
      if (data.type !== 'sliceResult') return;
      outstanding--;
      jobsDone++;
      if (typeof data.nodes === 'number') perWorkerNodes[data.workerIndex] = data.nodes;
      if (data.found && !settled) {
        settled = true;
        cleanup();
        emit();
        resolve({ algorithm: data.algorithm, optimalLength: data.optimalLength });
        return;
      }
      if (settled) return;
      emit();
      assign(solverPool[data.workerIndex]);
      if (next >= prefixes.length && outstanding === 0) {
        settled = true;
        cleanup();
        resolve(null);
      }
    }

    const listeners = solverPool.map((entry) => {
      const listener = (event) => onMessage(event);
      entry.worker.addEventListener('message', listener);
      return listener;
    });

    emit();
    solverPool.forEach((entry) => assign(entry));
    if (outstanding === 0) { settled = true; cleanup(); resolve(null); }
  });
}

function setSolverStatus(text, statusClass) {
  dom.solverStatus.textContent = text;
  dom.solverStatus.className = `status-pill ${statusClass}`;
}

function renderSolution() {
  dom.solveComplete.classList.remove('show');
  dom.solveComplete.classList.add('hidden');
  const solved = state.solution.length === 0;
  dom.solvedMessage.classList.toggle('hidden', !solved);
  dom.solutionPlayer.classList.toggle('hidden', solved);
  dom.moveCounter.textContent = solved ? '0 moves' : `${state.solution.length} move${state.solution.length === 1 ? '' : 's'}`;
  const meta = state.solutionMeta;
  if (meta && Number.isFinite(meta.nodes) && meta.nodes > 0) {
    const duration = formatDuration(meta.elapsedMs || 0);
    const coreText = meta.cores && meta.cores > 1 ? ` across ${meta.cores} cores` : '';
    dom.optimalProof.textContent = `Provably optimal · ${formatInteger(meta.nodes)} positions checked${coreText} in ${duration} to rule out every shorter sequence`;
  } else {
    dom.optimalProof.textContent = 'Provably optimal in the half-turn metric.';
  }
  dom.algorithmText.innerHTML = '';

  state.solution.forEach((token, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'alg-token';
    button.textContent = token;
    button.addEventListener('click', () => setSolutionStep(index));
    dom.algorithmText.appendChild(button);
  });

  view3d.baseCube = state.solvedCube || null;
  view3d.index = 0;
  if (view3d.baseCube) {
    setCube3DApplied(0);
    sizeCube3D();
  }
  if (!solved) updateStepDescriptor(0);
}

function buildCube3D() {
  dom.cube3d.innerHTML = '';
  view3d.cubies = [];
  const faces = ['U', 'D', 'F', 'B', 'R', 'L'];
  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        if (x === 0 && y === 0 && z === 0) continue;
        const cubie = document.createElement('div');
        cubie.className = 'cubie';
        const core = document.createElement('div');
        core.className = 'cubie-core';
        cubie.appendChild(core);
        const faceEls = {};
        faces.forEach((face) => {
          const onFace =
            (face === 'U' && y === 1) || (face === 'D' && y === -1) ||
            (face === 'F' && z === 1) || (face === 'B' && z === -1) ||
            (face === 'R' && x === 1) || (face === 'L' && x === -1);
          if (!onFace) return;
          const facelet = document.createElement('span');
          facelet.className = 'facelet';
          facelet.dataset.face = face;
          faceEls[face] = facelet;
          cubie.appendChild(facelet);
        });
        view3d.cubies.push({ el: cubie, core, x, y, z, faces: faceEls });
        dom.cube3d.appendChild(cubie);
      }
    }
  }
  sizeCube3D();
  applyView3D();
}

function sizeCube3D() {
  // The rotated cube projects a footprint roughly 1.5x its edge, so size it
  // from the smaller viewport dimension divided by that factor to avoid
  // clipping against the card on narrow screens.
  const vpW = dom.cubeViewport?.clientWidth || 320;
  const vpH = dom.cubeViewport?.clientHeight || 320;
  const avail = Math.min(vpW, vpH || vpW);
  const cubeSize = Math.max(140, Math.min(280, avail / 1.5));
  const cubie = cubeSize / 3;
  const half = cubie / 2;
  dom.cube3d.style.setProperty('--cube-size', `${cubeSize}px`);
  dom.cube3d.style.setProperty('--cubie', `${cubie}px`);
  view3d.cubies.forEach((cubie3d) => {
    cubie3d.core.style.transform = 'translateZ(0)';
    Object.entries(cubie3d.faces).forEach(([face, el]) => {
      el.style.transform = `${CUBIE_FACE_TRANSFORM[face]} translateZ(${half}px)`.trim();
    });
    homeTransform(cubie3d);
  });
}

function homeTransform(cubie3d) {
  const gap = parseFloat(getComputedStyle(dom.cube3d).getPropertyValue('--cubie')) || 66;
  const tx = cubie3d.x * gap;
  const ty = -cubie3d.y * gap;
  const tz = cubie3d.z * gap;
  cubie3d.el.style.transform = `translate3d(${tx}px, ${ty}px, ${tz}px)`;
  cubie3d.homePos = `translate3d(${tx}px, ${ty}px, ${tz}px)`;
}

function applyView3D() {
  dom.cube3d.style.transform = `rotateX(${view3d.rotX}deg) rotateY(${view3d.rotY}deg)`;
}

function paintCube3D(cube) {
  if (!cube || !view3d.cubies.length) return;
  const facelets = cube.asString();
  view3d.cubies.forEach((cubie3d) => {
    Object.entries(cubie3d.faces).forEach(([face, el]) => {
      const idx = faceletIndexFor(face, cubie3d.x, cubie3d.y, cubie3d.z);
      const letter = facelets[idx];
      el.style.background = displayColor(letter);
    });
  });
}

// Update only the text/controls of the move player, without touching the cube.
function updateStepDescriptor(index) {
  if (!state.solution.length) return;
  state.solutionIndex = Math.max(0, Math.min(state.solution.length - 1, index));
  const token = state.solution[state.solutionIndex];
  const face = token[0];
  const suffix = token.slice(1);
  dom.movePosition.textContent = `Move ${state.solutionIndex + 1} of ${state.solution.length}`;
  dom.moveNotation.textContent = token;
  dom.moveInstruction.textContent = moveInstruction(face, suffix);
  dom.previousMoveButton.disabled = state.solutionIndex === 0;
  dom.nextMoveButton.textContent = state.solutionIndex === state.solution.length - 1 ? 'Finish' : 'Next move';
  document.querySelectorAll('.alg-token').forEach((element, tokenIndex) => element.classList.toggle('current', tokenIndex === state.solutionIndex));
}

// Jump to a step: update the descriptor and rebuild the cube instantly to the
// state before the described move.
function setSolutionStep(index) {
  if (!state.solution.length) return;
  updateStepDescriptor(index);
  setCube3DApplied(state.solutionIndex);
}

function nextSolutionStep() {
  if (!state.solution.length || view3d.animating) return;
  const i = state.solutionIndex;
  const isLast = i >= state.solution.length - 1;
  // Already fully applied (last move performed): don't re-apply, just celebrate.
  if (isLast && view3d.index >= state.solution.length) {
    showSolveComplete();
    return;
  }
  // Commit the described move with an animated turn, then advance the label.
  animateMove3D(state.solution[i], () => {
    if (isLast) showSolveComplete();
  });
  if (!isLast) updateStepDescriptor(i + 1);
}

// Prominent end-of-playback celebration (replaces the barely-visible toast).
function showSolveComplete() {
  const n = state.solution.length;
  const optimal = state.solutionMeta && Number.isFinite(state.solutionMeta.optimalLength)
    ? state.solutionMeta.optimalLength : n;
  dom.solveCompleteSummary.textContent =
    `All ${n} move${n === 1 ? '' : 's'} done — your cube is solved in ${optimal}, the fewest turns physically possible.`;
  const confetti = dom.solveComplete.querySelector('.confetti');
  if (confetti && !prefersReducedMotion()) {
    confetti.innerHTML = '';
    const colors = ['#55d89a', '#14b8a6', '#0e9ad2', '#ffcb68', '#ff6b8a', '#ffffff'];
    for (let i = 0; i < 16; i++) {
      const piece = document.createElement('i');
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.25}s`;
      piece.style.animationDuration = `${0.9 + Math.random() * 0.6}s`;
      confetti.appendChild(piece);
    }
  }
  dom.solveComplete.classList.remove('hidden');
  requestAnimationFrame(() => dom.solveComplete.classList.add('show'));
  if (navigator.vibrate) {
    try { navigator.vibrate([14, 40, 14, 40, 28]); } catch { /* haptics unsupported */ }
  }
}

function hideSolveComplete() {
  dom.solveComplete.classList.remove('show');
  setTimeout(() => dom.solveComplete.classList.add('hidden'), 260);
}

function moveInstruction(face, suffix) {
  const name = FACE_META[face].name;
  if (suffix === '2') return `Turn the ${name} face 180 degrees`;
  if (suffix === "'") return `Turn the ${name} face counterclockwise`;
  return `Turn the ${name} face clockwise`;
}

// Rebuild the cube to `count` applied moves, cancelling any running animation.
function setCube3DApplied(count) {
  if (!view3d.baseCube) return;
  clearTimeout(view3d.animTimer);
  view3d.animating = false;
  const cube = view3d.baseCube.clone();
  const moves = state.solution.slice(0, count).join(' ');
  if (moves) cube.move(moves);
  view3d.displayCube = cube;
  view3d.index = count;
  view3d.cubies.forEach((cubie3d) => {
    cubie3d.el.classList.remove('turning');
    cubie3d.el.style.transitionDuration = '';
    homeTransform(cubie3d);
  });
  paintCube3D(cube);
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function turnParams(token) {
  const geo = MOVE_GEOMETRY[token[0]];
  if (!geo) return null;
  const suffix = token.slice(1);
  const quarter = suffix === '2' ? 2 : 1;
  const dir = suffix === "'" ? -1 : 1;
  return {
    geo,
    quarter,
    angle: geo.sign * dir * 90 * quarter,
    duration: quarter === 2 ? 460 : 340,
    layer: view3d.cubies.filter((c) => c[geo.coord] === geo.layer),
  };
}

// Rotate a layer to `angleDeg` about its axis. The starting transform is first
// pinned to `rotateAxis(0deg) translate3d(...)` — matching the target's
// two-function list — with the transition suppressed, then a forced reflow
// commits it before we animate. This makes CSS interpolate the rotation function
// directly instead of decomposing the whole matrix, which is what made 180°
// (double) turns collapse the layer through the cube centre.
function startLayerTurn(params, angleDeg) {
  params.layer.forEach((c) => {
    c.el.style.transitionDuration = '0ms';
    c.el.classList.add('turning');
    c.el.style.transform = `rotate${params.geo.axis}(0deg) ${c.homePos}`;
  });
  // Force a reflow so the pinned 0deg start state is committed before animating.
  void dom.cube3d.offsetWidth;
  params.layer.forEach((c) => {
    c.el.style.transitionDuration = `${params.duration}ms`;
    c.el.style.transform = `rotate${params.geo.axis}(${angleDeg}deg) ${c.homePos}`;
  });
}

// Animate a move and bake it into the displayed cube state.
function animateMove3D(token, done) {
  const params = view3d.displayCube ? turnParams(token) : null;
  if (!params) { if (done) done(); return; }
  const commit = () => {
    const cube = view3d.displayCube.clone();
    cube.move(token);
    view3d.displayCube = cube;
    view3d.index += 1;
    params.layer.forEach((c) => { c.el.classList.remove('turning'); c.el.style.transitionDuration = ''; homeTransform(c); });
    paintCube3D(cube);
    view3d.animating = false;
    if (done) done();
  };
  if (prefersReducedMotion()) { commit(); return; }
  view3d.animating = true;
  startLayerTurn(params, params.angle);
  clearTimeout(view3d.animTimer);
  view3d.animTimer = setTimeout(commit, params.duration + 40);
}

// Preview a move by turning the layer and returning it, without committing.
function previewTurn3D(token) {
  if (view3d.animating || !view3d.displayCube) return;
  const params = turnParams(token);
  if (!params) return;
  if (prefersReducedMotion()) return;
  view3d.animating = true;
  startLayerTurn(params, params.angle);
  clearTimeout(view3d.animTimer);
  view3d.animTimer = setTimeout(() => {
    params.layer.forEach((c) => { c.el.style.transform = `rotate${params.geo.axis}(0deg) ${c.homePos}`; });
    clearTimeout(view3d.animTimer);
    view3d.animTimer = setTimeout(() => {
      params.layer.forEach((c) => { c.el.classList.remove('turning'); c.el.style.transitionDuration = ''; homeTransform(c); });
      view3d.animating = false;
    }, params.duration + 40);
  }, params.duration + 40);
}

// Drag the cube to rotate the camera view.
function initCubeDrag() {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const onDown = (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    dom.cubeViewport.setPointerCapture?.(event.pointerId);
  };
  const onMove = (event) => {
    if (!dragging) return;
    view3d.rotY += (event.clientX - lastX) * 0.55;
    view3d.rotX -= (event.clientY - lastY) * 0.55;
    view3d.rotX = Math.max(-88, Math.min(88, view3d.rotX));
    lastX = event.clientX;
    lastY = event.clientY;
    applyView3D();
  };
  const onUp = (event) => {
    dragging = false;
    dom.cubeViewport.releasePointerCapture?.(event.pointerId);
  };
  dom.cubeViewport.addEventListener('pointerdown', onDown);
  dom.cubeViewport.addEventListener('pointermove', onMove);
  dom.cubeViewport.addEventListener('pointerup', onUp);
  dom.cubeViewport.addEventListener('pointercancel', onUp);
}

function displayColor(face) {
  const sample = state.faces[face]?.samples?.[4];
  return sample ? rgbCss(sample) : FACE_META[face].fallback;
}

function rgbCss({ r, g, b }) { return `rgb(${r}, ${g}, ${b})`; }

function saveState() {
  try {
    const compact = { faces: state.faces };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
    renderHomeState();
  } catch { /* Storage is optional. */ }
}

function loadSavedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved?.faces) return;
    FACE_ORDER.forEach((face) => {
      const value = saved.faces[face];
      if (value?.samples?.length !== 9) return;
      const labelsAreValid = value.labels?.length === 9 && value.labels.every((label) => FACE_ORDER.includes(label));
      state.faces[face] = {
        samples: value.samples,
        labels: labelsAreValid ? value.labels : null,
        confidence: labelsAreValid && value.confidence?.length === 9 ? value.confidence : null,
      };
    });
  } catch { localStorage.removeItem(STORAGE_KEY); }
}

function initInstallHandling() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (standalone) dom.installButton.classList.add('hidden');
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    dom.installButton.classList.remove('hidden');
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    dom.installButton.classList.add('hidden');
    showToast('TWENTY installed.');
  });
  dom.installButton.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      return;
    }
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    showToast(isIOS ? 'In Safari, tap Share, then “Add to Home Screen”.' : 'Use your browser menu and choose “Install app” or “Add to Home screen”.');
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 2800);
}

function formatInteger(value) {
  return new Intl.NumberFormat().format(Math.max(0, Math.round(value || 0)));
}

// Compact form for large, unbounded counters so they never overflow their box
// (e.g. 122000000 -> "122M", 6286068 -> "6.3M"). Below 1000 stays exact.
function formatCompact(value) {
  const n = Math.max(0, Math.round(value || 0));
  if (n < 1000) return String(n);
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

function formatDuration(ms) {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}
