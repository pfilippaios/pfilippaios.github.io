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
let assetsLoaded = 0;
const TOTAL_ASSETS = 5;

function onAssetLoad() {
  assetsLoaded++;
  if (assetsLoaded >= TOTAL_ASSETS) {
    setupCanvas();
    resetGame();
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

/* ─── Constants ─── */
const DPR = Math.max(window.devicePixelRatio || 1, 1);
const GAME_WIDTH = 420;
const GAME_HEIGHT = 760;
const GRAVITY = 0.28;
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
  rimY: 247,
  rimRadius: 38,
  netHeight: 55,
  backboardWidth: 150,
};

const BALL_DISPLAY_RADIUS = 38;

const ball = {
  radius: 30, // collision radius (smaller than display)
  x: GAME_WIDTH * 0.5,
  y: GAME_HEIGHT - 120,
  prevX: GAME_WIDTH * 0.5,
  prevY: GAME_HEIGHT - 120,
  vx: 0,
  vy: 0,
  active: false,
  trail: [],
  scored: false,
  hoopState: "outside",
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
  ball.prevX = ball.x;
  ball.prevY = ball.y;
  ball.vx = 0;
  ball.vy = 0;
  ball.active = false;
  ball.scored = false;
  ball.trail = [];
  ball.hoopState = "outside";
  state.justScored = false;
  state.dragging = false;
  state.pointerStart = null;
  state.pointerCurrent = null;
}

function resetGame() {
  state.started = true;
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
  startOverlay.classList.remove("visible");
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
  if (!state.started || ball.active || state.awaitingMessage || state.shotsMade > 0) return;
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
  ball.vx = clamp((-dx * 0.14) * assistFactor, -14, 14);
  // Significantly increased power limit from -34 to -55
  ball.vy = clamp((-upwardPull * 0.18) * assistFactor - 6, -55, -16);
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
  // Active for shots 2 and 3
  state.assistMode = state.attemptsUsed >= 1;
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
  ball.hoopState = "scored";
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

  ball.prevX = ball.x;
  ball.prevY = ball.y;

  if (state.assistMode) {
    const dxToHoop = hoop.centerX - ball.x;
    const dyToHoop = hoop.rimY - ball.y;
    const distanceToHoop = Math.hypot(dxToHoop, dyToHoop);
    // Even more range (from 300 to 450) and double the pull strength
    if (distanceToHoop < 450 && ball.y < hoop.rimY + 150) {
      ball.vx += dxToHoop * 0.0022;
      ball.vy += dyToHoop * 0.0010;
    }
  }

  ball.vy += GRAVITY * SLOW_MO;
  ball.x += ball.vx * SLOW_MO;
  ball.y += ball.vy * SLOW_MO;
  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > 14) ball.trail.shift();

  // Effective radius scales with depth so visual matches collision
  const scale = depthScale(ball.y);
  const effR = ball.radius * scale;

  const leftRimX = hoop.centerX - hoop.rimRadius;
  const rightRimX = hoop.centerX + hoop.rimRadius;
  const rimY = hoop.rimY;
  // Reduced entryInset from 10 to 4 to make the mouth wider/easier
  const entryInset = 4;
  const innerLeftRimX = leftRimX + entryInset;
  const innerRightRimX = rightRimX - entryInset;

  // Rim as two fixed points — circle-vs-point collision with proper reflection
  function collideRimPoint(px, py) {
    const dx = ball.x - px;
    const dy = ball.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist === 0 || dist >= effR) return;
    const nx = dx / dist;
    const ny = dy / dist;
    // Push ball out of overlap
    const overlap = effR - dist;
    ball.x += nx * overlap;
    ball.y += ny * overlap;
    // Reflect velocity along normal, damped
    const vDotN = ball.vx * nx + ball.vy * ny;
    if (vDotN < 0) {
      // Much lower restitution in assist mode (0.2 instead of 0.6) so it "sticks" to the hoop instead of bouncing out
      const restitution = state.assistMode ? 0.2 : 0.6;
      ball.vx = (ball.vx - 2 * vDotN * nx) * restitution;
      ball.vy = (ball.vy - 2 * vDotN * ny) * restitution;
    }
  }
  // 3D Rim Collision — 24 points around the rim ellipse to prevent tunneling at higher velocities
  const p = 0.3; // perspective factor (rim height vs width)
  const rimPoints = 24;
  for (let i = 0; i < rimPoints; i++) {
    const angle = (i / rimPoints) * Math.PI * 2;
    const px = hoop.centerX + Math.cos(angle) * hoop.rimRadius;
    const py = hoop.rimY + Math.sin(angle) * hoop.rimRadius * p;
    collideRimPoint(px, py);
  }

  // Backboard — horizontal bar above rim. Reflect on bottom face when ball rising.
  const backboardLeft = hoop.centerX - hoop.backboardWidth * 0.5;
  const backboardRight = hoop.centerX + hoop.backboardWidth * 0.5;
  const backboardTop = rimY - 110;
  const backboardBottom = backboardTop + 18;
  const hitsBackboardX = ball.x + effR > backboardLeft && ball.x - effR < backboardRight;
  if (hitsBackboardX && ball.vy < 0 && ball.y - effR < backboardBottom && ball.y - effR > backboardTop) {
    ball.y = backboardBottom + effR;
    ball.vy = Math.abs(ball.vy) * 0.5;
    ball.vx *= 0.85;
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
  }

  if (ball.hoopState === "entering") {
    const movedBackAboveRim = ball.vy < 0 && ball.y <= rimY;
    const exitedMouthHorizontally = ball.x <= innerLeftRimX || ball.x >= innerRightRimX;
    if (movedBackAboveRim || exitedMouthHorizontally) {
      ball.hoopState = "outside";
    }
  }

  // Score only after a confirmed top-down hoop entry.
  if (
    !ball.scored &&
    ball.hoopState === "entering" &&
    ball.vy > 0 &&
    ball.y >= rimY + hoop.netHeight * 0.35 &&
    ball.x > innerLeftRimX &&
    ball.x < innerRightRimX
  ) {
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
  
  // Base scale from vertical position (stateless)
  const t = clamp((groundY - y) / (groundY - horizonY), 0, 1);
  return 1 - Math.pow(t, 0.85) * 0.75;
}

