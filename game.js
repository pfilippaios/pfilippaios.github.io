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

/* ─── Image assets ─── */
let assetsLoaded = 0;
const TOTAL_ASSETS = 21;

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

const ballSpinFrames = Array.from({ length: 8 }, (_, index) => {
  const image = new Image();
  image.onload = onAssetLoad;
  image.src = `./assets/ball-spin-${index + 1}.png`;
  return image;
});

const netDefaultImage = new Image();
let netDefaultReady = false;
netDefaultImage.onload = () => {
  netDefaultReady = true;
  onAssetLoad();
};
netDefaultImage.src = "./assets/net_default.png";

const netExpandedImage = new Image();
let netExpandedReady = false;
netExpandedImage.onload = () => {
  netExpandedReady = true;
  onAssetLoad();
};
netExpandedImage.src = "./assets/net_expanded.png";

const frontHoopImage = new Image();
let frontHoopReady = false;
frontHoopImage.onload = () => {
  frontHoopReady = true;
  onAssetLoad();
};
frontHoopImage.src = "./assets/front-hoop.png";

const birdFrames = Array.from({ length: 8 }, (_, index) => {
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
const debugClearBtn = document.getElementById("debugClear");
const debugToggleBtn = document.getElementById("debugToggle");

const debug = {
  entries: [],
  fileLog: [],
  max: 80,
  log(msg, level = "info") {
    const t = (performance.now() / 1000).toFixed(2);
    this.entries.push({ t, msg, level });
    this.fileLog.push(`[${t}] [${level.toUpperCase()}] ${msg}`);
    if (this.entries.length > this.max) this.entries.shift();
    this.renderLog();
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
    this.renderLog();
  },
  download() {
    const blob = new Blob([this.fileLog.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hoop-rush-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
  renderState() {
    if (!debugStateNode) return;
    const s = state;
    const b = ball;
    debugStateNode.textContent =
      `started=${s.started} finished=${s.finished} assist=${s.assistMode}
attempts=${s.attemptsUsed}/${MAX_ATTEMPTS} made=${s.shotsMade}/${WIN_THRESHOLD} score=${s.score}
dragging=${s.dragging} awaitMsg=${s.awaitingMessage}
ball.active=${b.active} scored=${b.scored} hoop=${b.hoopState}
ball.x=${b.x.toFixed(1)} y=${b.y.toFixed(1)} z=${b.z.toFixed(1)}
ball.vx=${b.vx.toFixed(2)} vy=${b.vy.toFixed(2)} flight=${b.flightTime || 0}`;
  },
};

if (!DEBUG_ENABLED && debugPanel) {
  debugPanel.hidden = true;
  debugPanel.style.display = "none";
}

if (DEBUG_ENABLED && debugClearBtn) {
  debugClearBtn.addEventListener("click", () => debug.clear());
}
if (DEBUG_ENABLED && debugToggleBtn) {
  debugToggleBtn.addEventListener("click", () => {
    debugPanel.classList.toggle("collapsed");
    debugToggleBtn.textContent = debugPanel.classList.contains("collapsed") ? "Show" : "Hide";
  });
}
if (DEBUG_ENABLED) {
  window.addEventListener("keydown", (e) => {
    if (e.key === "d" || e.key === "D") {
      debugPanel.classList.toggle("collapsed");
      if (debugToggleBtn) debugToggleBtn.textContent = debugPanel.classList.contains("collapsed") ? "Show" : "Hide";
    }
    if (e.key === "l" || e.key === "L") {
      debug.download();
    }
  });
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
  assistMode: true,
  awaitingMessage: false,
};

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
const BALL_REST_Y = GAME_HEIGHT - 220; // 540 — raised for mobile viewport
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
  z: 0,
};

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
  ball.flightTime = 0;
  ball.z = 0;
  ball.validEntry = false;
  state.justScored = false;
  state.dragging = false;
  state.pointerStart = null;
  state.pointerCurrent = null;
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
  state.assistMode = true; // High conversion: Always on for mobile
  state.awaitingMessage = false;
  hideOverlay(messageOverlay);
  startOverlay.classList.add("visible");
  leadForm.classList.add("hidden");
  leadForm.reset();
  formFeedback.textContent = "";
  resetBall();
  updateHud();
}

function beginGame() {
  state.started = true;
  state.finished = false;
  state.attemptsUsed = 0;
  state.score = 0;
  state.shotsMade = 0;
  startOverlay.classList.remove("visible");
  hideOverlay(messageOverlay);
  leadForm.classList.add("hidden");
  state.awaitingMessage = false;
  resetBall();
  updateHud();
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

/* ─── Pointer events ─── */
function handlePointerDown(event) {
  if (!state.started || state.finished || ball.active || state.awaitingMessage) return;
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
  const upwardPull = clamp(-dy, 20, 260);
  if (swipeDistance < 12 || upwardPull <= 20) {
    state.dragging = false;
    state.pointerStart = null;
    state.pointerCurrent = null;
    return;
  }
  const assistFactor = state.assistMode ? 1.15 : 1;
  ball.vx = clamp((dx * 0.02) * assistFactor, -1.8, 1.8);
  ball.vy = clamp((-upwardPull * 0.07) * assistFactor - 5.5, -18, -12);
  ball.spin = clamp(dx * 0.008, -1.5, 1.5);
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
  // Always on for high mobile conversion
  state.assistMode = true;
  updateHud();
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
  // Early exit: impossible to still reach WIN_THRESHOLD.
  if (needed > remaining) {
    showLossOverlay();
    resetBall();
    return;
  }
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
    body: `Έμειναν ${remaining} προσπάθειες. Χρειάζονται ${needed} καλάθια ακόμα.`,
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
  window.setTimeout(() => {
    const remaining = MAX_ATTEMPTS - state.attemptsUsed;
    if (state.shotsMade >= WIN_THRESHOLD) {
      showWinOverlay();
    } else if (remaining <= 0) {
      showLossOverlay();
    }
    resetBall();
  }, 1200);
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
    ball.z = clamp((BALL_REST_Y - ball.y) / 3.93, 0, 110);
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
    debug.log(`entering-mouth x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)} vy=${ball.vy.toFixed(2)}`, "evt");
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

    if (state.assistMode) {
      if (ball.vy < 0 && ball.y < hoop.rimY) return false;
      if (ball.vy < 0 && ball.y > hoop.rimY - 15) {
        ball.vy = Math.min(ball.vy, -0.2);
        ball.vx += (hoop.centerX - ball.x) * 0.08;
        debug.log(`rim.assist-rising-nudge y=${ball.y.toFixed(1)}`, "warn");
        return true;
      }
      if (ball.y <= hoop.rimY + 6) {
        ball.vx += (hoop.centerX - ball.x) * 0.12;
        ball.vy = Math.max(ball.vy, 0.1);
        const prevHoop = ball.hoopState;
        ball.hoopState = "entering";
        ball.validEntry = true;
        if (prevHoop !== "entering") debug.log(`rim.assist→entering y=${ball.y.toFixed(1)} vx=${ball.vx.toFixed(2)}`, "evt");
        return true;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = effR - dist;
      ball.x += nx * overlap;
      ball.y += ny * overlap;
      ball.vx *= 0.4;
      ball.vy *= 0.3;
      debug.log(`rim.under-rim-deflect y=${ball.y.toFixed(1)}`, "warn");
      return true;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = effR - dist;
    ball.x += nx * overlap;
    ball.y += ny * overlap;
    const vDotN = ball.vx * nx + ball.vy * ny;
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
    ball.vy = Math.abs(ball.vy) * 0.38;
    ball.vx *= 0.82;
    backboardHit = true;
    debug.log(`backboard hit x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)}`, "warn");
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
    debug.log(`top-down crossing y=${ball.y.toFixed(1)}`, "evt");
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
    debug.log(`score-trigger x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)}`, "evt");
    registerScore();
  }

  /* ── Scored ball falls behind the hoop with gravity + bounce ── */
  const HOOP_GROUND_Y = 560;
  if (ball.scored) {
    ball.x = hoop.centerX;
    ball.vx = 0;
    if (ball.y >= HOOP_GROUND_Y) {
      ball.y = HOOP_GROUND_Y;
      if (Math.abs(ball.vy) < 0.5) {
        debug.log(`ball-settled y=${HOOP_GROUND_Y}`, "info");
        ball.vy = 0;
        ball.active = false;
      } else {
        debug.log(`ball-bounce vy=${ball.vy.toFixed(2)}→${(-Math.abs(ball.vy) * 0.45).toFixed(2)}`, "info");
        ball.vy = -Math.abs(ball.vy) * 0.45;
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
const RIM_DEPTH_SCALE = depthScale(clamp((BALL_REST_Y - hoop.rimY) / 3.93, 0, 110));

function getDynamicScale() {
  if (ball.hoopState === "entering" || ball.hoopState === "scored") {
    return RIM_DEPTH_SCALE;
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
  const baseR = BALL_DISPLAY_RADIUS * depthScale(ball.z);
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
  const r = BALL_DISPLAY_RADIUS * getDynamicScale();
  const ballSprite = getBallRenderImage(ball.angle, ball.active);
  ctx.save();
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
  const assistFactor = state.assistMode ? 1.15 : 1;
  const previewVx = clamp((dx * 0.02) * assistFactor, -1.8, 1.8);
  const previewVy = clamp((-clamp(-dy, 20, 260) * 0.07) * assistFactor - 5.5, -18, -12);

  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();

  let px = ball.x, py = ball.y, vx = previewVx, vy = previewVy;
  let sp = clamp(dx * 0.008, -1.5, 1.5); // preview spin
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

function isBallInNet() {
  const deepInsideHoop = ball.y >= hoop.rimY + hoop.netHeight * 0.2;
  return (
    ball.active &&
    ((ball.hoopState === "entering" && deepInsideHoop) || ball.hoopState === "scored")
  );
}

function drawNet() {
  const expanded = isBallInNet();
  const img = expanded ? netExpandedImage : netDefaultImage;
  const ready = expanded ? netExpandedReady : netDefaultReady;
  if (!ready) return;

  const NET_WIDTH_MULT = 2.1;
  const NET_Y_OFFSET = -6;
  const baseWidth = hoop.rimRadius * NET_WIDTH_MULT;
  const aspect = img.naturalHeight / img.naturalWidth;
  const baseHeight = baseWidth * aspect;

  let width = baseWidth;
  let height = baseHeight;
  let xOffset = 0;

  // Add dynamic stretch and wobble if the ball is in the net
  if (expanded && ball.active) {
    // Stretch based on vertical velocity
    const stretchFactor = clamp(ball.vy * 0.008, 0, 0.25);
    height *= (1 + stretchFactor);

    // Wobble based on horizontal entry velocity and time
    const horizontalPull = clamp(ball.vx * 0.8, -12, 12);
    const wobbleFreq = 0.015;
    const wobbleAmp = clamp(Math.abs(ball.vx) * 1.5, 2, 8);
    xOffset = horizontalPull + Math.sin(Date.now() * wobbleFreq) * wobbleAmp;

    // Fade out wobble as the ball falls below the net
    const netBottom = hoop.rimY + baseHeight;
    const exitFactor = clamp((ball.y - netBottom) / 40, 0, 1);
    xOffset *= (1 - exitFactor);
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
  if (!TEST_MODE) return;
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(hoop.centerX, hoop.rimY, hoop.rimRadius, 0, Math.PI * 2);
  ctx.stroke();
  // horizontal rim plane line across canvas
  ctx.strokeStyle = "rgba(255,0,0,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, hoop.rimY);
  ctx.lineTo(GAME_WIDTH, hoop.rimY);
  ctx.stroke();
  // persistent apex line (lowest y reached)
  if (ball.active && ball.y < debugApex) debugApex = ball.y;
  if (!ball.active) debugApex = Infinity;
  if (debugApex < GAME_HEIGHT) {
    ctx.strokeStyle = "lime";
    ctx.beginPath();
    ctx.moveTo(0, debugApex);
    ctx.lineTo(GAME_WIDTH, debugApex);
    ctx.stroke();
  }
  // text HUD
  ctx.fillStyle = "yellow";
  ctx.font = "12px monospace";
  ctx.fillText(`ball.y=${ball.y.toFixed(0)} vy=${ball.vy.toFixed(2)}`, 8, GAME_HEIGHT - 20);
  ctx.fillText(`rimY=${hoop.rimY} apex=${isFinite(debugApex) ? debugApex.toFixed(0) : "-"}`, 8, GAME_HEIGHT - 6);
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
  drawScene();
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
