const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const triesLeftNode = document.getElementById("triesLeft");
const madeValueNode = document.getElementById("madeValue");
const startOverlay = document.getElementById("startOverlay");
const messageOverlay = document.getElementById("messageOverlay");
const messageEyebrow = document.getElementById("messageEyebrow");
const messageTitle = document.getElementById("messageTitle");
const messageBody = document.getElementById("messageBody");
const messageButton = document.getElementById("messageButton");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const leadForm = document.getElementById("leadForm");
const formFeedback = document.getElementById("formFeedback");
const restartConfirmOverlay = document.getElementById("restartConfirmOverlay");
const restartConfirmButton = document.getElementById("restartConfirmButton");
const restartCancelButton = document.getElementById("restartCancelButton");
const helpButton = document.getElementById("helpButton");
const helpOverlay = document.getElementById("helpOverlay");
const helpCloseButton = document.getElementById("helpCloseButton");
const auxOverlay = document.getElementById("auxOverlay");
const auxOverlayTitle = document.getElementById("auxOverlayTitle");
const auxOverlayContent = document.getElementById("auxOverlayContent");
const auxCloseButton = document.getElementById("auxCloseButton");
const auxPageButtons = Array.from(document.querySelectorAll("[data-aux-page]"));
const replayButton = document.getElementById("replayButton");
const assistToggleButton = document.getElementById("assistToggleButton");
const assistInfoOverlay = document.getElementById("assistInfoOverlay");
const assistInfoCloseButton = document.getElementById("assistInfoCloseButton");

/* ─── Image assets ─── */
let assetsLoaded = 0;
const BALL_SPIN_FRAME_COUNT = 8;
const BIRD_FRAME_COUNT = 8;
const NET_FRAME_ASSETS = [
  { key: "idle", src: "./assets/net-state-01-idle.png" },
  { key: "preopen", src: "./assets/net-state-02-preopen.png" },
  { key: "catch", src: "./assets/net-state-03-catch.png" },
  { key: "drop", src: "./assets/net-state-04-drop.png" },
  { key: "stretch", src: "./assets/net-state-05-stretch.png" },
  { key: "swayLeft", src: "./assets/net-state-06-sway-left.png" },
  { key: "swayRight", src: "./assets/net-state-07-sway-right.png" },
  { key: "recoil", src: "./assets/net-state-08-recoil.png" },
];
const TOTAL_ASSETS = 1 + 1 + BALL_SPIN_FRAME_COUNT + NET_FRAME_ASSETS.length + 1 + BIRD_FRAME_COUNT;

function onAssetLoad() {
  assetsLoaded++;
  if (assetsLoaded >= TOTAL_ASSETS) {
    setupCanvas();
    resetBall();
    resetBird(true);
    updateHud();
    render();
  }
}

const bgImage = new Image();
bgImage.onload = onAssetLoad;
bgImage.src = "./assets/bg.png";

const ballImage = new Image();
ballImage.onload = onAssetLoad;
ballImage.src = "./assets/ball.png";

const ballSpinFrames = Array.from({ length: BALL_SPIN_FRAME_COUNT }, (_, index) => {
  const image = new Image();
  image.onload = onAssetLoad;
  image.src = `./assets/ball-spin-${index + 1}.png`;
  return image;
});

const netFrames = NET_FRAME_ASSETS.map(({ src }) => {
  const image = new Image();
  image.onload = onAssetLoad;
  image.src = src;
  return image;
});

const frontHoopImage = new Image();
let frontHoopReady = false;
frontHoopImage.onload = () => {
  frontHoopReady = true;
  onAssetLoad();
};
frontHoopImage.src = "./assets/front-hoop.png";

const birdFrames = Array.from({ length: BIRD_FRAME_COUNT }, (_, index) => {
  const image = new Image();
  image.onload = onAssetLoad;
  image.src = `./assets/bird-smooth-${index + 1}.png`;
  return image;
});

const TEST_MODE = false;
const SLOW_MO = 1.0;
const DEBUG_ENABLED = false;

/* ─── Debug panel ─── */
const debugPanel = document.getElementById("debugPanel");
const debugStateNode = document.getElementById("debugState");
const debugLogNode = document.getElementById("debugLog");
const debugFileLogNode = document.getElementById("debugFileLog");
const debugClearBtn = document.getElementById("debugClear");
const debugCopyBtn = document.getElementById("debugCopy");
const debugDownloadBtn = document.getElementById("debugDownload");
const debugToggleBtn = document.getElementById("debugToggle");

