const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const triesLeftNode = document.getElementById("triesLeft");
const scoreValueNode = document.getElementById("scoreValue");
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

/* ─── Image assets ─── */
let assetsLoaded = 0;
const TOTAL_ASSETS = 5;

function onAssetLoad() {
  assetsLoaded++;
  if (assetsLoaded >= TOTAL_ASSETS) {
    setupCanvas();
    resetBall();
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

const TEST_MODE = false;
const SLOW_MO = 1.0;

/* ─── Debug panel ─── */
const debugPanel = document.getElementById("debugPanel");
const debugStateNode = document.getElementById("debugState");
const debugLogNode = document.getElementById("debugLog");
const debugClearBtn = document.getElementById("debugClear");
const debugToggleBtn = document.getElementById("debugToggle");

const debug = {
  entries: [],
  max: 80,
  log(msg, level = "info") {
    const t = (performance.now() / 1000).toFixed(2);
    this.entries.push({ t, msg, level });
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

if (debugClearBtn) debugClearBtn.addEventListener("click", () => debug.clear());
if (debugToggleBtn) debugToggleBtn.addEventListener("click", () => {
  debugPanel.classList.toggle("collapsed");
  debugToggleBtn.textContent = debugPanel.classList.contains("collapsed") ? "show" : "hide";
});
// Keyboard toggle: D key
window.addEventListener("keydown", (e) => {
  if (e.key === "d" || e.key === "D") {
    debugPanel.classList.toggle("collapsed");
    if (debugToggleBtn) debugToggleBtn.textContent = debugPanel.classList.contains("collapsed") ? "show" : "hide";
  }
});
debug.log("boot", "evt");

/* ─── Constants ─── */
const DPR = Math.max(window.devicePixelRatio || 1, 1);
const GAME_WIDTH = 420;
const GAME_HEIGHT = 760;
const GRAVITY = 0.22;
const BASE_RESET_DELAY = 900;
const SCORE_VALUE = 100;
const MAX_ATTEMPTS = 5;
const WIN_THRESHOLD = 3;

const AUX_PAGES = {
  terms: {
    title: "Όροι Χρήσης",
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
    title: "Πληροφορίες Διαγωνισμού",
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
    title: "Προσωπικά Δεδομένα",
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

const ball = {
  radius: 32,
  x: GAME_WIDTH * 0.5,
  y: BALL_REST_Y,
  prevX: GAME_WIDTH * 0.5,
  prevY: BALL_REST_Y,
  vx: 0,
  vy: 0,
  active: false,
  trail: [],
  scored: false,
  hoopState: "outside",
  z: 0,
};

/* ─── Canvas setup ─── */
function setupCanvas() {
  canvas.width = GAME_WIDTH * DPR;
  canvas.height = GAME_HEIGHT * DPR;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

/* ─── HUD ─── */
function updateHud() {
  triesLeftNode.textContent = String(Math.max(MAX_ATTEMPTS - state.attemptsUsed, 0));
  scoreValueNode.textContent = `${state.shotsMade}/${MAX_ATTEMPTS}`;
}

/* ─── Overlays ─── */
function showOverlay({ eyebrow, title, body, buttonLabel }) {
  messageEyebrow.textContent = eyebrow;
  messageTitle.textContent = title;
  messageBody.textContent = body;
  messageButton.textContent = buttonLabel;
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
  ball.vx = clamp((dx * 0.03) * assistFactor, -2.5, 2.5);
  ball.vy = clamp((-upwardPull * 0.08) * assistFactor - 5.0, -19, -12);
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
    title: "Τα Κατάφερες",
    body: "Συμπλήρωσε τη φόρμα για να διεκδικήσεις το δώρο Fysiko Aerio.",
    buttonLabel: "Άνοιγμα Φόρμας",
  });
}

function showLossOverlay() {
  state.finished = true;
  debug.log(`LOSS made=${state.shotsMade}/${WIN_THRESHOLD}`, "err");
  showOverlay({
    eyebrow: "Τέλος",
    title: "Δεν Τα Κατάφερες",
    body: `Βρήκες ${state.shotsMade}/${MAX_ATTEMPTS}. Χρειάζονται τουλάχιστον ${WIN_THRESHOLD}. Πάτα για ξανά.`,
    buttonLabel: "Ξανά",
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
    title: "Εκτός Στόχου",
    body: `Έμειναν ${remaining} προσπάθειες. Χρειάζονται ${needed} καλάθια ακόμα.`,
    buttonLabel: "Επόμενη Βολή",
  });
  resetBall();
}

const SCORE_MESSAGES = ["ΚΑΛΑΘΙ!", "ΜΠΑΜ!", "ΦΟΒΕΡΟ!", "ΤΕΛΕΙΟ!", "ΣΩΣΤΟΣ!", "ΝΑΙ!"];

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
function updateBallPhysics() {
  if (!ball.active) return;

  ball.flightTime = (ball.flightTime || 0) + 1;
  if (ball.flightTime > 240) {
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

  if (state.assistMode) {
    const dxToHoop = hoop.centerX - ball.x;
    const dyToHoop = hoop.rimY - ball.y;
    const distanceToHoop = Math.hypot(dxToHoop, dyToHoop);
    if (distanceToHoop < 600 && ball.y < hoop.rimY + 180) {
      if (ball.y < hoop.rimY || ball.vy > 0) {
        ball.vx += dxToHoop * 0.004; // Gentle pull
      }
      // Only apply vertical pull when it HELPS arc:
      //   - ball below rim: lift upward (dy negative)
      //   - ball above rim AND falling: guide into hoop (dy positive, vy > 0)
      // Skip when ball is above rim and still rising — otherwise caps apex at rim.
      const belowRim = ball.y > hoop.rimY;
      const falling = ball.vy > 0;
      if (belowRim || falling) {
        ball.vy += dyToHoop * 0.0015;
      }
    }
    // Lighter damping for natural movement
    ball.vx *= 0.99;
  }

  ball.vy += GRAVITY * SLOW_MO;
  ball.x += ball.vx * SLOW_MO;
  ball.y += ball.vy * SLOW_MO;
  
  if (ball.active) {
    ball.z = clamp((BALL_REST_Y - ball.y) / 3.93, 0, 110);
  }

  // Effective radius scales with depth so visual matches collision
  const scale = depthScale(ball.z);
  const effR = BALL_DISPLAY_RADIUS * scale;

  const leftRimX = hoop.centerX - hoop.rimRadius;
  const rightRimX = hoop.centerX + hoop.rimRadius;
  const rimY = hoop.rimY;
  const entryInset = 4;
  const innerLeftRimX = leftRimX + entryInset;
  const innerRightRimX = rightRimX - entryInset;

  function collideRimPoint(px, py) {
    const dx = ball.x - px;
    const dy = ball.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist === 0 || dist >= effR) return false;

    if (state.assistMode) {
      // Ball rising and above rim plane: let it fly over. No collision response.
      if (ball.vy < 0 && ball.y < hoop.rimY) {
        return false;
      }
      if (ball.vy < 0 && ball.y > hoop.rimY - 15) {
        ball.vy = Math.min(ball.vy, -0.2);
        ball.vx += (hoop.centerX - ball.x) * 0.08;
        debug.log(`rim.assist-rising-nudge y=${ball.y.toFixed(1)}`, "warn");
        return true;
      }
      // Ball falling. Only treat as "entering" when at/above rim plane — a legit
      // top-down entry. Contacts from below bounce harmlessly without scoring.
      if (ball.y <= hoop.rimY + 6) {
        ball.vx += (hoop.centerX - ball.x) * 0.12;
        ball.vy = Math.max(ball.vy, 0.1);
        const prevHoop = ball.hoopState;
        ball.hoopState = "entering";
        ball.validEntry = true;
        if (prevHoop !== "entering") debug.log(`rim.assist→entering y=${ball.y.toFixed(1)} vx=${ball.vx.toFixed(2)}`, "evt");
        return true;
      }
      // Under-rim contact: deflect out without marking entering.
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
      const restitution = 0.02; // Deadened bounce for heavy ball
      ball.vx = (ball.vx - 2 * vDotN * nx) * restitution;
      ball.vy = (ball.vy - 2 * vDotN * ny) * restitution;
    }
    return true;
  }
  const p = 0.3; // perspective factor (rim height vs width)
  const rimPoints = 24;
  let rimHit = false;
  for (let i = 0; i < rimPoints; i++) {
    const angle = (i / rimPoints) * Math.PI * 2;
    const px = hoop.centerX + Math.cos(angle) * hoop.rimRadius;
    const py = hoop.rimY + Math.sin(angle) * hoop.rimRadius * p;

    if (collideRimPoint(px, py)) {
      rimHit = true;
      break;
    }
  }

  // Low-energy rim contacts can leave the ball balanced on the hoop. Nudge those
  // into a clear outcome: centered balls drop through, off-center balls roll off.
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

  // Backboard — horizontal bar above rim. Reflect on bottom face when ball rising.
  const backboardLeft = hoop.centerX - hoop.backboardWidth * 0.5;
  const backboardRight = hoop.centerX + hoop.backboardWidth * 0.5;
  const backboardTop = rimY - 110;
  const backboardBottom = backboardTop + 18;
  
  const hitsBackboardX = ball.x + effR > backboardLeft && ball.x - effR < backboardRight;
  const hitsBackboardY = ball.y + effR > backboardTop && ball.y - effR < backboardBottom;

  let backboardHit = false;
  if (hitsBackboardX && hitsBackboardY && ball.vy < 0) {
    ball.vy = -ball.vy * 0.01; // Heavy thud off the backboard
    ball.vx *= 0.3; // Kill horizontal slide on impact
    backboardHit = true;
    debug.log(`backboard hit x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)}`, "warn");
  }

  // Global post-collision speed cap — prevents stacking bumps from launching ball.
  if (rimHit || backboardHit) {
    const MAX_POST_HIT_SPEED = 8;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > MAX_POST_HIT_SPEED) {
      const k = MAX_POST_HIT_SPEED / sp;
      ball.vx *= k;
      ball.vy *= k;
    }
  }

  const ballBottom = ball.y + (BALL_DISPLAY_RADIUS * scale);
  const prevBallBottom = ball.prevY + (BALL_DISPLAY_RADIUS * depthScale(ball.prevY));
  const crossedRimFromAbove =
    prevBallBottom <= rimY &&
    ballBottom > rimY &&
    ball.vy > 0 &&
    ball.x > innerLeftRimX &&
    ball.x < innerRightRimX;

  if (ball.hoopState === "outside" && crossedRimFromAbove) {
    ball.hoopState = "entering";
    ball.validEntry = true;
    debug.log(`top-down crossing y=${ball.y.toFixed(1)}`, "evt");
  }

  if (ball.hoopState === "entering") {
    const movedBackAboveRim = ball.vy < 0 && ball.y <= rimY;
    const exitedMouthHorizontally = ball.x <= innerLeftRimX || ball.x >= innerRightRimX;
    if (movedBackAboveRim || exitedMouthHorizontally) {
      ball.hoopState = "outside";
    }
  }

  // Gentle centering through net — avoid side clip once committed to entry
  if ((ball.hoopState === "entering" || ball.hoopState === "scored") && ball.vy > 0) {
    ball.x += (hoop.centerX - ball.x) * 0.22;
    ball.vx *= 0.55;
    ball.vy = Math.min(ball.vy, 4.5);
  }

  // Score only after a confirmed top-down hoop entry.
  if (
    !ball.scored &&
    ball.validEntry &&
    ball.hoopState === "entering" &&
    ball.vy > 0 &&
    ball.y >= rimY + hoop.netHeight * 0.35 &&
    ball.x > innerLeftRimX &&
    ball.x < innerRightRimX
  ) {
    registerScore();
  }

  // Early Miss Detection
  // If the ball falls past the net and hasn't scored, end play instantly.
  if (ball.active && !ball.scored && ball.vy > 0 && ball.y > rimY + 80) {
    ball.active = false;
    window.setTimeout(concludeMiss, 200);
  }

  // Fallback Out of bounds
  const outOfBounds = ball.y > GAME_HEIGHT + 80 || ball.x < -80 || ball.x > GAME_WIDTH + 80;
  if (outOfBounds && !ball.scored && ball.active) {
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

function depthScale(z) {
  const t = clamp(z / 130.5, 0, 1.6);
  return 1 - Math.pow(t, 0.85) * 0.6;
}

function getDynamicScale() {
  return depthScale(ball.z);
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
  // Shadow on ground
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
  ctx.drawImage(ballImage, ball.x - r, ball.y - r, r * 2, r * 2);
}

function drawBall() {
  drawBallShadowAndTrail();
  drawBallSprite();
}

function drawAimGuide() {
  if (!state.dragging || !state.pointerStart || !state.pointerCurrent) return;
  const dx = state.pointerCurrent.x - state.pointerStart.x;
  const dy = state.pointerCurrent.y - state.pointerStart.y;
  const assistFactor = state.assistMode ? 1.15 : 1;
  const previewVx = clamp((dx * 0.03) * assistFactor, -2.5, 2.5);
  const previewVy = clamp((-clamp(-dy, 20, 260) * 0.08) * assistFactor - 5.0, -19, -12);

  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();

  let px = ball.x, py = ball.y, vx = previewVx, vy = previewVy;
  ctx.moveTo(px, py);
  for (let i = 0; i < 30; i++) {
    vy += GRAVITY;
    px += vx;
    py += vy;
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
  drawDebugRim();
}

function render() {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  updateBallPhysics();
  drawScene();
  debug.renderState();
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

leadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formFeedback.textContent = "Η συμμετοχή σου καταχωρήθηκε. Πάτα Επανεκκίνηση για νέα παρτίδα.";
});

/* ─── Boot ─── */
setupCanvas();
window.addEventListener("resize", setupCanvas);
