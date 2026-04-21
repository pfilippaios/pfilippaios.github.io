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

/* ─── Image assets ─── */
const bgImage = new Image();
bgImage.src = "./assets/bg.png";
const ballImage = new Image();
ballImage.src = "./assets/ball.png";
const netDefaultImage = new Image();
const netExpandedImage = new Image();
let netDefaultReady = false;
let netExpandedReady = false;
netDefaultImage.onload = () => { netDefaultReady = true; };
netExpandedImage.onload = () => { netExpandedReady = true; };
netDefaultImage.src = "./assets/net_default.png";
netExpandedImage.src = "./assets/net_expanded.png";

let assetsLoaded = 0;
function onAssetLoad() {
  assetsLoaded++;
  if (assetsLoaded >= 2) {
    setupCanvas();
    resetGame();
    render();
  }
}
bgImage.onload = onAssetLoad;
ballImage.onload = onAssetLoad;

const TEST_MODE = true;

/* ─── Constants ─── */
const DPR = Math.max(window.devicePixelRatio || 1, 1);
const GAME_WIDTH = 420;
const GAME_HEIGHT = 760;
const GRAVITY = 0.34;
const BASE_RESET_DELAY = 900;
const SCORE_VALUE = 100;

/* ─── State ─── */
let state = {
  started: false,
  attemptsUsed: 0,
  score: 0,
  shotsMade: 0,
  dragging: false,
  pointerStart: null,
  pointerCurrent: null,
  animationFrame: null,
  justScored: false,
  assistMode: false,
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
  rimY: 251,
  rimRadius: 42,
  netHeight: 55,
  backboardWidth: 150,
};

const BALL_DISPLAY_RADIUS = 38;