const debug = {
  entries: [],
  fileLog: [],
  markers: [],
  latestHit: null,
  max: 120,
  markerMax: 28,
  markerTtlMs: 2800,
  log(msg, level = "info") {
    const t = (performance.now() / 1000).toFixed(2);
    this.entries.push({ t, msg, level });
    this.fileLog.push(`[${t}] [${level.toUpperCase()}] ${msg}`);
    if (this.entries.length > this.max) this.entries.shift();
    this.renderLog();
    this.renderFileLog();
  },
  renderLog() {
    if (!debugLogNode) return;
    const cls = { info: "entry", warn: "entry warn", err: "entry err", evt: "entry evt" };
    debugLogNode.innerHTML = this.entries
      .map(e => `<div class="${cls[e.level] || "entry"}">[${e.t}] ${e.msg}</div>`)
      .join("");
    debugLogNode.scrollTop = debugLogNode.scrollHeight;
  },
  clear() {
    this.entries = [];
    this.fileLog = [];
    this.markers = [];
    this.latestHit = null;
    this.renderLog();
    this.renderFileLog();
    this.renderState();
  },
  renderFileLog() {
    const text = this.fileLog.join("\n");
    if (debugFileLogNode) {
      debugFileLogNode.value = text;
      debugFileLogNode.scrollTop = debugFileLogNode.scrollHeight;
    }
    window.__hoopRushDebugLog = text;
    window.__hoopRushDebugEntries = [...this.fileLog];
  },
  download() {
    const blob = new Blob([this.fileLog.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hoop-rush-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
  async copy() {
    const text = this.fileLog.join("\n");
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    if (debugFileLogNode) {
      debugFileLogNode.focus();
      debugFileLogNode.select();
      document.execCommand("copy");
    }
  },
  recordMarker({ x, y, type, label, color, detail = "" }) {
    if (!DEBUG_ENABLED) return;
    const createdAt = performance.now();
    const marker = { x, y, type, label, color, detail, createdAt };
    this.markers.push(marker);
    if (this.markers.length > this.markerMax) this.markers.shift();
    this.latestHit = marker;
  },
  pruneMarkers(now = performance.now()) {
    const cutoff = now - this.markerTtlMs;
    this.markers = this.markers.filter((marker) => marker.createdAt >= cutoff);
  },
  renderState() {
    if (!debugStateNode) return;
    const s = state;
    const b = ball;
    const lastHit = this.latestHit
      ? `${this.latestHit.type}@${this.latestHit.x.toFixed(1)},${this.latestHit.y.toFixed(1)}`
      : "-";
    debugStateNode.textContent =
      `started=${s.started} finished=${s.finished} assist=${s.assistMode}
attempts=${s.attemptsUsed}/${MAX_ATTEMPTS} made=${s.shotsMade}/${WIN_THRESHOLD} score=${s.score}
dragging=${s.dragging} awaitMsg=${s.awaitingMessage}
ball.active=${b.active} scored=${b.scored} hoop=${b.hoopState}
ball.x=${b.x.toFixed(1)} y=${b.y.toFixed(1)} z=${b.z.toFixed(1)}
ball.vx=${b.vx.toFixed(2)} vy=${b.vy.toFixed(2)} flight=${b.flightTime || 0} frontGrace=${b.frontRimGraceUsed}
logLines=${this.fileLog.length} markers=${this.markers.length} lastHit=${lastHit}`;
  },
};

if (!DEBUG_ENABLED && debugPanel) {
  debugPanel.hidden = true;
  debugPanel.style.display = "none";
}

if (DEBUG_ENABLED && debugClearBtn) {
  debugClearBtn.addEventListener("click", () => debug.clear());
}
if (DEBUG_ENABLED && debugCopyBtn) {
  debugCopyBtn.addEventListener("click", async () => {
    try {
      await debug.copy();
      debug.log("copied full debug log to clipboard", "evt");
    } catch (error) {
      debug.log(`copy-log failed: ${error.message}`, "err");
    }
  });
}
if (DEBUG_ENABLED && debugDownloadBtn) {
  debugDownloadBtn.addEventListener("click", () => debug.download());
}
if (DEBUG_ENABLED && debugToggleBtn) {
  debugToggleBtn.addEventListener("click", () => {
    debugPanel.classList.toggle("collapsed");
    debugToggleBtn.textContent = debugPanel.classList.contains("collapsed") ? "Show" : "Hide";
  });
}
if (DEBUG_ENABLED) {
  window.__hoopRushDebug = debug;
  window.addEventListener("keydown", (e) => {
    if (e.key === "d" || e.key === "D") {
      debugPanel.classList.toggle("collapsed");
      if (debugToggleBtn) debugToggleBtn.textContent = debugPanel.classList.contains("collapsed") ? "Show" : "Hide";
    }
    if (e.key === "l" || e.key === "L") {
      debug.download();
    }
  });
  debug.renderLog();
  debug.renderFileLog();
  debug.log("boot", "evt");
}

/* ─── Constants ─── */
const DPR = Math.max(window.devicePixelRatio || 1, 1);
const GAME_WIDTH = 420;
const GAME_HEIGHT = 760;
const GRAVITY = 0.38;
const BASE_RESET_DELAY = 900;
const SCORE_VALUE = 100;
const MAX_ATTEMPTS = 5;
const WIN_THRESHOLD = 3;

const AUX_PAGES = {
  terms: {
    title: "Όροι χρήσης",
    body: `
      <h3>Χρήση της εμπειρίας</h3>
      <p>Το Hoop Rush είναι μια διαδραστική προωθητική εμπειρία του ΦΥΣΙΚΟ&nbsp;ΑΕΡΙΟ. Η χρήση της εφαρμογής προϋποθέτει αποδοχή των όρων που διέπουν τη συμμετοχή και την ορθή χρήση της.</p>
      <ul>
        <li>Η συμμετοχή ολοκληρώνεται μόνο μετά την επιτυχή υποβολή της φόρμας.</li>
        <li>Κάθε συμμετέχων χρησιμοποιεί τα πραγματικά του στοιχεία.</li>
        <li>Οι διοργανωτές μπορούν να ακυρώσουν συμμετοχές που εμφανίζουν ελλιπή ή ανακριβή στοιχεία.</li>
      </ul>
    `,
  },
  contest: {
    title: "Πληροφορίες διαγωνισμού",
    body: `
      <h3>Πώς λειτουργεί η κλήρωση</h3>
      <p>Για να λάβεις μέρος, χρειάζεται να πετύχεις το απαιτούμενο σκορ μέσα στο παιχνίδι και στη συνέχεια να καταχωρήσεις τα στοιχεία σου στη σχετική φόρμα συμμετοχής.</p>
      <ul>
        <li>Η πρόσβαση στη φόρμα συμμετοχής ξεκλειδώνει μετά την επιτυχή ολοκλήρωση του challenge.</li>
        <li>Η κλήρωση πραγματοποιείται ανάμεσα στις έγκυρες συμμετοχές που έχουν καταχωρηθεί σωστά.</li>
        <li>Για αναλυτικούς όρους, υπερισχύει το επίσημο κείμενο του διαγωνισμού της ενέργειας.</li>
      </ul>
    `,
  },
  privacy: {
    title: "Προσωπικά δεδομένα",
    body: `
      <h3>Επεξεργασία στοιχείων</h3>
      <p>Τα στοιχεία που υποβάλλονται μέσω της φόρμας χρησιμοποιούνται αποκλειστικά για τους σκοπούς διαχείρισης της συμμετοχής σου, της επικοινωνίας με τους νικητές και της υποστήριξης της συγκεκριμένης προωθητικής ενέργειας.</p>
      <ul>
        <li>Συλλέγονται μόνο τα απολύτως απαραίτητα στοιχεία επικοινωνίας.</li>
        <li>Η επεξεργασία γίνεται σύμφωνα με την ισχύουσα νομοθεσία περί προστασίας προσωπικών δεδομένων.</li>
        <li>Μπορείς να ζητήσεις ενημέρωση σχετικά με την επεξεργασία των στοιχείων σου από τους διοργανωτές της ενέργειας.</li>
      </ul>
    `,
  },
};

/* ─── State ─── */
let state = {
  started: false,
  finished: false,
  attemptsUsed: 0,
  score: 0,
  shotsMade: 0,
  dragging: false,
  pointerStart: null,
  pointerCurrent: null,
  scoreMessage: null,
  animationFrame: null,
  justScored: false,
  assistMode: false,
  awaitingMessage: false,
};

/* ─── UI References ─── */
const assistTooltip = document.getElementById("assistTooltip");

/*
 * Hoop collision coordinates — aligned to where the rim sits in bg.png.
 * bg.png is 1536x2752, mapped onto 420x760 game space.
 * Rim in bg.png is at roughly x=768 y=910 (image pixels),
 * which maps to: x=210 y=251 in game coords.
 */
const hoop = {
  centerX: GAME_WIDTH * 0.5,
  rimY: 247,
  rimRadius: 38,
  netHeight: 55,
  backboardWidth: 150,
};

const BALL_DISPLAY_RADIUS = 36;
const BALL_REST_Y = GAME_HEIGHT - 270; // 490 — raised higher for mobile viewport
const DEPTH_ANCHOR_Y = GAME_HEIGHT - 220; // 540 — original depth reference for z/scale calc
const BALL_REST_SCALE = 1.25;          // Visual scale boost at rest/drag (pre-launch only)
const BIRD_ASPECT_RATIO = 258 / 230;
const BIRD_FRAME_SEQUENCE = [0, 1, 2, 3, 4, 5, 6, 7];
const BIRD_FLIGHT_BAND = {
  minY: 44,
  maxY: 92,
  minWidth: 30,
  maxWidth: 48,
  minSpeed: 0.22,
  maxSpeed: 0.42,
  minBobAmplitude: 0.15,
  maxBobAmplitude: 0.7,
  bobSpeed: 0.012,
  frameInterval: 10,
};

const ball = {
  radius: 32,
  x: GAME_WIDTH * 0.5,
  y: BALL_REST_Y,
  prevX: GAME_WIDTH * 0.5,
  prevY: BALL_REST_Y,
  vx: 0,
  vy: 0,
  spin: 0,
  angle: 0,
  active: false,
  trail: [],
  scored: false,
  hoopState: "outside",
  frontRimGraceUsed: false,
  z: 0,
  opacity: 1.0,
  settledTime: null,
};

const NET_FRAME_INDEX = {
  idle: 0,
  preopen: 1,
  catch: 2,
  drop: 3,
  stretch: 4,
  swayLeft: 5,
  swayRight: 6,
  recoil: 7,
};

const netAnimation = {
  energy: 0,
  frameIndex: NET_FRAME_INDEX.idle,
  lastDirection: 1,
};

let particles = [];

const bird = {
  x: GAME_WIDTH + 80,
  y: 72,
  baseY: 72,
  width: 40,
  height: 40 * BIRD_ASPECT_RATIO,
  speed: 0.32,
  direction: -1,
  bobPhase: 0,
  bobSpeed: BIRD_FLIGHT_BAND.bobSpeed,
  bobAmplitude: 1.4,
  frameIndex: 0,
  frameSequenceIndex: 0,
  frameTick: 0,
  frameInterval: BIRD_FLIGHT_BAND.frameInterval,
};

function resetBird(initialSpawn = false) {
  bird.direction = Math.random() > 0.5 ? 1 : -1;
  bird.width =
    BIRD_FLIGHT_BAND.minWidth +
    Math.random() * (BIRD_FLIGHT_BAND.maxWidth - BIRD_FLIGHT_BAND.minWidth);
  bird.height = bird.width * BIRD_ASPECT_RATIO;
  bird.baseY =
    BIRD_FLIGHT_BAND.minY +
    Math.random() * (BIRD_FLIGHT_BAND.maxY - BIRD_FLIGHT_BAND.minY);
  bird.y = bird.baseY;
  bird.speed =
    BIRD_FLIGHT_BAND.minSpeed +
    Math.random() * (BIRD_FLIGHT_BAND.maxSpeed - BIRD_FLIGHT_BAND.minSpeed);
  bird.bobPhase = Math.random() * Math.PI * 2;
  bird.bobAmplitude =
    BIRD_FLIGHT_BAND.minBobAmplitude +
    Math.random() * (BIRD_FLIGHT_BAND.maxBobAmplitude - BIRD_FLIGHT_BAND.minBobAmplitude);
  bird.bobSpeed = BIRD_FLIGHT_BAND.bobSpeed * (0.9 + Math.random() * 0.25);
  bird.frameInterval = BIRD_FLIGHT_BAND.frameInterval + Math.floor(Math.random() * 2);
  bird.frameSequenceIndex = Math.floor(Math.random() * BIRD_FRAME_SEQUENCE.length);
  bird.frameIndex = BIRD_FRAME_SEQUENCE[bird.frameSequenceIndex];
  bird.frameTick = 0;

  const spawnPadding = initialSpawn ? 120 : 180 + Math.random() * 220;
  bird.x =
    bird.direction === -1
      ? GAME_WIDTH + bird.width + spawnPadding
      : -bird.width - spawnPadding;
}

function updateBird() {
  bird.frameTick += 1;
  if (bird.frameTick >= bird.frameInterval) {
    bird.frameTick = 0;
    bird.frameSequenceIndex = (bird.frameSequenceIndex + 1) % BIRD_FRAME_SEQUENCE.length;
    bird.frameIndex = BIRD_FRAME_SEQUENCE[bird.frameSequenceIndex];
  }

  bird.bobPhase += bird.bobSpeed;
  bird.x += bird.speed * bird.direction;
  bird.y = bird.baseY + Math.sin(bird.bobPhase) * bird.bobAmplitude;

  const outOfView =
    bird.direction === -1
      ? bird.x < -bird.width - 120
      : bird.x > GAME_WIDTH + bird.width + 120;
  if (outOfView) {
    resetBird();
  }
}

/* ─── Canvas setup ─── */
function setupCanvas() {
  canvas.width = GAME_WIDTH * DPR;
  canvas.height = GAME_HEIGHT * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

/* ─── HUD ─── */
function updateHud() {
  triesLeftNode.textContent = `${Math.max(MAX_ATTEMPTS - state.attemptsUsed, 0)}/${MAX_ATTEMPTS}`;
  madeValueNode.textContent = `${state.shotsMade}/${WIN_THRESHOLD}`;

  // If assist is off and user is struggling (missed > 1 shots), show tooltip
  const missedCount = state.attemptsUsed - state.shotsMade;
  if (!state.assistMode && missedCount >= 2) {
    if (assistTooltip) assistTooltip.classList.remove("hidden");
  } else {
    if (assistTooltip) assistTooltip.classList.add("hidden");
  }
}

/* ─── Overlays ─── */
function showOverlay({ eyebrow, title, body, buttonLabel, showReplay = false }) {
  messageEyebrow.textContent = eyebrow;
  messageTitle.textContent = title;
  messageBody.textContent = body;
  messageButton.textContent = buttonLabel;
  if (showReplay) {
    replayButton.classList.remove("hidden");
  } else {
    replayButton.classList.add("hidden");
  }
  messageOverlay.classList.add("visible");
  state.awaitingMessage = true;
}

function hideOverlay(overlay) {
  overlay.classList.remove("visible");
}

function openAuxPage(pageKey) {
  const page = AUX_PAGES[pageKey];
  if (!page) return;
  auxOverlayTitle.textContent = page.title;
  auxOverlayContent.innerHTML = page.body;
  auxOverlay.classList.add("visible");
}

/* ─── Ball / Game reset ─── */
function resetBall() {
  ball.x = GAME_WIDTH * 0.5;
  ball.y = BALL_REST_Y;
  ball.prevX = ball.x;
  ball.prevY = ball.y;
  ball.vx = 0;
  ball.vy = 0;
  ball.spin = 0;
  ball.angle = 0;
  ball.active = false;
  ball.scored = false;
  ball.trail = [];
  ball.hoopState = "outside";
  ball.frontRimGraceUsed = false;
  ball.flightTime = 0;
  ball.z = 0;
  ball.validEntry = false;
  ball.groundBounced = false;
  ball.opacity = 1.0;
  ball.settledTime = null;
  ball.disappearPoofDone = false;
  ball.reappearPoofDone = false;
  state.justScored = false;
  state.dragging = false;
  state.pointerStart = null;
  state.pointerCurrent = null;
  resetNetAnimation();
}

function resetGame() {
  state.started = false;
  state.finished = false;
  state.attemptsUsed = 0;
  state.score = 0;
  state.shotsMade = 0;
  state.dragging = false;
  state.pointerStart = null;
  state.pointerCurrent = null;
  state.justScored = false;
  state.assistMode = false; 
  state.awaitingMessage = false;
  hideOverlay(messageOverlay);
  startOverlay.classList.add("visible");
  leadForm.classList.add("hidden");
  leadForm.reset();
  formFeedback.textContent = "";
  resetBall();
  updateHud();
  updateAssistButton();
  if (assistTooltip) assistTooltip.classList.add("hidden");
}

function beginGame() {
  state.started = true;
  state.finished = false;
  state.attemptsUsed = 0;
  state.score = 0;
  state.shotsMade = 0;
  state.assistMode = false;
  startOverlay.classList.remove("visible");
  hideOverlay(messageOverlay);
  leadForm.classList.add("hidden");
  state.awaitingMessage = false;
  resetBall();
  updateHud();
  updateAssistButton();
  if (assistTooltip) assistTooltip.classList.add("hidden");
  debug.log("beginGame", "evt");
}

/* ─── Pointer helpers ─── */
function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = GAME_WIDTH / rect.width;
  const scaleY = GAME_HEIGHT / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function isPointerOnBall(position) {
  return Math.hypot(position.x - ball.x, position.y - ball.y) <= BALL_DISPLAY_RADIUS + 20;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const size = clean.length === 3 ? 1 : 2;
  const channels = [];
  for (let i = 0; i < 3; i++) {
    const part = clean.slice(i * size, i * size + size);
    const value = parseInt(size === 1 ? `${part}${part}` : part, 16);
    channels.push(Number.isNaN(value) ? 255 : value);
  }
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
}

function getLaunchProfile(assistMode = state.assistMode) {
  if (assistMode) {
    return {
      assistFactor: 1.15,
      horizontalScale: 0.02,
      verticalScale: 0.07,
      verticalBase: 5.5,
      spinScale: 0.008,
    };
  }

  // Manual shots need a slightly flatter release curve. Without the assist
  // steering, the original launch envelope overpowered straight swipes and
  // drove them into the front rim too often before they could descend cleanly.
  return {
    assistFactor: 1,
    horizontalScale: 0.02,
    verticalScale: 0.063,
    verticalBase: 5.25,
    spinScale: 0.0075,
  };
}

function getLaunchVector(dx, dy, assistMode = state.assistMode) {
  const upwardPull = clamp(-dy, 20, 260);
  const profile = getLaunchProfile(assistMode);
  return {
    upwardPull,
    vx: clamp((dx * profile.horizontalScale) * profile.assistFactor, -1.8, 1.8),
    vy: clamp((-upwardPull * profile.verticalScale) * profile.assistFactor - profile.verticalBase, -18, -12),
    spin: clamp(dx * profile.spinScale, -1.5, 1.5),
  };
}

function getPredictedApexY(y, vy) {
  if (vy >= 0) return y;
  return y - (vy * vy) / (2 * GRAVITY);
}

/* ─── Pointer events ─── */
function handlePointerDown(event) {
  if (!state.started || state.finished || ball.active || state.awaitingMessage || state.justScored) return;
  const position = getPointerPosition(event);
  if (!isPointerOnBall(position)) return;
  state.dragging = true;
  state.pointerStart = position;
  state.pointerCurrent = position;
  debug.log(`pointerDown x=${position.x.toFixed(1)} y=${position.y.toFixed(1)}`, "info");
}

function handlePointerMove(event) {
  if (!state.dragging) return;
  state.pointerCurrent = getPointerPosition(event);
}

function launchBall() {
  if (!state.pointerStart || !state.pointerCurrent) return;
  const dx = state.pointerCurrent.x - state.pointerStart.x;
  const dy = state.pointerCurrent.y - state.pointerStart.y;
  const swipeDistance = Math.hypot(dx, dy);
  const launch = getLaunchVector(dx, dy);
  if (swipeDistance < 12 || launch.upwardPull <= 20) {
    state.dragging = false;
    state.pointerStart = null;
    state.pointerCurrent = null;
    return;
  }
  ball.vx = launch.vx;
  ball.vy = launch.vy;
  ball.spin = launch.spin;
  ball.active = true;
  ball.trail = [];
  state.dragging = false;
  state.pointerStart = null;
  state.pointerCurrent = null;
  state.attemptsUsed += 1;
  updateHud();
  debug.log(`launch vx=${ball.vx.toFixed(2)} vy=${ball.vy.toFixed(2)} dx=${dx.toFixed(0)} dy=${dy.toFixed(0)} attempt=${state.attemptsUsed}`, "evt");
}

function handlePointerUp() {
  if (!state.dragging) return;
  launchBall();
}

/* ─── Game logic ─── */
function setAssistMode() {
  updateHud();
  updateAssistButton();
}

function updateAssistButton() {
  if (!assistToggleButton) return;
  assistToggleButton.setAttribute("aria-pressed", state.assistMode ? "true" : "false");
}

let assistInfoShownThisSession = false;

function toggleAssist() {
  if (assistTooltip) assistTooltip.classList.add("hidden");
  if (!assistInfoShownThisSession) {
    assistInfoShownThisSession = true;
    assistInfoOverlay.classList.add("visible");
  }
  state.assistMode = !state.assistMode;
  updateAssistButton();
  debug.log(`assist ${state.assistMode ? "on" : "off"}`, "evt");
}

function showWinOverlay() {
  state.finished = true;
  debug.log(`WIN made=${state.shotsMade}/${WIN_THRESHOLD}`, "evt");
  showOverlay({
    eyebrow: "Νικητής",
    title: "Τα κατάφερες",
    body: "Συμπλήρωσε τη φόρμα για να διεκδικήσεις το δώρο ΦΥΣΙΚΟ ΑΕΡΙΟ.",
    buttonLabel: "Πάμε στη φόρμα",
    showReplay: true,
  });
}

function showLossOverlay() {
  state.finished = true;
  debug.log(`LOSS made=${state.shotsMade}/${WIN_THRESHOLD}`, "err");
  showOverlay({
    eyebrow: "Τέλος",
    title: "Δεν τα κατάφερες",
    body: `Έβαλες ${state.shotsMade}/${MAX_ATTEMPTS}. Για την κλήρωση χρειάζονται ${WIN_THRESHOLD} καλάθια.`,
    buttonLabel: "Παίξε ξανά",
  });
}

function concludeMiss() {
  debug.log(`MISS attempts=${state.attemptsUsed}/${MAX_ATTEMPTS} made=${state.shotsMade} ballY=${ball.y.toFixed(1)}`, "warn");
  if (TEST_MODE) {
    resetBall();
    return;
  }
  const remaining = MAX_ATTEMPTS - state.attemptsUsed;
  const needed = WIN_THRESHOLD - state.shotsMade;

  if (remaining <= 0) {
    if (state.shotsMade >= WIN_THRESHOLD) {
      showWinOverlay();
    } else {
      showLossOverlay();
    }
    resetBall();
    return;
  }
  setAssistMode();
  showOverlay({
    eyebrow: "Αστοχία",
    title: "Εκτός στόχου",
    body: needed > 0 
      ? `Έμειναν ${remaining} προσπάθειες. Χρειάζονται ${needed} καλάθια ακόμα.`
      : `Έμειναν ${remaining} προσπάθειες. Συνέχισε την προσπάθεια!`,
    buttonLabel: "Πάμε για την επόμενη",
  });
  resetBall();
}

const SCORE_MESSAGES = ["Καλάθι!", "Μπαμ!", "Φοβερό!", "Τέλειο!", "Σωστός!", "Ναι!"];

function registerScore() {
  if (ball.scored) return;
  ball.scored = true;
  ball.hoopState = "scored";
  state.justScored = true;
  state.shotsMade += 1;
  state.score += SCORE_VALUE;
  state.scoreMessage = {
    text: SCORE_MESSAGES[Math.floor(Math.random() * SCORE_MESSAGES.length)],
    startTime: performance.now(),
  };
  updateHud();
  debug.log(`SCORE! made=${state.shotsMade}/${WIN_THRESHOLD} attempts=${state.attemptsUsed}/${MAX_ATTEMPTS}`, "evt");
  if (TEST_MODE) {
    window.setTimeout(resetBall, 420);
    return;
  }
  /* Transition is driven by ball.settledTime (set in physics when ball
     stops bouncing). The arcade poof sequence runs from settle, not from
     score time. A 5s max fallback prevents hanging if settle never fires. */
  const MAX_TRANSITION_MS = 5000;
  const scoreTime = performance.now();

  const checkTransition = () => {
    const now = performance.now();

    if (ball.settledTime) {
      const sincSettle = now - ball.settledTime;

      /* Phase 1 — disappear poof (once, 500ms after settle) */
      if (sincSettle >= 500 && !ball.disappearPoofDone) {
        ball.disappearPoofDone = true;
        spawnPuff(ball.x, ball.y);
        ball.opacity = 0;
      }

      /* Phase 2 — reappear poof + new ball at rest position (once, 900ms after settle) */
      if (sincSettle >= 900 && !ball.reappearPoofDone) {
        ball.reappearPoofDone = true;
        spawnPuff(GAME_WIDTH * 0.5, BALL_REST_Y, 15);
        spawnStars(GAME_WIDTH * 0.5, BALL_REST_Y, 10);
        /* Move ball to rest position and make visible immediately with poof */
        ball.x = GAME_WIDTH * 0.5;
        ball.y = BALL_REST_Y;
        ball.opacity = 1.0;
        ball.hoopState = "outside";
        ball.scored = false;
        ball.trail = [];
        ball.z = 0;
      }

      /* Phase 3 — finalize and show win/loss (1400ms after settle) */
      if (sincSettle >= 1400) {
        finishScoreTransition();
        return;
      }
    }

    /* Fallback cap — force finish if something stalls */
    if (now - scoreTime >= MAX_TRANSITION_MS) {
      finishScoreTransition();
      return;
    }

    requestAnimationFrame(checkTransition);
  };

  const finishScoreTransition = () => {
    const remaining = MAX_ATTEMPTS - state.attemptsUsed;
    if (state.shotsMade >= WIN_THRESHOLD) {
      showWinOverlay();
    } else if (remaining <= 0) {
      showLossOverlay();
    }
    resetBall();
  };

  requestAnimationFrame(checkTransition);
}

/* ─── Physics ─── */
/* Fixed collision radius — decoupled from depth scaling so the ball's
   hitbox stays consistent regardless of arc height (Phase 4a). */
const BALL_COLLISION_RADIUS = BALL_DISPLAY_RADIUS * 0.7;

function updateBallPhysics() {
  if (!ball.active) return;

  ball.flightTime = (ball.flightTime || 0) + 1;

  // Log ball state every 10 frames
  if (ball.flightTime % 10 === 1) {
    debug.log(`frame=${ball.flightTime} x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)} vx=${ball.vx.toFixed(2)} vy=${ball.vy.toFixed(2)} hoop=${ball.hoopState} spin=${ball.spin.toFixed(3)}`, "info");
  }

  if (ball.flightTime > 240) {
    debug.log(`flight-timeout hoop=${ball.hoopState}`, "warn");
    if (ball.hoopState === "entering") {
      registerScore();
    } else {
      ball.active = false;
      window.setTimeout(concludeMiss, BASE_RESET_DELAY);
    }
    return;
  }

  ball.prevX = ball.x;
  ball.prevY = ball.y;

  /* ── Spin / Magnus effect (Phase 3b) ── */
  if (ball.spin) {
    ball.vx += ball.spin * 0.002;
    ball.angle += ball.spin * 0.12;
    ball.spin *= 0.995;
  }

  /* ── Quadratic air drag (Phase 3c) ── */
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > 0.1) {
    const dragCoeff = 0.0008;
    const dragForce = dragCoeff * speed;
    ball.vx -= (ball.vx / speed) * dragForce;
    ball.vy -= (ball.vy / speed) * dragForce;
  }

  /* ── Assist mode steering ── */
  if (state.assistMode) {
    const dxToHoop = hoop.centerX - ball.x;
    const dyToHoop = hoop.rimY - ball.y;
    const distanceToHoop = Math.hypot(dxToHoop, dyToHoop);
    if (distanceToHoop < 600 && ball.y < hoop.rimY + 180) {
      if (ball.y < hoop.rimY || ball.vy > 0) {
        ball.vx += dxToHoop * 0.004;
      }
      const belowRim = ball.y > hoop.rimY;
      const falling = ball.vy > 0;
      if (belowRim || falling) {
        ball.vy += dyToHoop * 0.0015;
      }
    }
    ball.vx *= 0.99;
  }

  /* ── Velocity Verlet integration (Phase 3a) ── */
  ball.x += ball.vx * SLOW_MO;
  ball.y += ball.vy * SLOW_MO + 0.5 * GRAVITY * SLOW_MO * SLOW_MO;
  ball.vy += GRAVITY * SLOW_MO;

  if (ball.active) {
    ball.z = clamp((DEPTH_ANCHOR_Y - ball.y) / 3.93, 0, 110);
  }

  /* ── Trail recording ── */
  const MAX_TRAIL = 16;
  ball.trail.push({ x: ball.x, y: ball.y, scale: getDynamicScale(), angle: ball.angle });
  if (ball.trail.length > MAX_TRAIL) ball.trail.shift();

  /* ── Collision geometry ── */
  const effR = BALL_COLLISION_RADIUS; // Fixed radius (Phase 4a)

  const leftRimX = hoop.centerX - hoop.rimRadius;
  const rightRimX = hoop.centerX + hoop.rimRadius;
  const rimY = hoop.rimY;
  const entryInset = 4;
  const innerLeftRimX = leftRimX + entryInset;
  const innerRightRimX = rightRimX - entryInset;

  /* Fixed capture padding — not depth-dependent (Phase 1d) */
  const capturePadding = BALL_DISPLAY_RADIUS * 0.28;
  const captureLeftX = innerLeftRimX - capturePadding;
  const captureRightX = innerRightRimX + capturePadding;

  /* ── Entry detection: ball descending into mouth ── */
  const descendingIntoMouth =
    ball.vy > 0 &&
    ball.y >= rimY - effR * 0.55 &&
    ball.y <= rimY + hoop.netHeight * 0.24 &&
    ball.x > captureLeftX &&
    ball.x < captureRightX;

  if (ball.hoopState === "outside" && descendingIntoMouth) {
    ball.hoopState = "entering";
    ball.validEntry = true;
    debug.recordMarker({
      x: ball.x,
      y: ball.y,
      type: "entry",
      label: "E",
      color: "#4dd0e1",
      detail: "entering-mouth",
    });
    debug.log(
      `entering-mouth x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)} vy=${ball.vy.toFixed(2)} capture=[${captureLeftX.toFixed(1)},${captureRightX.toFixed(1)}]`,
      "evt"
    );
  }

  /* Committed drop zone — once the ball has validly entered and is falling
     through, rim collisions are suppressed so it can't bounce out (Phase 1b). */
  const committedDrop =
    ball.validEntry &&
    ball.hoopState === "entering" &&
    ball.vy > 0 &&
    ball.y >= rimY - 2 &&
    ball.y <= rimY + hoop.netHeight * 0.65 &&
    ball.x > captureLeftX &&
    ball.x < captureRightX;

  /* ── Rim collision ── */
  function collideRimPoint(px, py) {
    const dx = ball.x - px;
    const dy = ball.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist === 0 || dist >= effR) return false;

    /* Skip collision for committed drops (Phase 1b) */
    if (committedDrop) return false;

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = effR - dist;

    /* Manual mode rim suppression — two cases:
       1. Ball center ABOVE rim plane (any direction): prevents stalling
          on upper rim points after backboard bounce.
       2. Ball RISING with center within one collision radius BELOW rim:
          the ball's hitbox extends ~25px above its center, so at y=259
          it still clips rim points at y=236. Suppress these so the ball
          arcs cleanly over the front rim.
       Once the ball is descending AND its center is at/below rimY,
       normal collisions apply (rim rattles, bouncing, deflects). */
    if (!state.assistMode && (ball.y < hoop.rimY || (ball.vy < 0 && ball.y < hoop.rimY + effR))) {
      return false;
    }

    if (state.assistMode) {
      if (ball.vy < 0 && ball.y < hoop.rimY) return false;
      if (ball.vy < 0 && ball.y > hoop.rimY - 15) {
        ball.vy = Math.min(ball.vy, -0.2);
        ball.vx += (hoop.centerX - ball.x) * 0.08;
        debug.recordMarker({
          x: px,
          y: py,
          type: "rim",
          label: "R↑",
          color: "#ffb74d",
          detail: "assist-rising-nudge",
        });
        debug.log(
          `rim.assist-rising-nudge point=(${px.toFixed(1)},${py.toFixed(1)}) ball=(${ball.x.toFixed(1)},${ball.y.toFixed(1)}) overlap=${overlap.toFixed(2)}`,
          "warn"
        );
        return true;
      }
      if (ball.y <= hoop.rimY + 6) {
        ball.vx += (hoop.centerX - ball.x) * 0.12;
        ball.vy = Math.max(ball.vy, 0.1);
        const prevHoop = ball.hoopState;
        ball.hoopState = "entering";
        ball.validEntry = true;
        debug.recordMarker({
          x: px,
          y: py,
          type: "rim",
          label: "R→E",
          color: "#ab47bc",
          detail: "assist-entering",
        });
        if (prevHoop !== "entering") {
          debug.log(
            `rim.assist→entering point=(${px.toFixed(1)},${py.toFixed(1)}) ball=(${ball.x.toFixed(1)},${ball.y.toFixed(1)}) vx=${ball.vx.toFixed(2)}`,
            "evt"
          );
        }
        return true;
      }
      ball.x += nx * overlap;
      ball.y += ny * overlap;
      ball.vx *= 0.4;
      ball.vy *= 0.3;
      debug.recordMarker({
        x: px,
        y: py,
        type: "rim",
        label: "R↓",
        color: "#ef5350",
        detail: "under-rim-deflect",
      });
      debug.log(
        `rim.under-rim-deflect point=(${px.toFixed(1)},${py.toFixed(1)}) ball=(${ball.x.toFixed(1)},${ball.y.toFixed(1)}) normal=(${nx.toFixed(2)},${ny.toFixed(2)}) overlap=${overlap.toFixed(2)}`,
        "warn"
      );
      return true;
    }

    ball.x += nx * overlap;
    ball.y += ny * overlap;
    const vDotN = ball.vx * nx + ball.vy * ny;
    debug.recordMarker({
      x: px,
      y: py,
      type: "rim",
      label: "R",
      color: "#ff6b6b",
      detail: "rim-hit",
    });
    debug.log(
      `rim.hit point=(${px.toFixed(1)},${py.toFixed(1)}) ball=(${ball.x.toFixed(1)},${ball.y.toFixed(1)}) normal=(${nx.toFixed(2)},${ny.toFixed(2)}) dist=${dist.toFixed(2)} overlap=${overlap.toFixed(2)} vDotN=${vDotN.toFixed(2)} hoop=${ball.hoopState}`,
      "warn"
    );
    if (vDotN < 0) {
      const restitution = 0.22;
      ball.vx = (ball.vx - 2 * vDotN * nx) * restitution;
      ball.vy = (ball.vy - 2 * vDotN * ny) * restitution;
    }
    return true;
  }

  /* Only collide with the upper arc of the rim ellipse. The bottom half
     represents the far side of the rim and should not block a ball
     falling through from above — eliminates phantom deflections (Phase 2c). */
  const p = 0.3;
  const rimPoints = 24;
  let rimHit = false;
  for (let i = 0; i < rimPoints; i++) {
    const angle = (i / rimPoints) * Math.PI * 2;
    const py = hoop.rimY + Math.sin(angle) * hoop.rimRadius * p;
    if (py > rimY + 2) continue; // Skip points below rim plane
    const px = hoop.centerX + Math.cos(angle) * hoop.rimRadius;
    if (collideRimPoint(px, py)) {
      rimHit = true;
      break;
    }
  }

  /* Stalled-on-rim nudge */
  const rimDx = hoop.centerX - ball.x;
  const rimSpeed = Math.hypot(ball.vx, ball.vy);
  const stalledOnRim =
    ball.hoopState === "outside" &&
    rimSpeed < 2.5 &&
    ball.y > rimY - effR &&
    ball.y < rimY + effR * 1.3 &&
    Math.abs(ball.x - hoop.centerX) < hoop.rimRadius + effR * 0.8;

  if (stalledOnRim) {
    const centeredOverMouth = Math.abs(ball.x - hoop.centerX) < hoop.rimRadius * 0.65;
    if (centeredOverMouth) {
      ball.vx += rimDx * 0.005;
      ball.vy = Math.max(ball.vy, 0.1);
    } else {
      ball.vx += ball.x < hoop.centerX ? -0.1 : 0.1;
      ball.vy = Math.max(ball.vy, 0.1);
    }
  }

  /* ── Backboard ── */
  const backboardLeft = hoop.centerX - hoop.backboardWidth * 0.5;
  const backboardRight = hoop.centerX + hoop.backboardWidth * 0.5;
  const backboardTop = rimY - 110;
  const backboardBottom = backboardTop + 18;
  const hitsBackboardX = ball.x + effR > backboardLeft && ball.x - effR < backboardRight;
  const hitsBackboardY = ball.y + effR > backboardTop && ball.y - effR < backboardBottom;

  let backboardHit = false;
  if (hitsBackboardX && hitsBackboardY && ball.vy < 0) {
    const incomingVy = ball.vy;
    const backboardHitX = clamp(ball.x, backboardLeft, backboardRight);
    const backboardHitY = clamp(ball.y - effR, backboardTop, backboardBottom);
    ball.vy = Math.abs(ball.vy) * 0.38;
    ball.vx *= 0.82;
    backboardHit = true;
    debug.recordMarker({
      x: backboardHitX,
      y: backboardHitY,
      type: "backboard",
      label: "B",
      color: "#ffd166",
      detail: "backboard-hit",
    });
    debug.log(
      `backboard.hit contact=(${backboardHitX.toFixed(1)},${backboardHitY.toFixed(1)}) box=[${backboardLeft.toFixed(1)},${backboardTop.toFixed(1)}]-[${backboardRight.toFixed(1)},${backboardBottom.toFixed(1)}] ball=(${ball.x.toFixed(1)},${ball.y.toFixed(1)}) vy=${incomingVy.toFixed(2)}→${ball.vy.toFixed(2)}`,
      "warn"
    );
  }

  /* Post-collision speed cap */
  if (rimHit || backboardHit) {
    const MAX_POST_HIT_SPEED = 8;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > MAX_POST_HIT_SPEED) {
      const k = MAX_POST_HIT_SPEED / sp;
      ball.vx *= k;
      ball.vy *= k;
    }
  }

  /* ── Top-down crossing detection (uses fixed collision radius) ── */
  const ballBottom = ball.y + effR;
  const prevBallBottom = ball.prevY + effR;
  const crossedRimFromAbove =
    prevBallBottom <= rimY &&
    ballBottom > rimY &&
    ball.vy > 0 &&
    ball.x > captureLeftX &&
    ball.x < captureRightX;

  if (ball.hoopState === "outside" && crossedRimFromAbove) {
    ball.hoopState = "entering";
    ball.validEntry = true;
    debug.recordMarker({
      x: ball.x,
      y: rimY,
      type: "cross",
      label: "X",
      color: "#80cbc4",
      detail: "top-down-crossing",
    });
    debug.log(
      `top-down crossing x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)} bottom=${ballBottom.toFixed(1)} prevBottom=${prevBallBottom.toFixed(1)}`,
      "evt"
    );
  }

  /* ── Phase 1a: Centering BEFORE exit check ──
     This prevents the ball from being falsely ejected from "entering"
     state due to a momentary horizontal offset before centering corrects it. */
  if ((ball.hoopState === "entering" || ball.hoopState === "scored") && ball.vy > 0) {
    ball.x += (hoop.centerX - ball.x) * 0.22;
    ball.vx *= 0.55;
    ball.vy = Math.min(ball.vy, 4.5);
  }

  /* ── Phase 1c: Exit check with velocity-reversal guard ──
     Require the ball to clear well above the rim (rimY - 8) before resetting
     to "outside" — a momentary vy flip from a rim rattle should not
     invalidate a legitimate entry. Also check deepInsideNet before
     allowing horizontal exit. */
  if (ball.hoopState === "entering") {
    const deepInsideNet = ball.y >= rimY + hoop.netHeight * 0.12;
    const movedBackAboveRim = ball.vy < 0 && ball.y < rimY - 8;
    const exitedMouthHorizontally = !deepInsideNet && (ball.x <= captureLeftX || ball.x >= captureRightX);
    if (movedBackAboveRim || exitedMouthHorizontally) {
      debug.log(`exit-entering reason=${movedBackAboveRim ? "above-rim" : "horizontal"} x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)} vy=${ball.vy.toFixed(2)}`, "warn");
      ball.hoopState = "outside";
    }
  }

  /* ── Score registration ── */
  if (
    !ball.scored &&
    ball.validEntry &&
    ball.hoopState === "entering" &&
    ball.vy > 0 &&
    ball.y >= rimY + hoop.netHeight * 0.35 &&
    ball.x > captureLeftX &&
    ball.x < captureRightX
  ) {
    debug.recordMarker({
      x: ball.x,
      y: ball.y,
      type: "score",
      label: "S",
      color: "#7cff6b",
      detail: "score-trigger",
    });
    debug.log(
      `score-trigger x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)} scoreDepth=${(rimY + hoop.netHeight * 0.35).toFixed(1)} capture=[${captureLeftX.toFixed(1)},${captureRightX.toFixed(1)}]`,
      "evt"
    );
    registerScore();
  }

  /* ── Scored ball falls behind the hoop with gravity + bounce + roll ── */
  const HOOP_GROUND_Y = 560;
  if (ball.scored) {
    /* Lock to center while falling through the net */
    if (!ball.groundBounced) {
      ball.x = hoop.centerX;
      ball.vx = 0;
    }
    if (ball.y >= HOOP_GROUND_Y) {
      ball.y = HOOP_GROUND_Y;
      if (Math.abs(ball.vy) < 0.5 && Math.abs(ball.vx) < 0.15) {
        if (!ball.settledTime) {
          ball.settledTime = performance.now();
          ball.angle = 0;
          ball.spin = 0;
          debug.log(`ball-settled y=${HOOP_GROUND_Y} x=${ball.x.toFixed(1)} t=${ball.settledTime.toFixed(0)}`, "info");
        }
        ball.vy = 0;
        ball.vx = 0;
        ball.active = false;
      } else if (ball.vy > 0) {
        /* Bounce: kick horizontal velocity on first contact */
        if (!ball.groundBounced) {
          ball.vx = (Math.random() - 0.5) * 2.5;
          ball.groundBounced = true;
        }
        debug.log(`ball-bounce vy=${ball.vy.toFixed(2)}→${(-Math.abs(ball.vy) * 0.45).toFixed(2)} vx=${ball.vx.toFixed(2)}`, "info");
        ball.vy = -Math.abs(ball.vy) * 0.45;
      }
      /* Rolling friction while on ground */
      if (ball.groundBounced) {
        ball.vx *= 0.96;
        ball.angle += ball.vx * 0.06;
      }
    }
  }

  /* ── Early miss detection ── */
  if (ball.active && !ball.scored && ball.vy > 0 && ball.y > rimY + 80) {
    debug.log(`early-miss x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)} hoop=${ball.hoopState}`, "warn");
    ball.active = false;
    window.setTimeout(concludeMiss, 200);
  }

  /* ── Out of bounds ── */
  const outOfBounds = ball.y > GAME_HEIGHT + 80 || ball.x < -80 || ball.x > GAME_WIDTH + 80;
  if (outOfBounds && !ball.scored && ball.active) {
    debug.log(`out-of-bounds x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)}`, "warn");
    ball.active = false;
    window.setTimeout(concludeMiss, 200);
  }
}

/* ─── Particles ─── */
function spawnPuff(x, y, count = 12, color = "rgba(255, 255, 255, 0.7)") {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 2.5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 0.02 + Math.random() * 0.03,
      size: 4 + Math.random() * 12,
      color,
      type: "puff",
    });
  }
}