function getDynamicScale(y) {
  const baseScale = depthScale(y);
  
  // Velocity-based "push" to depth only for active sprite
  const vyFactor = clamp(ball.vy * 0.003, -0.05, 0.05);
  return baseScale - vyFactor;
}

function drawBallShadowAndTrail() {
  // Trail — stateless depth scale
  ball.trail.forEach((point, index) => {
    const alpha = (index / ball.trail.length) * 0.15;
    ctx.globalAlpha = alpha;
    const trailScale = depthScale(point.y);
    const trailR = BALL_DISPLAY_RADIUS * 1.3 * trailScale;
    ctx.drawImage(ballImage, point.x - trailR, point.y - trailR, trailR * 2, trailR * 2);
  });
  ctx.globalAlpha = 1;

  // Shadow on ground
  if (ball.y < GAME_HEIGHT - 80) {
    const scale = depthScale(ball.y);
    const shadowY = GAME_HEIGHT - 50;
    const shadowScale = Math.max(0.3, 1 - (shadowY - ball.y) / 600) * scale;
    ctx.fillStyle = `rgba(0, 0, 0, ${0.18 * shadowScale})`;
    ctx.beginPath();
    ctx.ellipse(ball.x, shadowY, BALL_DISPLAY_RADIUS * shadowScale, BALL_DISPLAY_RADIUS * 0.25 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBallSprite() {
  const scale = getDynamicScale(ball.y);
  const r = BALL_DISPLAY_RADIUS * scale;

  // Ball sprite with squash and stretch
  ctx.save();
  ctx.translate(ball.x, ball.y);

  // Velocity magnitude for stretch
  const velMag = Math.hypot(ball.vx, ball.vy);
  const stretch = clamp(velMag * 0.008, 0, 0.15);
  const squash = 1 / (1 + stretch);
  
  // Rotate to face velocity direction
  if (velMag > 0.1) {
    ctx.rotate(Math.atan2(ball.vy, ball.vx));
  }

  // Apply shading if inside the hoop
  if (ball.hoopState === "entering" || ball.hoopState === "scored") {
    // Darken slightly as it enters the "tube" of the net
    const shadeFactor = clamp((ball.y - hoop.rimY) / hoop.netHeight, 0, 1);
    ctx.filter = `brightness(${100 - shadeFactor * 35}%) contrast(${100 + shadeFactor * 10}%)`;
  }

  ctx.drawImage(ballImage, -r * (1 + stretch), -r * squash, r * 2 * (1 + stretch), r * 2 * squash);
  ctx.restore();
  ctx.filter = "none";
}

function drawBall() {
  drawBallShadowAndTrail();
  drawBallSprite();
}

function drawAimGuide() {
  if (!state.dragging || !state.pointerStart || !state.pointerCurrent) return;
  const dx = state.pointerCurrent.x - state.pointerStart.x;
  const dy = state.pointerCurrent.y - state.pointerStart.y;
  const previewVx = clamp(-dx * 0.14, -14, 14);
  const previewVy = clamp(-clamp(-dy, 20, 260) * 0.18 - 6, -55, -16);

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

  const isEntering = ball.hoopState === "entering" || ball.hoopState === "scored";

  if (isEntering) {
    // 1. Draw net and shadow/trail (behind)
    drawNet();
    drawBallShadowAndTrail();

    // 2. Draw part of ball sprite that is BEHIND the front rim (below rimY)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, hoop.rimY, GAME_WIDTH, GAME_HEIGHT - hoop.rimY);
    ctx.clip();
    drawBallSprite();
    ctx.restore();

    // 3. Draw front rim
    drawFrontHoop();

    // 4. Draw part of ball sprite that is IN FRONT of the front rim (above rimY)
    // Only draw this if the ball center is not fully inside yet.
    // Once ball.y > rimY + 12, it is deep enough that the whole ball should be behind the front rim.
    if (ball.y < hoop.rimY + 12) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, GAME_WIDTH, hoop.rimY);
      ctx.clip();
      drawBallSprite();
      ctx.restore();
    }
  } else {
    // Standard rendering when ball is fully outside or approaching
    drawBallShadowAndTrail();
    drawNet();
    drawFrontHoop();
    drawBallSprite();
  }
  
  // Line helper rendered on top of everything
  drawAimGuide();
  
  drawDebugRim();
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