const ball = {
  radius: 30, // collision radius (smaller than display)
  x: GAME_WIDTH * 0.5,
  y: GAME_HEIGHT - 120,
  vx: 0,
  vy: 0,
  active: false,
  trail: [],
  scored: false,
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
  triesLeftNode.textContent = String(Math.max(3 - state.attemptsUsed, 0));
  scoreValueNode.textContent = String(state.score);
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

/* ─── Ball / Game reset ─── */
function resetBall() {
  ball.x = GAME_WIDTH * 0.5;
  ball.y = GAME_HEIGHT - 120;
  ball.vx = 0;
  ball.vy = 0;
  ball.active = false;
  ball.scored = false;
  ball.trail = [];
  state.justScored = false;
  state.dragging = false;
  state.pointerStart = null;
  state.pointerCurrent = null;
}

function resetGame() {
  state.started = false;
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
  if (TEST_MODE) {
    state.started = true;
    startOverlay.classList.remove("visible");
  } else {
    startOverlay.classList.add("visible");
  }
  leadForm.classList.add("hidden");
  leadForm.reset();
  formFeedback.textContent = "";
  resetBall();
  updateHud();
}

function beginGame() {
  state.started = true;
  startOverlay.classList.remove("visible");
  hideOverlay(messageOverlay);
  leadForm.classList.add("hidden");
  state.awaitingMessage = false;
  updateHud();
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
  if (TEST_MODE) {
    if (ball.active) return;
  } else if (!state.started || ball.active || state.awaitingMessage || state.shotsMade > 0) return;
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
  const assistFactor = state.assistMode ? 1.14 : 1;
  ball.vx = clamp((-dx * 0.12) * assistFactor, -11, 11);
  ball.vy = clamp((-upwardPull * 0.108) * assistFactor - 4.2, -19, -8.4);
  ball.active = true;
  ball.trail = [];
  state.dragging = false;
  state.pointerStart = null;
  state.pointerCurrent = null;
  state.attemptsUsed += 1;
  updateHud();
}

function handlePointerUp() {
  if (!state.dragging) return;
  launchBall();
}

/* ─── Game logic ─── */
function setAssistMode() {
  state.assistMode = state.attemptsUsed === 2;
  updateHud();
}

function concludeMiss() {
  if (TEST_MODE) {
    resetBall();
    return;
  }
  const remaining = 3 - state.attemptsUsed;
  if (remaining > 0) {
    setAssistMode();
    showOverlay({
      eyebrow: remaining === 1 ? "Final Shot Boost" : "Keep Going",
      title: remaining === 1 ? "Last Try Gets A Boost" : "Good Try",
      body: remaining === 1
        ? "Your last attempt gets an extra pull toward the rim so every player can reach the winner form."
        : "Aim a little above the hoop and use a longer upward swipe.",
      buttonLabel: "Shoot Again",
    });
    resetBall();
    return;
  }
  forceWin();
}

function registerScore() {
  if (ball.scored) return;
  ball.scored = true;
  state.justScored = true;
  state.shotsMade += 1;
  state.score += SCORE_VALUE;
  updateHud();
  if (TEST_MODE) {
    window.setTimeout(resetBall, 420);
    return;
  }
  window.setTimeout(() => {
    showOverlay({
      eyebrow: "Winner",
      title: "You Nailed It",
      body: "Complete the form and enter the Fysiko Aerio prize draw.",
      buttonLabel: "Open Form",
    });
    resetBall();
  }, 420);
}

function forceWin() {
  state.score += SCORE_VALUE;
  state.shotsMade = 1;
  updateHud();
  showOverlay({
    eyebrow: "Crowd Boost",
    title: "You Win",
    body: "The crowd powered your final shot into the hoop. Fill in the form below to claim your entry.",
    buttonLabel: "Open Form",
  });
  resetBall();
}

/* ─── Physics ─── */
function updateBallPhysics() {
  if (!ball.active) return;

  if (state.assistMode) {
    const dxToHoop = hoop.centerX - ball.x;
    const dyToHoop = hoop.rimY - ball.y;
    const distanceToHoop = Math.hypot(dxToHoop, dyToHoop);
    if (distanceToHoop < 230 && ball.y < hoop.rimY + 120) {
      ball.vx += dxToHoop * 0.00075;
      ball.vy += dyToHoop * 0.00028;
    }
  }

  ball.vy += GRAVITY;
  ball.x += ball.vx;
  ball.y += ball.vy;
  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > 14) ball.trail.shift();

  const leftRimX = hoop.centerX - hoop.rimRadius;
  const rightRimX = hoop.centerX + hoop.rimRadius;
  const rimCollisionY = hoop.rimY + 2;

  // Rim collision
  if (ball.y + ball.radius > rimCollisionY - 8 && ball.y + ball.radius < rimCollisionY + 12 && Math.abs(ball.x - leftRimX) < ball.radius + 6) {
    ball.vx = -Math.abs(ball.vx) * 0.78;
    ball.vy *= -0.72;
  }
  if (ball.y + ball.radius > rimCollisionY - 8 && ball.y + ball.radius < rimCollisionY + 12 && Math.abs(ball.x - rightRimX) < ball.radius + 6) {
    ball.vx = Math.abs(ball.vx) * 0.78;
    ball.vy *= -0.72;
  }

  // Backboard collision
  const backboardLeft = hoop.centerX - hoop.backboardWidth * 0.5;
  const backboardRight = hoop.centerX + hoop.backboardWidth * 0.5;
  const backboardTop = hoop.rimY - 110;
  const backboardBottom = backboardTop + 18;
  if (ball.x + ball.radius > backboardLeft && ball.x - ball.radius < backboardRight && ball.y - ball.radius < backboardBottom && ball.y + ball.radius > backboardTop && ball.vy < 0) {
    ball.vy = Math.abs(ball.vy) * 0.45;
  }

  // Score detection
  if (!ball.scored && ball.vy > 0 && ball.y > hoop.rimY - 6 && ball.y < hoop.rimY + hoop.netHeight && ball.x > leftRimX + 8 && ball.x < rightRimX - 8) {
    registerScore();
  }

  // Out of bounds
  const outOfBounds = ball.y > GAME_HEIGHT + 80 || ball.x < -80 || ball.x > GAME_WIDTH + 80;
  if (outOfBounds && !ball.scored) {
    ball.active = false;
    window.setTimeout(concludeMiss, BASE_RESET_DELAY);
  }
}

/* ═══════════════════════════════════════════════
   DRAWING — Image-based rendering
   ═══════════════════════════════════════════════ */

function drawBackground() {
  // Draw bg.png scaled to fill game area
  ctx.drawImage(bgImage, 0, 0, GAME_WIDTH, GAME_HEIGHT);
}