function spawnStars(x, y, count = 8) {
  const colors = ["#FFD700", "#FF69B4", "#00FF7F", "#00BFFF", "#FF4500"];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.0 + Math.random() * 3.5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 0.015 + Math.random() * 0.02,
      size: 3 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      type: "star",
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.2,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05; // Light gravity
    p.life -= p.decay;
    if (p.type === "star") p.angle += p.spin;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  ctx.save();
  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    if (p.type === "star") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.3, -s * 0.3);
      ctx.lineTo(s, 0);
      ctx.lineTo(s * 0.3, s * 0.3);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.3, s * 0.3);
      ctx.lineTo(-s, 0);
      ctx.lineTo(-s * 0.3, -s * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + (1 - p.life)), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ═══════════════════════════════════════════════
   DRAWING — Image-based rendering
   ═══════════════════════════════════════════════ */

function drawBackground() {
  // Draw bg.png scaled to fill game area
  ctx.drawImage(bgImage, 0, 0, GAME_WIDTH, GAME_HEIGHT);
}

function drawBird() {
  const frame = birdFrames[bird.frameIndex];
  if (!frame || !frame.complete) return;

  ctx.save();
  ctx.translate(bird.x, bird.y);
  if (bird.direction < 0) {
    ctx.scale(-1, 1);
  }
  ctx.globalAlpha = 0.72;
  ctx.drawImage(frame, -bird.width / 2, -bird.height / 2, bird.width, bird.height);
  ctx.restore();
}

function depthScale(z) {
  const t = clamp(z / 130.5, 0, 1.6);
  return 1 - Math.pow(t, 0.85) * 0.6;
}

/* Once the ball enters/scores through the hoop it is at the hoop's depth —
   it should NOT grow back as it falls.  Lock scale to the rim's depth. */
const RIM_DEPTH_SCALE = depthScale(clamp((DEPTH_ANCHOR_Y - hoop.rimY) / 3.93, 0, 110));

function getDynamicScale() {
  if (ball.hoopState === "entering" || ball.hoopState === "scored") {
    return RIM_DEPTH_SCALE;
  }
  /* Pre-launch: ball appears larger (closer to camera feel).
     Only when not scored — scored+settled ball stays at rim depth scale. */
  if (!ball.active && !ball.scored) {
    return BALL_REST_SCALE;
  }
  return depthScale(ball.z);
}

function getBallSpinFrameIndex(angle = ball.angle) {
  const fullTurn = Math.PI * 2;
  const normalizedAngle = ((angle % fullTurn) + fullTurn) % fullTurn;
  return Math.floor((normalizedAngle / fullTurn) * ballSpinFrames.length) % ballSpinFrames.length;
}

function getBallRenderImage(angle = ball.angle, useSpinFrames = ball.active) {
  if (!useSpinFrames || !ballSpinFrames.length) return ballImage;
  return ballSpinFrames[getBallSpinFrameIndex(angle)] || ballImage;
}