function depthScale(y) {
  const groundY = GAME_HEIGHT - 120;
  const horizonY = hoop.rimY - 120;
  const t = clamp((groundY - y) / (groundY - horizonY), 0, 1);
  const eased = Math.pow(t, 0.85);
  return 1 - eased * 0.75;
}

function drawBall() {
  // Trail — faded ball images with depth scale
  ball.trail.forEach((point, index) => {
    const alpha = (index / ball.trail.length) * 0.2;
    ctx.globalAlpha = alpha;
    const r = BALL_DISPLAY_RADIUS * 1.4 * depthScale(point.y);
    ctx.drawImage(ballImage, point.x - r, point.y - r, r * 2, r * 2);
  });
  ctx.globalAlpha = 1;

  const scale = depthScale(ball.y);
  const r = BALL_DISPLAY_RADIUS * scale;

  // Shadow on ground
  if (ball.y < GAME_HEIGHT - 80) {
    const shadowY = GAME_HEIGHT - 50;
    const shadowScale = Math.max(0.3, 1 - (shadowY - ball.y) / 600) * scale;
    ctx.fillStyle = `rgba(0, 0, 0, ${0.18 * shadowScale})`;
    ctx.beginPath();
    ctx.ellipse(ball.x, shadowY, BALL_DISPLAY_RADIUS * shadowScale, BALL_DISPLAY_RADIUS * 0.25 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ball sprite
  ctx.drawImage(ballImage, ball.x - r, ball.y - r, r * 2, r * 2);
}

function drawAimGuide() {
  if (!state.dragging || !state.pointerStart || !state.pointerCurrent) return;
  const dx = state.pointerCurrent.x - state.pointerStart.x;
  const dy = state.pointerCurrent.y - state.pointerStart.y;
  const previewVx = clamp(-dx * 0.12, -11, 11);
  const previewVy = clamp(-clamp(-dy, 20, 260) * 0.108 - 4.2, -19, -8.4);

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

function drawAssistGlow() {
  if (!state.assistMode || state.shotsMade > 0) return;
  const pulse = (Math.sin(Date.now() / 140) + 1) * 0.5;
  ctx.beginPath();
  ctx.fillStyle = `rgba(12, 162, 80, ${0.06 + pulse * 0.06})`;
  ctx.arc(hoop.centerX, hoop.rimY, 80 + pulse * 14, 0, Math.PI * 2);
  ctx.fill();
}

function isBallInNet() {
  return ball.active &&
    ball.y > hoop.rimY - 6 &&
    ball.y < hoop.rimY + hoop.netHeight + 20 &&
    ball.x > hoop.centerX - hoop.rimRadius &&
    ball.x < hoop.centerX + hoop.rimRadius;
}

function drawNet() {
  const expanded = isBallInNet();
  const img = expanded ? netExpandedImage : netDefaultImage;
  const ready = expanded ? netExpandedReady : netDefaultReady;
  if (!ready) return;
  const NET_WIDTH_MULT = 2.1;
  const NET_X_OFFSET = 0;
  const NET_Y_OFFSET = -6;
  const width = hoop.rimRadius * NET_WIDTH_MULT;
  const aspect = img.naturalHeight / img.naturalWidth;
  const height = width * aspect;
  const x = hoop.centerX - width / 2 + NET_X_OFFSET;
  const y = hoop.rimY + NET_Y_OFFSET;
  ctx.drawImage(img, x, y, width, height);
}

/* ─── Main draw ─── */
function drawScene() {
  drawBackground();
  drawAssistGlow();
  drawAimGuide();
  drawBall();
  drawNet();
}

function render() {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  updateBallPhysics();
  drawScene();
  state.animationFrame = window.requestAnimationFrame(render);
}

/* ─── Event listeners ─── */
canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);
canvas.addEventListener("pointerleave", handlePointerUp);

startButton.addEventListener("click", beginGame);
restartButton.addEventListener("click", resetGame);
messageButton.addEventListener("click", () => {
  hideOverlay(messageOverlay);
  state.awaitingMessage = false;
  if (state.shotsMade > 0) {
    leadForm.classList.remove("hidden");
  }
});

leadForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formFeedback.textContent = "Entry submitted. Press Restart to play again.";
});

/* ─── Boot ─── */
setupCanvas();
window.addEventListener("resize", setupCanvas);