function drawBallGlow() {
  if (!state.dragging || ball.active) return;
  const pulse = (Math.sin(Date.now() / 180) + 1) * 0.5;
  const baseR = BALL_DISPLAY_RADIUS * getDynamicScale();
  const glowR = baseR + 10 + pulse * 8;
  const grad = ctx.createRadialGradient(ball.x, ball.y, baseR * 0.6, ball.x, ball.y, glowR);
  grad.addColorStop(0, `rgba(255, 196, 64, ${0.35 + pulse * 0.25})`);
  grad.addColorStop(1, "rgba(255, 196, 64, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, glowR, 0, Math.PI * 2);
  ctx.fill();
}

function drawBallShadowAndTrail() {
  if (ball.opacity <= 0) return;
  /* ── Motion trail ── */
  if (ball.trail.length > 1) {
    const len = ball.trail.length;
    for (let i = 0; i < len - 1; i++) {
      const t = (i + 1) / len;                        // 0→1 (oldest→newest)
      const pt = ball.trail[i];
      const r = BALL_DISPLAY_RADIUS * pt.scale * (0.3 + t * 0.55);
      const alpha = t * 0.32;                          // linear fade, clearly visible
      const trailImage = getBallRenderImage(pt.angle, true);
      ctx.globalAlpha = alpha;
      ctx.drawImage(trailImage, pt.x - r, pt.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  if (ball.hoopState === "scored") {
    // Shadow directly under the ball at ground level
    const ballR = BALL_DISPLAY_RADIUS * RIM_DEPTH_SCALE;
    const SHADOW_GROUND_Y = 560 + ballR + 2;
    const heightAboveGround = Math.max(0, SHADOW_GROUND_Y - ball.y);
    const proximityT = 1 - clamp(heightAboveGround / 200, 0, 1);
    const shadowScale = RIM_DEPTH_SCALE * (0.3 + proximityT * 0.7);
    const shadowAlpha = 0.08 + proximityT * 0.18;
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(
      ball.x, SHADOW_GROUND_Y,
      BALL_DISPLAY_RADIUS * shadowScale,
      BALL_DISPLAY_RADIUS * 0.2 * shadowScale,
      0, 0, Math.PI * 2
    );
    ctx.fill();
    return;
  }
  // Normal shadow on ground
  if (ball.y < GAME_HEIGHT - 80) {
    const scale = depthScale(ball.z);
    const shadowY = (ball.z >= 200) ? ball.y + 10 : GAME_HEIGHT - 50;
    const shadowScale = Math.max(0.3, 1 - (shadowY - ball.y) / 600) * scale;
    ctx.fillStyle = `rgba(0, 0, 0, ${0.18 * shadowScale})`;
    ctx.beginPath();
    ctx.ellipse(ball.x, shadowY, BALL_DISPLAY_RADIUS * shadowScale, BALL_DISPLAY_RADIUS * 0.25 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBallSprite() {
  if (ball.opacity <= 0) return;
  const r = BALL_DISPLAY_RADIUS * getDynamicScale();
  const ballSprite = getBallRenderImage(ball.angle, ball.active);
  ctx.save();
  ctx.globalAlpha = ball.opacity;
  ctx.translate(ball.x, ball.y);
  if (ballSprite === ballImage) {
    ctx.rotate(ball.angle);
  }
  ctx.drawImage(ballSprite, -r, -r, r * 2, r * 2);
  ctx.restore();
}

function drawAimGuide() {
  if (!state.dragging || !state.pointerStart || !state.pointerCurrent) return;
  const dx = state.pointerCurrent.x - state.pointerStart.x;
  const dy = state.pointerCurrent.y - state.pointerStart.y;
  const previewLaunch = getLaunchVector(dx, dy);
  const previewVx = previewLaunch.vx;
  const previewVy = previewLaunch.vy;

  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();

  let px = ball.x, py = ball.y, vx = previewVx, vy = previewVy;
  let sp = previewLaunch.spin; // preview spin
  ctx.moveTo(px, py);
  for (let i = 0; i < 30; i++) {
    // Match actual physics: spin, drag, Verlet
    vx += sp * 0.002;
    sp *= 0.995;
    const s = Math.hypot(vx, vy);
    if (s > 0.1) { const d = 0.0008 * s; vx -= (vx / s) * d; vy -= (vy / s) * d; }
    px += vx;
    py += vy + 0.5 * GRAVITY;
    vy += GRAVITY;
    ctx.lineTo(px, py);
    if (py < 0 || px < 0 || px > GAME_WIDTH || py > GAME_HEIGHT) break;
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawScoreMessage() {
  if (!state.scoreMessage) return;
  const elapsed = performance.now() - state.scoreMessage.startTime;
  const duration = 1200;
  if (elapsed >= duration) {
    state.scoreMessage = null;
    return;
  }
  const t = elapsed / duration;
  const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
  const lift = 40 * t;
  const scale = 0.8 + 0.4 * Math.min(1, t * 4);
  const x = hoop.centerX;
  const y = hoop.rimY - 70 - lift;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 32px 'Chakra Petch', 'Bergen Sans', sans-serif";
  ctx.lineWidth = 6;
  ctx.strokeStyle = `rgba(0, 0, 0, ${0.7 * alpha})`;
  ctx.strokeText(state.scoreMessage.text, 0, 0);
  ctx.fillStyle = `rgba(94, 200, 212, ${alpha})`;
  ctx.fillText(state.scoreMessage.text, 0, 0);
  ctx.restore();
}

function drawAssistGlow() {
  if (!state.assistMode || state.finished || !state.started) return;
  const pulse = (Math.sin(Date.now() / 140) + 1) * 0.5;
  ctx.beginPath();
  ctx.fillStyle = `rgba(12, 162, 80, ${0.06 + pulse * 0.06})`;
  ctx.arc(hoop.centerX, hoop.rimY, 80 + pulse * 14, 0, Math.PI * 2);
  ctx.fill();
}

function resetNetAnimation() {
  netAnimation.energy = 0;
  netAnimation.frameIndex = NET_FRAME_INDEX.idle;
  netAnimation.lastDirection = 1;
}

function isBallDrivingNet() {
  return (
    ball.active &&
    (ball.hoopState === "entering" || ball.hoopState === "scored") &&
    ball.y >= hoop.rimY - 10 &&
    ball.y <= hoop.rimY + hoop.netHeight + 42
  );
}

function updateNetAnimation() {
  const directionThreshold = 0.18;
  if (ball.vx <= -directionThreshold) {
    netAnimation.lastDirection = -1;
  } else if (ball.vx >= directionThreshold) {
    netAnimation.lastDirection = 1;
  }

  if (isBallDrivingNet()) {
    const depthProgress = clamp((ball.y - (hoop.rimY - 4)) / (hoop.netHeight + 14), 0, 1);
    const verticalStretch = clamp(ball.vy / 8, 0, 1);
    const horizontalSpeed = Math.abs(ball.vx);

    netAnimation.energy = Math.max(
      netAnimation.energy,
      clamp(0.28 + depthProgress * 0.5 + verticalStretch * 0.22 + horizontalSpeed * 0.18, 0, 1),
    );

    if (ball.y < hoop.rimY + hoop.netHeight * 0.06 || ball.vy <= 0.45) {
      netAnimation.frameIndex = NET_FRAME_INDEX.preopen;
    } else if (depthProgress < 0.24) {
      netAnimation.frameIndex = NET_FRAME_INDEX.catch;
    } else if (depthProgress < 0.58) {
      netAnimation.frameIndex = NET_FRAME_INDEX.drop;
    } else if (horizontalSpeed > 0.55) {
      netAnimation.frameIndex =
        netAnimation.lastDirection < 0 ? NET_FRAME_INDEX.swayLeft : NET_FRAME_INDEX.swayRight;
    } else {
      netAnimation.frameIndex = NET_FRAME_INDEX.stretch;
    }
    return;
  }

  if (netAnimation.energy > 0.01) {
    netAnimation.energy = Math.max(0, netAnimation.energy - 0.06);

    if (netAnimation.energy > 0.56) {
      netAnimation.frameIndex =
        netAnimation.lastDirection < 0 ? NET_FRAME_INDEX.swayRight : NET_FRAME_INDEX.swayLeft;
    } else if (netAnimation.energy > 0.22) {
      netAnimation.frameIndex = NET_FRAME_INDEX.recoil;
    } else if (netAnimation.energy > 0.08) {
      netAnimation.frameIndex = NET_FRAME_INDEX.preopen;
    } else {
      netAnimation.frameIndex = NET_FRAME_INDEX.idle;
    }
    return;
  }

  netAnimation.frameIndex = NET_FRAME_INDEX.idle;
}

function drawNet() {
  const img = netFrames[netAnimation.frameIndex] || netFrames[NET_FRAME_INDEX.idle];
  if (!img || !img.complete || !img.naturalWidth) return;

  const NET_WIDTH_MULT = 2.1;
  const NET_Y_OFFSET = -6;
  const baseWidth = hoop.rimRadius * NET_WIDTH_MULT;
  const aspect = img.naturalHeight / img.naturalWidth;
  const baseHeight = baseWidth * aspect;

  let width = baseWidth;
  let height = baseHeight;
  let xOffset = 0;

  // The sprite sequence carries most of the deformation. Keep a small live
  // response so the net does not feel locked to discrete frames.
  if (netAnimation.frameIndex !== NET_FRAME_INDEX.idle) {
    const liveStretch = ball.active ? clamp(ball.vy * 0.0045, 0, 0.08) : netAnimation.energy * 0.025;
    height *= 1 + liveStretch;

    if (ball.active) {
      xOffset += clamp(ball.vx * 0.45, -5, 5);
    }

    if (netAnimation.frameIndex === NET_FRAME_INDEX.swayLeft) {
      xOffset -= 2 + netAnimation.energy * 4;
    } else if (netAnimation.frameIndex === NET_FRAME_INDEX.swayRight) {
      xOffset += 2 + netAnimation.energy * 4;
    } else if (netAnimation.frameIndex === NET_FRAME_INDEX.recoil) {
      xOffset += -netAnimation.lastDirection * (1.5 + netAnimation.energy * 4.5);
    } else if (!ball.active && netAnimation.energy > 0.08) {
      xOffset += -netAnimation.lastDirection * netAnimation.energy * 2;
    }
  }

  const x = hoop.centerX - width / 2 + xOffset;
  const y = hoop.rimY + NET_Y_OFFSET;
  ctx.drawImage(img, x, y, width, height);
}

function drawFrontHoop() {
  if (!frontHoopReady) return;
  const FRONT_WIDTH_MULT = 2.6;
  const FRONT_Y_OFFSET = -14;
  const width = hoop.rimRadius * FRONT_WIDTH_MULT;
  const aspect = frontHoopImage.naturalHeight / frontHoopImage.naturalWidth;
  const height = width * aspect;
  const x = hoop.centerX - width / 2;
  const y = hoop.rimY + FRONT_Y_OFFSET;
  ctx.drawImage(frontHoopImage, x, y, width, height);
}

let debugApex = Infinity;
function drawDebugRim() {
  if (!DEBUG_ENABLED) return;

  const effR = BALL_COLLISION_RADIUS;
  const rimY = hoop.rimY;
  const leftRimX = hoop.centerX - hoop.rimRadius;
  const rightRimX = hoop.centerX + hoop.rimRadius;
  const innerLeftRimX = leftRimX + 4;
  const innerRightRimX = rightRimX - 4;
  const capturePadding = BALL_DISPLAY_RADIUS * 0.28;
  const captureLeftX = innerLeftRimX - capturePadding;
  const captureRightX = innerRightRimX + capturePadding;
  const captureTop = rimY - effR * 0.55;
  const scoreDepthY = rimY + hoop.netHeight * 0.35;
  const committedBottomY = rimY + hoop.netHeight * 0.65;
  const backboardLeft = hoop.centerX - hoop.backboardWidth * 0.5;
  const backboardTop = rimY - 110;
  const backboardWidth = hoop.backboardWidth;
  const backboardHeight = 18;

  if (ball.active && ball.y < debugApex) debugApex = ball.y;
  if (!ball.active) debugApex = Infinity;
  debug.pruneMarkers();

  ctx.save();

  ctx.lineWidth = 1.25;
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(77, 208, 225, 0.95)";
  ctx.strokeRect(captureLeftX, captureTop, captureRightX - captureLeftX, scoreDepthY - captureTop);
  ctx.fillStyle = "rgba(77, 208, 225, 0.9)";
  ctx.font = "10px monospace";
  ctx.fillText("capture", captureLeftX + 3, captureTop - 4);

  ctx.strokeStyle = "rgba(171, 71, 188, 0.95)";
  ctx.strokeRect(captureLeftX, rimY - 2, captureRightX - captureLeftX, committedBottomY - (rimY - 2));
  ctx.fillStyle = "rgba(171, 71, 188, 0.9)";
  ctx.fillText("committed", captureLeftX + 3, committedBottomY + 12);

  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255, 209, 102, 0.95)";
  ctx.strokeRect(backboardLeft, backboardTop, backboardWidth, backboardHeight);
  ctx.fillStyle = "rgba(255, 209, 102, 0.95)";
  ctx.fillText("backboard", backboardLeft + 2, backboardTop - 4);

  ctx.strokeStyle = "rgba(255, 99, 99, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(hoop.centerX, rimY, hoop.rimRadius, hoop.rimRadius * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
  ctx.beginPath();
  ctx.moveTo(0, rimY);
  ctx.lineTo(GAME_WIDTH, rimY);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 107, 107, 0.8)";
  const rimPointPerspective = 0.3;
  const rimPointCount = 24;
  for (let i = 0; i < rimPointCount; i++) {
    const angle = (i / rimPointCount) * Math.PI * 2;
    const py = rimY + Math.sin(angle) * hoop.rimRadius * rimPointPerspective;
    if (py > rimY + 2) continue;
    const px = hoop.centerX + Math.cos(angle) * hoop.rimRadius;
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (ball.active || state.dragging) {
    ctx.strokeStyle = ball.hoopState === "entering" ? "rgba(124, 255, 107, 0.95)" : "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, effR, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = "rgba(124, 255, 107, 0.9)";
  ctx.beginPath();
  ctx.moveTo(captureLeftX, scoreDepthY);
  ctx.lineTo(captureRightX, scoreDepthY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(124, 255, 107, 0.9)";
  ctx.fillText("score depth", captureRightX - 56, scoreDepthY - 5);

  if (debugApex < GAME_HEIGHT) {
    ctx.strokeStyle = "rgba(124, 255, 107, 0.65)";
    ctx.beginPath();
    ctx.moveTo(0, debugApex);
    ctx.lineTo(GAME_WIDTH, debugApex);
    ctx.stroke();
  }

  const now = performance.now();
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.font = "10px monospace";
  for (const marker of debug.markers) {
    const age = now - marker.createdAt;
    const alpha = Math.max(0.18, 1 - age / debug.markerTtlMs);
    ctx.fillStyle = hexToRgba(marker.color || "#ffffff", alpha);
    ctx.strokeStyle = `rgba(0, 0, 0, ${Math.min(0.9, alpha + 0.2)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillText(marker.label || marker.type || "hit", marker.x, marker.y - 8);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "yellow";
  ctx.font = "12px monospace";
  ctx.fillText(`ball.y=${ball.y.toFixed(0)} vy=${ball.vy.toFixed(2)} hoop=${ball.hoopState}`, 8, GAME_HEIGHT - 34);
  ctx.fillText(`rimY=${rimY} apex=${isFinite(debugApex) ? debugApex.toFixed(0) : "-"} scoreY=${scoreDepthY.toFixed(1)}`, 8, GAME_HEIGHT - 20);
  ctx.fillText(`capture=[${captureLeftX.toFixed(1)}, ${captureRightX.toFixed(1)}] ballR=${effR.toFixed(1)}`, 8, GAME_HEIGHT - 6);

  ctx.restore();
}

/* ─── Main draw ─── */
function drawScene() {
  drawBackground();
  drawBird();
  drawAssistGlow();

  drawBallShadowAndTrail();
  drawBallGlow();

  const droppingIntoNet =
    (ball.hoopState === "entering" || ball.hoopState === "scored") &&
    ball.vy > 0 &&
    ball.y >= hoop.rimY - 2;

  if (droppingIntoNet) {
    // Ball behind net strings and front rim
    drawBallSprite();
    drawNet();
    drawFrontHoop();
  } else {
    drawNet();
    drawFrontHoop();
    drawBallSprite();
  }

  drawScoreMessage();
  drawAimGuide();
  if (DEBUG_ENABLED) drawDebugRim();
}

function render() {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  updateBird();
  updateBallPhysics();
  updateNetAnimation();
  updateParticles();
  drawScene();
  drawParticles();
  if (DEBUG_ENABLED) {
    debug.renderState();
  }
  state.animationFrame = window.requestAnimationFrame(render);
}

/* ─── Event listeners ─── */
canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);
canvas.addEventListener("pointerleave", handlePointerUp);

startButton.addEventListener("click", beginGame);
restartButton.addEventListener("click", () => {
  restartConfirmOverlay.classList.add("visible");
});
restartCancelButton.addEventListener("click", () => {
  restartConfirmOverlay.classList.remove("visible");
});
restartConfirmButton.addEventListener("click", () => {
  restartConfirmOverlay.classList.remove("visible");
  resetGame();
});
helpButton.addEventListener("click", () => {
  helpOverlay.classList.add("visible");
});
helpCloseButton.addEventListener("click", () => {
  helpOverlay.classList.remove("visible");
});
if (assistToggleButton) {
  assistToggleButton.addEventListener("click", toggleAssist);
}
if (assistInfoCloseButton) {
  assistInfoCloseButton.addEventListener("click", () => {
    assistInfoOverlay.classList.remove("visible");
  });
}
auxCloseButton.addEventListener("click", () => {
  auxOverlay.classList.remove("visible");
});
auxPageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openAuxPage(button.dataset.auxPage);
  });
});
messageButton.addEventListener("click", () => {
  hideOverlay(messageOverlay);
  state.awaitingMessage = false;
  if (state.finished && state.shotsMade >= WIN_THRESHOLD) {
    leadForm.classList.remove("hidden");
  } else if (state.finished) {
    resetGame();
  }
});

replayButton.addEventListener("click", () => {
  hideOverlay(messageOverlay);
  state.awaitingMessage = false;
  resetGame();
});

leadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formFeedback.textContent = "Η συμμετοχή σου καταχωρήθηκε. Πάτα Επανεκκίνηση για νέα παρτίδα.";
});

/* ─── Debug modal triggers ─── */
if (DEBUG_ENABLED) {
  document.querySelectorAll("[data-dbg-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.dbgModal;
      switch (key) {
        case "start":
          startOverlay.classList.add("visible");
          break;
        case "help":
          helpOverlay.classList.add("visible");
          break;
        case "restart":
          restartConfirmOverlay.classList.add("visible");
          break;
        case "win":
          showOverlay({
            eyebrow: "Νικητής",
            title: "Τα κατάφερες",
            body: "Συμπλήρωσε τη φόρμα για να διεκδικήσεις το δώρο ΦΥΣΙΚΟ ΑΕΡΙΟ.",
            buttonLabel: "Πάμε στη φόρμα",
          });
          break;
        case "loss":
          showOverlay({
            eyebrow: "Τέλος",
            title: "Δεν τα κατάφερες",
            body: "Δοκίμασε ξανά!",
            buttonLabel: "Παίξε ξανά",
          });
          break;
        case "form":
          leadForm.classList.remove("hidden");
          break;
        case "terms":
          openAuxPage("terms");
          break;
        case "contest":
          openAuxPage("contest");
          break;
        case "privacy":
          openAuxPage("privacy");
          break;
      }
    });
  });

  document.getElementById("dbgHideAll").addEventListener("click", () => {
    startOverlay.classList.remove("visible");
    helpOverlay.classList.remove("visible");
    restartConfirmOverlay.classList.remove("visible");
    messageOverlay.classList.remove("visible");
    auxOverlay.classList.remove("visible");
    leadForm.classList.add("hidden");
    state.awaitingMessage = false;
  });
}

/* ─── Boot ─── */
setupCanvas();
window.addEventListener("resize", setupCanvas);

/* ─── Asset protection ─── */
document.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("dragstart", (event) => event.preventDefault());

window.addEventListener("keydown", (e) => {
  // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+S, Ctrl+C, Ctrl+V
  // Also supports Meta (Command) key for Mac
  const isCmdOrCtrl = e.ctrlKey || e.metaKey;
  if (
    e.keyCode === 123 || // F12
    (isCmdOrCtrl && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) || // I, J
    (isCmdOrCtrl && (e.keyCode === 85 || e.keyCode === 83 || e.keyCode === 67 || e.keyCode === 86)) // U, S, C, V
  ) {
    e.preventDefault();
    return false;
  }
});
