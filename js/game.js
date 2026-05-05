/* ─── Configuration & Feature Flags ─── */
const ENABLE_BIRD = false;
const ENABLE_CROWD = false;
const TEST_MODE = false;
const SLOW_MO = 1.0;
const IS_LOCAL_ENV = ["localhost", "127.0.0.1", "::1", ""].includes(window.location.hostname);
const DEBUG_ENABLED = false;
const DEBUG_ALLOWED = DEBUG_ENABLED;
const FPS_ENABLED = new URLSearchParams(window.location.search).get("fps") === "1";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const triesLeftNode = document.getElementById("triesLeft");
const madeValueNode = document.getElementById("madeValue");
const timerValueNode = document.getElementById("timerValue");
const playCountValueNode = document.getElementById("playCountValue");
const fpsIndicator = document.getElementById("fpsIndicator");
const startOverlay = document.getElementById("startOverlay");
const introCard = startOverlay ? startOverlay.querySelector(".intro-card") : null;
const introScrollCue = document.getElementById("introScrollCue");
const messageOverlay = document.getElementById("messageOverlay");
const messageEyebrow = document.getElementById("messageEyebrow");
const messageTitle = document.getElementById("messageTitle");
const messageBody = document.getElementById("messageBody");
const messageButton = document.getElementById("messageButton");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const leadForm = document.getElementById("leadForm");
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
const muteButton = document.getElementById("muteButton");
const assistInfoOverlay = document.getElementById("assistInfoOverlay");
const assistInfoCloseButton = document.getElementById("assistInfoCloseButton");
const assistTooltipCloseButton = document.getElementById("assistTooltipCloseButton");

const HoopRushModules = window.HoopRushModules || {};
const { clamp, hashString01, hexToRgba } = HoopRushModules.utils || {};
const { createAssetSystem } = HoopRushModules.assets || {};
const { createAudioSystem } = HoopRushModules.audio || {};
const { createParticlesSystem } = HoopRushModules.particles || {};
const { createBirdSystem } = HoopRushModules.bird || {};
const { createCrowdSystem } = HoopRushModules.crowd || {};
const { createUiSystem } = HoopRushModules.ui || {};
const { createSessionSystem, loadStoredPlayCount: loadInitialPlayCount } = HoopRushModules.session || {};
const { createDebugSystem } = HoopRushModules.debug || {};
const { createDebugRimSystem } = HoopRushModules.debugRim || {};
const { createRoundFlow } = HoopRushModules.roundFlow || {};
const { createScoreFlowSystem } = HoopRushModules.scoreFlow || {};
const { createControlsSystem } = HoopRushModules.controls || {};
const { createNetSystem } = HoopRushModules.net || {};
const { createRenderSystem } = HoopRushModules.render || {};

if (
  !clamp ||
  !hashString01 ||
  !hexToRgba ||
  !createAssetSystem ||
  !createAudioSystem ||
  !createParticlesSystem ||
  !createBirdSystem ||
  !createUiSystem ||
  !createSessionSystem ||
  !loadInitialPlayCount ||
  !createRoundFlow ||
  !createScoreFlowSystem ||
  !createControlsSystem ||
  !createNetSystem ||
  !createRenderSystem
) {
  throw new Error("Hoop Rush modules failed to load. Check js/modules script order.");
}

function createNoopDebugSystem() {
  const noop = () => {};
  return {
    log: noop,
    clear: noop,
    download: noop,
    copy: () => Promise.resolve(),
    recordMarker: noop,
    pruneMarkers: noop,
    renderLog: noop,
    renderFileLog: noop,
    renderState: noop,
    isEnabled: () => false,
    setEnabled: noop,
    toggleEnabled: noop,
    entries: [],
    fileLog: [],
    markers: [],
    markerTtlMs: 0,
  };
}

function createNoopDebugRimSystem() {
  return {
    drawDebugRim: () => {},
  };
}

function updateIntroScrollCue() {
  if (!introCard || !introScrollCue) return;
  const canScroll = introCard.scrollHeight > introCard.clientHeight + 12;
  const nearTop = introCard.scrollTop < 12;
  introScrollCue.classList.toggle("hidden", !canScroll || !nearTop);
}

let particlesSystem = null;
let birdSystem = null;
let crowdSystem = null;
let audioSystem = null;
let uiSystem = null;
let sessionSystem = null;
let roundFlowSystem = null;
let scoreFlowSystem = null;
let controlsSystem = null;
let netSystem = null;
let renderSystem = null;
let debugRimSystem = null;
let debug = null;
let crowdSequenceSourceImages = null;
let crowdSequenceBuildScheduled = false;

if (introCard && introScrollCue) {
  introCard.addEventListener("scroll", updateIntroScrollCue, { passive: true });
  window.addEventListener("resize", updateIntroScrollCue);
  introCard.querySelectorAll("img").forEach((img) => {
    if (!img.complete) {
      img.addEventListener("load", updateIntroScrollCue, { once: true });
    }
  });
  window.requestAnimationFrame(updateIntroScrollCue);
}

function scheduleCrowdSequenceBuild() {
  if (!crowdSystem || !crowdSequenceSourceImages || crowdSequenceBuildScheduled) return;

  crowdSequenceBuildScheduled = true;
  const buildSequences = () => {
    crowdSequenceBuildScheduled = false;
    if (!crowdSystem || !crowdSequenceSourceImages) return;
    try {
      crowdSystem.setSequencesFromImages(crowdSequenceSourceImages);
    } catch (error) {
      console.warn("Failed to build crowd animation frames", error);
      crowdSystem.clearSequences();
    }
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => buildSequences(), { timeout: 500 });
    return;
  }

  window.setTimeout(buildSequences, 32);
}

/* ─── Image assets ─── */
const assetSystem = createAssetSystem({
  enableBird: ENABLE_BIRD,
  enableCrowd: ENABLE_CROWD,
  onAllReady: () => {
    setupCanvas();
    resetBall();
    if (birdSystem) birdSystem.reset(true);
    updateHud();
    render();
  },
  onCrowdSequencesReady: (images) => {
    crowdSequenceSourceImages = images;
    scheduleCrowdSequenceBuild();
  },
  onCrowdSequencesError: () => {
    if (crowdSystem) crowdSystem.clearSequences();
  },
});
const {
  bgImage,
  ballImage,
  ballSpinFrames,
  netFrames,
  frontHoopImage,
  birdFrames,
  startDeferredAssetLoads,
} = assetSystem;

/* ─── Debug panel ─── */
if (DEBUG_ALLOWED) {
  const debugTpl = document.getElementById("debug-panel-tpl");
  if (debugTpl && debugTpl.content) {
    document.body.appendChild(debugTpl.content.cloneNode(true));
  }
}
const debugPanel = document.getElementById("debugPanel");
const debugStateNode = document.getElementById("debugState");
const debugLogNode = document.getElementById("debugLog");
const debugFileLogNode = document.getElementById("debugFileLog");
const debugClearBtn = document.getElementById("debugClear");
const debugCopyBtn = document.getElementById("debugCopy");
const debugDownloadBtn = document.getElementById("debugDownload");
const debugToggleBtn = document.getElementById("debugToggle");

/* ─── Constants ─── */
const _isTouchDevice = ("ontouchstart" in window || navigator.maxTouchPoints > 0);
const DPR = Math.min(Math.max(window.devicePixelRatio || 1, 1), _isTouchDevice ? 1.5 : 2);
const GAME_WIDTH = 420;
const GAME_HEIGHT = 760;
const GRAVITY = 0.38;
const BASE_RESET_DELAY = 900;
const SCORE_VALUE = 100;
const MAX_ATTEMPTS = 5;
const WIN_THRESHOLD = 3;
const ROUND_DURATION_MS = 5 * 60 * 1000;
const PLAY_COUNT_STORAGE_KEY = "hoopRushPlayCount";
const TARGET_FPS = 60;
const FIXED_STEP_MS = 1000 / TARGET_FPS;
const MAX_FRAME_DELTA_MS = 250;
const MAX_STEPS_PER_RENDER = 5;
const IDLE_RENDER_INTERVAL_MS = 250;

const CONTEST_TERMS_TEMPLATE_ID = "contest-terms";
const CONTEST_TERMS_PAGE = {
  title: "Όροι Διαγωνισμού",
  bodyTemplateId: CONTEST_TERMS_TEMPLATE_ID,
};
const AUX_PAGES = {
  terms: CONTEST_TERMS_PAGE,
  contest: CONTEST_TERMS_PAGE,
  privacy: CONTEST_TERMS_PAGE,
};

/* ─── State ─── */
let state = {
  started: false,
  finished: false,
  attemptsUsed: 0,
  score: 0,
  shotsMade: 0,
  playCount: loadInitialPlayCount(PLAY_COUNT_STORAGE_KEY),
  dragging: false,
  pointerStart: null,
  pointerCurrent: null,
  scoreMessage: null,
  animationFrame: null,
  justScored: false,
  assistMode: false,
  assistTooltipDismissed: false,
  awaitingMessage: false,
  timeRemainingMs: ROUND_DURATION_MS,
  timerLastTickAt: null,
};

/* ─── UI References ─── */
const assistTooltip = document.getElementById("assistTooltip");

/*
 * Hoop collision coordinates aligned to the rendered rim in the background art.
 * The background image is always scaled into the 420x760 game space, so these
 * values intentionally live in game coordinates instead of source-image pixels.
 */
const hoop = {
  centerX: GAME_WIDTH * 0.5,
  rimY: 244,
  rimRadius: 38,
  netHeight: 55,
  backboardWidth: 150,
};

const BALL_DISPLAY_RADIUS = 36;
const BALL_REST_Y = GAME_HEIGHT - 270; // 490 — raised higher for mobile viewport
const DEPTH_ANCHOR_Y = GAME_HEIGHT - 220; // 540 — original depth reference for z/scale calc
const BALL_REST_SCALE = 1.25;          // Visual scale boost at rest/drag (pre-launch only)
const HOOP_Z = 75;                     // Depth coordinate where the rim sits
const Z_TO_PX = 3.93;                  // Converts Z units into screen-space collision units
const Z_DRAG = 0.997;
const RIM_Z_HALF = 10;                 // Rim collision tolerance (±10 around HOOP_Z)
const NET_Z_HALF = 14;
const HOOP_Z_LOCK_STRENGTH = 0.18;     // Pull valid entries back to rim depth instead of ejecting them
const HOOP_Z_VELOCITY_DAMPING = 0.72;
const HOOP_GEOMETRY = {
  hoopZPx: HOOP_Z * Z_TO_PX,
  leftRimX: hoop.centerX - hoop.rimRadius,
  rightRimX: hoop.centerX + hoop.rimRadius,
  entryInset: 4,
  capturePadding: BALL_DISPLAY_RADIUS * 0.28,
  backboardLeft: hoop.centerX - hoop.backboardWidth * 0.5,
  backboardRight: hoop.centerX + hoop.backboardWidth * 0.5,
  backboardTop: hoop.rimY - 110,
};
HOOP_GEOMETRY.innerLeftRimX = HOOP_GEOMETRY.leftRimX + HOOP_GEOMETRY.entryInset;
HOOP_GEOMETRY.innerRightRimX = HOOP_GEOMETRY.rightRimX - HOOP_GEOMETRY.entryInset;
HOOP_GEOMETRY.captureLeftX = HOOP_GEOMETRY.innerLeftRimX - HOOP_GEOMETRY.capturePadding;
HOOP_GEOMETRY.captureRightX = HOOP_GEOMETRY.innerRightRimX + HOOP_GEOMETRY.capturePadding;
HOOP_GEOMETRY.backboardBottom = HOOP_GEOMETRY.backboardTop + 55;
HOOP_GEOMETRY.backboardZPx = HOOP_GEOMETRY.hoopZPx + hoop.rimRadius + 12;
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
const CROWD_SEAT_MAP_URL = "./js/seats/basketball_seat_map.json";
const CROWD_SEAT_SOURCE_SIZE = { width: 1142, height: 2048 };
const CROWD_MAX_FANS = 18;
const CROWD_RANDOM_SEED = ENABLE_CROWD ? Math.floor(Math.random() * 100000) : 0;
const CROWD_FALLBACK_SEATS = [
  { id: "seat-001", row: 1, cx: 16, cy: 512.5, scale: 0.875, area: 285 },
  { id: "seat-005", row: 2, cx: 8.5, cy: 546.5, scale: 0.875, area: 267 },
  { id: "seat-015", row: 3, cx: 1053.5, cy: 578.5, scale: 0.625, area: 206 },
  { id: "seat-047", row: 5, cx: 1070.5, cy: 878, scale: 0.833, area: 185 },
  { id: "seat-064", row: 6, cx: 106, cy: 914.5, scale: 1.042, area: 707 },
  { id: "seat-067", row: 6, cx: 1104, cy: 908, scale: 1, area: 579 },
  { id: "seat-072", row: 7, cx: 121, cy: 945.5, scale: 0.958, area: 603 },
  { id: "seat-073", row: 7, cx: 1002, cy: 944, scale: 0.917, area: 599 },
  { id: "seat-099", row: 9, cx: 32.5, cy: 1045, scale: 1.083, area: 602 },
  { id: "seat-103", row: 9, cx: 1094.5, cy: 1043.5, scale: 0.958, area: 367 },
  { id: "seat-106", row: 10, cx: 297.5, cy: 1075.5, scale: 1.125, area: 721 },
  { id: "seat-109", row: 10, cx: 426.5, cy: 1075, scale: 1, area: 713 },
  { id: "seat-113", row: 10, cx: 654, cy: 1074.5, scale: 0.958, area: 680 },
  { id: "seat-118", row: 10, cx: 878, cy: 1072, scale: 0.75, area: 422 },
  { id: "seat-120", row: 10, cx: 62.5, cy: 1075, scale: 1.083, area: 787 },
  { id: "seat-127", row: 11, cx: 332, cy: 1108, scale: 1.083, area: 806 },
  { id: "seat-134", row: 11, cx: 702.5, cy: 1107.5, scale: 1.042, area: 751 },
  { id: "seat-137", row: 11, cx: 842.5, cy: 1107.5, scale: 1.042, area: 771 },
];

const ball = {
  radius: 32,
  x: GAME_WIDTH * 0.5,
  y: BALL_REST_Y,
  prevX: GAME_WIDTH * 0.5,
  prevY: BALL_REST_Y,
  vx: 0,
  vy: 0,
  vz: 0,
  spin: 0,
  angle: 0,
  active: false,
  trail: [],
  trailIndex: 0,
  trailCount: 0,
  scored: false,
  hoopState: "outside",
  validEntry: false,
  entryFrame: null,
  clearedRimPlane: false,
  z: 0,
  zDepth: 0,
  opacity: 1.0,
  settledTime: null,
  backboardHitSoundArmed: true,
};

debug = DEBUG_ALLOWED && createDebugSystem ? createDebugSystem({
  enabled: DEBUG_ENABLED,
  nodes: {
    debugPanel,
    debugStateNode,
    debugLogNode,
    debugFileLogNode,
    debugClearBtn,
    debugCopyBtn,
    debugDownloadBtn,
    debugToggleBtn,
  },
  getState: () => state,
  getBall: () => ball,
  constants: {
    MAX_ATTEMPTS,
    WIN_THRESHOLD,
  },
}) : createNoopDebugSystem();

audioSystem = createAudioSystem({
  bgMusicSrc: "./assets/audio/bg_music.mp3",
  crowdSrc: "",
  netSrc: "./assets/audio/net.mp3",
  dropSrc: "./assets/audio/drop.mp3",
  hitSources: [
    "./assets/audio/hit_1.mp3",
    "./assets/audio/hit_2.mp3",
    "./assets/audio/hit_3.mp3",
    "./assets/audio/hit_4.mp3",
    "./assets/audio/hit_5.mp3",
  ],
  bgMusicVolume: 0.16,
  crowdVolume: 0.08,
  debug,
});
updateMuteButton();

function updateMuteButtonLayer() {
  if (!muteButton || !leadForm) return;
  const leadFormVisible = !leadForm.classList.contains("hidden");
  muteButton.classList.toggle("overlay-floating", !leadFormVisible);
}

function removeIntroMusicUnlockListeners() {
  document.removeEventListener("pointerdown", unlockIntroMusicOnInteraction, true);
  document.removeEventListener("keydown", handleIntroMusicUnlockKeydown, true);
}

function unlockIntroMusicOnInteraction() {
  if (!audioSystem) return;
  audioSystem.primeEffects();
  audioSystem.startMusic({ silentFailure: true });
  if (startDeferredAssetLoads) startDeferredAssetLoads();
  removeIntroMusicUnlockListeners();
}

function handleIntroMusicUnlockKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  unlockIntroMusicOnInteraction();
}

document.addEventListener("pointerdown", unlockIntroMusicOnInteraction, true);
document.addEventListener("keydown", handleIntroMusicUnlockKeydown, true);
updateMuteButtonLayer();

if (muteButton && leadForm) {
  const muteButtonLeadFormObserver = new MutationObserver(() => {
    updateMuteButtonLayer();
  });
  muteButtonLeadFormObserver.observe(leadForm, {
    attributes: true,
    attributeFilter: ["class"],
  });
}

particlesSystem = createParticlesSystem({ ctx });
if (ENABLE_BIRD) {
  birdSystem = createBirdSystem({
    gameWidth: GAME_WIDTH,
    flightBand: BIRD_FLIGHT_BAND,
    aspectRatio: BIRD_ASPECT_RATIO,
    frameSequence: BIRD_FRAME_SEQUENCE,
  });
}
if (ENABLE_CROWD) {
  crowdSystem = createCrowdSystem({
    ctx,
    gameWidth: GAME_WIDTH,
    gameHeight: GAME_HEIGHT,
    seatMapUrl: CROWD_SEAT_MAP_URL,
    seatSourceSize: CROWD_SEAT_SOURCE_SIZE,
    maxFans: CROWD_MAX_FANS,
    randomSeed: CROWD_RANDOM_SEED,
    fallbackSeats: CROWD_FALLBACK_SEATS,
    clamp,
    hashString01,
  });
  if (crowdSequenceSourceImages) {
    scheduleCrowdSequenceBuild();
  }
}
uiSystem = createUiSystem({
  nodes: {
    triesLeftNode,
    madeValueNode,
    timerValueNode,
    playCountValueNode,
    assistTooltip,
    messageOverlay,
    messageEyebrow,
    messageTitle,
    messageBody,
    messageButton,
    replayButton,
    auxOverlay,
    auxOverlayTitle,
    auxOverlayContent,
  },
  state,
  constants: {
    MAX_ATTEMPTS,
    WIN_THRESHOLD,
  },
  formatTimer,
  auxPages: AUX_PAGES,
});
sessionSystem = createSessionSystem({
  state,
  ball,
  constants: {
    GAME_WIDTH,
    BALL_REST_Y,
    ROUND_DURATION_MS,
    PLAY_COUNT_STORAGE_KEY,
  },
  nodes: {
    startOverlay,
    messageOverlay,
    leadForm,
    assistTooltip,
  },
  ui: uiSystem,
  debug,
  hooks: {
    resetNetAnimation,
    updateAssistButton,
  },
});
roundFlowSystem = createRoundFlow({
  state,
  ball,
  constants: {
    MAX_ATTEMPTS,
    WIN_THRESHOLD,
    TEST_MODE,
  },
  debug,
  ui: uiSystem,
  hooks: {
    resetBall,
    setAssistMode,
  },
});
scoreFlowSystem = createScoreFlowSystem({
  state,
  ball,
  constants: {
    SCORE_VALUE,
    MAX_ATTEMPTS,
    WIN_THRESHOLD,
    TEST_MODE,
    GAME_WIDTH,
    BALL_REST_Y,
  },
  debug,
  hooks: {
    updateHud,
    resetBall,
    showWinOverlay,
    showLossOverlay,
    spawnPuff: (x, y, count) => {
      if (particlesSystem) particlesSystem.spawnPuff(x, y, count);
    },
    spawnStars: (x, y, count) => {
      if (particlesSystem) particlesSystem.spawnStars(x, y, count);
    },
  },
});
controlsSystem = createControlsSystem({
  canvas,
  state,
  ball,
  hoop,
  constants: {
    GAME_WIDTH,
    GAME_HEIGHT,
    BALL_DISPLAY_RADIUS,
    GRAVITY,
    HOOP_Z,
    Z_TO_PX,
    Z_DRAG,
  },
  clamp,
  debug,
  updateHud,
  nodes: {
    assistToggleButton,
    assistTooltip,
    assistTooltipDismissButton: assistTooltipCloseButton,
    assistInfoOverlay,
  },
});
netSystem = createNetSystem({
  ctx,
  ball,
  hoop,
  netFrames,
  frontHoopImage,
  isFrontHoopReady: assetSystem.isFrontHoopReady,
  clamp,
  constants: { HOOP_Z, NET_Z_HALF },
});
renderSystem = createRenderSystem({
  ctx,
  state,
  ball,
  hoop,
  assets: {
    bgImage,
    ballImage,
    ballSpinFrames,
  },
  constants: {
    GAME_WIDTH,
    GAME_HEIGHT,
    GRAVITY,
    BALL_DISPLAY_RADIUS,
    BALL_REST_SCALE,
    DEPTH_ANCHOR_Y,
    HOOP_Z,
    NET_Z_HALF,
    Z_TO_PX,
    DRAW_STATIC_BACKGROUND: false,
  },
  clamp,
  getLaunchVector,
  hooks: {
    drawCrowd: () => {
      if (crowdSystem) crowdSystem.draw();
    },
    drawBird: () => {
      if (birdSystem) birdSystem.draw(ctx, birdFrames);
    },
    drawNet,
    drawFrontHoop,
    drawDebugRim: () => {
      if (debug.isEnabled()) drawDebugRim();
    },
  },
});

/* ─── Canvas setup ─── */
function setupCanvas() {
  canvas.width = GAME_WIDTH * DPR;
  canvas.height = GAME_HEIGHT * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (crowdSystem) crowdSystem.setup();
}

/* ─── HUD ─── */
function updateHud() {
  if (!uiSystem) return;
  uiSystem.updateHud();
}

/* ─── Overlays ─── */
function showOverlay({ eyebrow, title, body, buttonLabel, showReplay = false, variant = "" }) {
  if (!uiSystem) return;
  uiSystem.showOverlay({ eyebrow, title, body, buttonLabel, showReplay, variant });
  requestRender();
}

function hideOverlay(overlay) {
  if (!uiSystem) return;
  uiSystem.hideOverlay(overlay);
  requestRender();
}

function openAuxPage(pageKey) {
  if (!uiSystem) return;
  uiSystem.openAuxPage(pageKey);
}

function loadDeferredImages(root) {
  if (!root) return;
  root.querySelectorAll("img[data-src]").forEach((image) => {
    image.src = image.dataset.src;
    delete image.dataset.src;
  });
}

function scheduleDeferredImageLoad(root) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => loadDeferredImages(root), { timeout: 1200 });
    return;
  }
  window.setTimeout(() => loadDeferredImages(root), 250);
}

/* ─── Ball / Game reset ─── */
function resetBall() {
  if (!sessionSystem) return;
  sessionSystem.resetBall();
  ball.trailIndex = 0;
  ball.trailCount = 0;
  requestRender();
}

function resetGame() {
  if (!sessionSystem) return;
  sessionSystem.resetGame();
  requestRender();
}

function beginGame() {
  if (!sessionSystem) return;
  if (audioSystem) audioSystem.startAmbient();
  sessionSystem.beginGame();
  if (startDeferredAssetLoads) startDeferredAssetLoads();
  requestRender();
}

/* ─── Pointer helpers ─── */
function getPointerPosition(event) {
  if (!controlsSystem) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = GAME_WIDTH / rect.width;
    const scaleY = GAME_HEIGHT / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }
  return controlsSystem.getPointerPosition(event);
}

function isPointerOnBall(position) {
  if (!controlsSystem) {
    return Math.hypot(position.x - ball.x, position.y - ball.y) <= BALL_DISPLAY_RADIUS + 20;
  }
  return controlsSystem.isPointerOnBall(position);
}

function formatTimer(timeMs) {
  const totalSeconds = Math.max(0, Math.ceil(timeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getLaunchProfile(assistMode = state.assistMode) {
  if (!controlsSystem) {
    if (assistMode) {
      return {
        assistFactor: 1.15,
        horizontalScale: 0.02,
        verticalScale: 0.07,
        verticalBase: 5.5,
        spinScale: 0.008,
      };
    }
    return {
      assistFactor: 1,
      horizontalScale: 0.02,
      verticalScale: 0.063,
      verticalBase: 5.25,
      spinScale: 0.0075,
    };
  }
  return controlsSystem.getLaunchProfile(assistMode);
}

function getLaunchVector(dx, dy, assistMode = state.assistMode) {
  if (!controlsSystem) {
    const upwardPull = clamp(-dy, 20, 260);
    const profile = getLaunchProfile(assistMode);
    return {
      upwardPull,
      vx: clamp((dx * profile.horizontalScale) * profile.assistFactor, -1.8, 1.8),
      vy: clamp((-upwardPull * profile.verticalScale) * profile.assistFactor - profile.verticalBase, -18, -12),
      spin: clamp(dx * profile.spinScale, -1.5, 1.5),
    };
  }
  return controlsSystem.getLaunchVector(dx, dy, assistMode);
}

function getPredictedApexY(y, vy) {
  if (!controlsSystem) {
    if (vy >= 0) return y;
    return y - (vy * vy) / (2 * GRAVITY);
  }
  return controlsSystem.getPredictedApexY(y, vy);
}

/* ─── Pointer events ─── */
function handlePointerDown(event) {
  if (!controlsSystem) return;
  controlsSystem.handlePointerDown(event);
  requestRender();
}

function handlePointerMove(event) {
  if (!controlsSystem) return;
  controlsSystem.handlePointerMove(event);
  requestRender();
}

function launchBall() {
  if (!controlsSystem) return;
  controlsSystem.launchBall();
}

function handlePointerUp() {
  if (!controlsSystem) return;
  controlsSystem.handlePointerUp();
  requestRender();
}

/* ─── Game logic ─── */
function setAssistMode() {
  updateHud();
  updateAssistButton();
}

function updateAssistButton() {
  if (!controlsSystem) return;
  controlsSystem.updateAssistButton();
}

function toggleAssist() {
  if (!controlsSystem) return;
  loadDeferredImages(assistInfoOverlay);
  controlsSystem.toggleAssist();
  requestRender();
}

function updateMuteButton() {
  if (!muteButton || !audioSystem) return;
  const muted = audioSystem.isMuted();
  muteButton.setAttribute("aria-pressed", muted ? "true" : "false");
  muteButton.setAttribute("aria-label", muted ? "Ενεργοποίηση ήχου" : "Σίγαση ήχου");
  muteButton.title = muted ? "Ενεργοποίηση ήχου" : "Σίγαση ήχου";
}

function toggleMute() {
  if (!audioSystem) return;
  const muted = audioSystem.toggleMuted();
  updateMuteButton();
  debug.log(`audio ${muted ? "muted" : "unmuted"}`, "evt");
}

function dismissAssistTooltip() {
  if (!controlsSystem) return;
  controlsSystem.dismissAssistTooltip();
  requestRender();
}

function updateRoundTimer(now = performance.now()) {
  if (!roundFlowSystem) return;
  roundFlowSystem.updateRoundTimer(now);
}

function handleTimerExpired() {
  if (!roundFlowSystem) return;
  roundFlowSystem.handleTimerExpired();
}

function showWinOverlay() {
  if (!roundFlowSystem) return;
  roundFlowSystem.showWinOverlay();
}

function showLossOverlay(reason = "attempts") {
  if (!roundFlowSystem) return;
  roundFlowSystem.showLossOverlay(reason);
}

function concludeMiss() {
  if (!roundFlowSystem) return;
  roundFlowSystem.concludeMiss();
}

function registerScore() {
  if (!scoreFlowSystem) return;
  if (ball.scored || state.finished) return;
  if (audioSystem) audioSystem.playNet();
  scoreFlowSystem.registerScore();
}

/* ─── Physics ─── */
/* Fixed collision radius — decoupled from depth scaling so the ball's
   hitbox stays consistent regardless of arc height (Phase 4a). */
const BALL_COLLISION_RADIUS = BALL_DISPLAY_RADIUS * 0.7;
debugRimSystem = DEBUG_ALLOWED && createDebugRimSystem ? createDebugRimSystem({
  ctx,
  state,
  ball,
  hoop,
  constants: {
    DEBUG_ENABLED: () => debug.isEnabled(),
    BALL_COLLISION_RADIUS,
    BALL_DISPLAY_RADIUS,
    GAME_WIDTH,
    GAME_HEIGHT,
    HOOP_Z,
    Z_TO_PX,
    NET_Z_HALF,
  },
  debug,
  hexToRgba,
}) : createNoopDebugRimSystem();

function updateBallPhysics() {
  if (!ball.active) return;

  ball.flightTime = (ball.flightTime || 0) + 1;

  // Log ball state every 10 frames only while the debug panel is active.
  if (debug.isEnabled() && ball.flightTime % 10 === 1) {
    debug.log(`frame=${ball.flightTime} x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)} z=${ball.zDepth.toFixed(1)} vx=${ball.vx.toFixed(2)} vy=${ball.vy.toFixed(2)} vz=${ball.vz.toFixed(2)} hoop=${ball.hoopState} spin=${ball.spin.toFixed(3)}`, "info");
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
  if (state.assistMode && !ball.scored) {
    const dxToHoop = hoop.centerX - ball.x;
    const dzToHoop = HOOP_Z - ball.zDepth;
    const dyToRim = hoop.rimY - ball.y;
    const distanceToHoop3D = Math.hypot(dxToHoop, dyToRim, dzToHoop * Z_TO_PX);
    if (distanceToHoop3D < 650 && ball.y < hoop.rimY + 190) {
      const depthProgress = clamp(ball.zDepth / HOOP_Z, 0, 1);
      const magnetStrength = 0.55 + depthProgress * 0.65;
      const targetY =
        ball.clearedRimPlane || ball.vy > 0
          ? hoop.rimY + hoop.netHeight * 0.18
          : hoop.rimY - BALL_COLLISION_RADIUS * 1.12;
      const dyToTarget = targetY - ball.y;
      const zAccelLimit =
        ball.clearedRimPlane || ball.vy > -4 || ball.y < hoop.rimY + BALL_COLLISION_RADIUS
          ? 0.24
          : 0.08;
      const yAccelLimit = ball.y < hoop.rimY - BALL_COLLISION_RADIUS * 2.4 ? 0.34 : 0.22;

      ball.vx += clamp(dxToHoop * 0.0065 * magnetStrength, -0.42, 0.42);
      ball.vz += clamp(dzToHoop * 0.0038 * magnetStrength, -zAccelLimit, zAccelLimit);
      if (ball.y > hoop.rimY - BALL_COLLISION_RADIUS * 2.2 || ball.vy > -4 || ball.clearedRimPlane) {
        ball.vy += clamp(dyToTarget * 0.0023 * magnetStrength, -0.18, yAccelLimit);
      }
      if (ball.y < hoop.rimY - BALL_COLLISION_RADIUS && ball.zDepth > HOOP_Z + RIM_Z_HALF * 0.55) {
        ball.vz = Math.min(ball.vz, 0.18);
        ball.zDepth += (HOOP_Z - ball.zDepth) * 0.035;
      }
      ball.vx *= 0.992;
      ball.vz *= 0.992;
    }
  }

  /* ── Velocity Verlet integration (Phase 3a) ── */
  ball.x += ball.vx * SLOW_MO;
  ball.y += ball.vy * SLOW_MO + 0.5 * GRAVITY * SLOW_MO * SLOW_MO;
  ball.vy += GRAVITY * SLOW_MO;

  /* Z depth: advance toward hoop with mild drag to prevent overshoot */
  ball.vz *= Z_DRAG;
  ball.zDepth += ball.vz * SLOW_MO;
  if (ball.zDepth < 0) ball.zDepth = 0;

  if (ball.active) {
    ball.z = clamp((DEPTH_ANCHOR_Y - ball.y) / Z_TO_PX, 0, 110);
  }

  /* ── Trail recording ── */
  const MAX_TRAIL = 10;
  let trailPoint = ball.trail[ball.trailIndex];
  if (!trailPoint) {
    trailPoint = { x: 0, y: 0, scale: 1, angle: 0 };
    ball.trail[ball.trailIndex] = trailPoint;
  }
  trailPoint.x = ball.x;
  trailPoint.y = ball.y;
  trailPoint.scale = getDynamicScale();
  trailPoint.angle = ball.angle;
  ball.trailIndex = (ball.trailIndex + 1) % MAX_TRAIL;
  ball.trailCount = Math.min((ball.trailCount || 0) + 1, MAX_TRAIL);

  /* ── Collision geometry ── */
  const effR = BALL_COLLISION_RADIUS; // Fixed radius (Phase 4a)

  const rimY = hoop.rimY;
  const { captureLeftX, captureRightX } = HOOP_GEOMETRY;
  const ballBottomAtRimCheck = ball.y + effR;
  const prevBallBottomAtRimCheck = ball.prevY + effR;
  if (ballBottomAtRimCheck <= rimY) {
    ball.clearedRimPlane = true;
  }

  /* ── Pre-entry z-attraction ──
     Pull z toward HOOP_Z when ball is descending into the mouth zone but
     drifting depth-wise (e.g. after a rim deflection). Without this, marginal
     shots that visually swish can fail the atHoopDepth gate and never register. */
  if (
    ball.hoopState === "outside" &&
    ball.vy > 0 &&
    ball.x > captureLeftX &&
    ball.x < captureRightX &&
    ball.y >= rimY - effR * 1.5 &&
    ball.y <= rimY + hoop.netHeight * 0.4 &&
    Math.abs(ball.zDepth - HOOP_Z) < NET_Z_HALF * 1.5
  ) {
    ball.zDepth += (HOOP_Z - ball.zDepth) * 0.25;
    ball.vz *= 0.6;
  }

  /* ── Z-depth gate for hoop-plane interactions ── */
  const atHoopDepth = Math.abs(ball.zDepth - HOOP_Z) < RIM_Z_HALF;
  const nearHoopDepth = Math.abs(ball.zDepth - HOOP_Z) < RIM_Z_HALF * 1.45;
  const hasClearedRimPlane = ball.clearedRimPlane || prevBallBottomAtRimCheck <= rimY;

  /* ── Entry detection: ball descending into mouth (Z-gated) ── */
  const descendingIntoMouth =
    ball.vy > 0 &&
    atHoopDepth &&
    hasClearedRimPlane &&
    ball.y >= rimY - effR * 0.55 &&
    ball.y <= rimY + hoop.netHeight * 0.24 &&
    ball.x > captureLeftX &&
    ball.x < captureRightX;

  if (ball.hoopState === "outside" && descendingIntoMouth) {
    ball.hoopState = "entering";
    ball.validEntry = true;
    ball.entryFrame = ball.flightTime;
    ball.clearedRimPlane = true;
    debug.recordMarker({
      x: ball.x,
      y: ball.y,
      type: "entry",
      label: "E",
      color: "#4dd0e1",
      detail: "entering-mouth",
    });
    debug.log(
      `entering-mouth x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)} z=${ball.zDepth.toFixed(1)} vy=${ball.vy.toFixed(2)} capture=[${captureLeftX.toFixed(1)},${captureRightX.toFixed(1)}]`,
      "evt"
    );
  }

  /* ── True 3D Torus Collision ──
     The rim is treated as a mathematically perfect 3D ring at y = hoop.rimY.
     This replaces the 24-point 2D ellipse approximation. */
  const hoopZPx = HOOP_GEOMETRY.hoopZPx;
  let ballZPx = ball.zDepth * Z_TO_PX;
  const dXZ = Math.hypot(ball.x - hoop.centerX, ballZPx - hoopZPx);
  const dy = ball.y - hoop.rimY;
  const dist3D = Math.hypot(dXZ - hoop.rimRadius, dy);
  const framesSinceEntryForCollision = ball.entryFrame ? ball.flightTime - ball.entryFrame : 999;
  const entryGraceForCollision = ball.hoopState === "entering" && framesSinceEntryForCollision <= 12;
  const ballBottomForHoop = ball.y + effR;
  const committedDrop =
    ball.validEntry &&
    (ball.vy > 0 || entryGraceForCollision) &&
    ballBottomForHoop >= rimY - 2 &&
    ball.y <= rimY + hoop.netHeight * 0.65 &&
    ball.x > captureLeftX &&
    ball.x < captureRightX &&
    nearHoopDepth;

  let rimHit = false;

  if (!committedDrop && dist3D < effR && dist3D > 0) {
    rimHit = true;
    let closestX, closestZ;
    if (dXZ === 0) {
      closestX = hoop.centerX + hoop.rimRadius;
      closestZ = hoopZPx;
    } else {
      closestX = hoop.centerX + ((ball.x - hoop.centerX) / dXZ) * hoop.rimRadius;
      closestZ = hoopZPx + ((ballZPx - hoopZPx) / dXZ) * hoop.rimRadius;
    }
    const closestY = hoop.rimY;

    const nx = (ball.x - closestX) / dist3D;
    const ny = (ball.y - closestY) / dist3D;
    const nz = (ballZPx - closestZ) / dist3D;
    const overlap = effR - dist3D;

    if (state.assistMode) {
      if (ball.vy < 0 && ball.y < hoop.rimY) {
        // Suppress collisions when rising cleanly above the rim plane.
      } else if (ball.vy < 0 && ball.y >= hoop.rimY - 15) {
        // Nudge over the rim when rising near it, without changing entry state.
        ball.vy = Math.min(ball.vy, -0.2);
        ball.vx += clamp((hoop.centerX - ball.x) * 0.08, -0.45, 0.45);
        ball.vz += clamp((HOOP_Z - ball.zDepth) * 0.08, -0.45, 0.45);
        debug.recordMarker({
          x: closestX, y: closestY, type: "rim", label: "R↑", color: "#ffb74d", detail: "assist-rising-nudge",
        });
      } else if (ball.y <= hoop.rimY + 6) {
        // Guide falling rim contact toward the mouth. Normal X/Y/Z gates still decide entry.
        ball.vx += clamp((hoop.centerX - ball.x) * 0.12, -0.55, 0.55);
        ball.vz += clamp((HOOP_Z - ball.zDepth) * 0.12, -0.55, 0.55);
        ball.vy = Math.max(ball.vy, 0.25);
        ball.x += clamp((hoop.centerX - ball.x) * 0.12, -overlap, overlap);
        ball.zDepth += clamp((HOOP_Z - ball.zDepth) * 0.12, -overlap / Z_TO_PX, overlap / Z_TO_PX);
        debug.recordMarker({
          x: closestX, y: closestY, type: "rim", label: "R→", color: "#ab47bc", detail: "assist-falling-guide",
        });
      } else {
        // Deflect off the bottom of the rim
        ball.x += nx * overlap;
        ball.y += ny * overlap;
        ball.zDepth += (nz * overlap) / Z_TO_PX;
        ball.vx *= 0.4;
        ball.vy *= 0.3;
        ball.vz *= 0.4;
        debug.recordMarker({
          x: closestX, y: closestY, type: "rim", label: "R↓", color: "#ef5350", detail: "under-rim-deflect",
        });
      }
    } else {
      // Normal 3D collision response
      ball.x += nx * overlap;
      ball.y += ny * overlap;
      ball.zDepth += (nz * overlap) / Z_TO_PX;

      const vzPx = ball.vz * Z_TO_PX;
      const vDotN = ball.vx * nx + ball.vy * ny + vzPx * nz;

      debug.recordMarker({
        x: closestX, y: closestY, type: "rim", label: "R", color: "#ff6b6b", detail: "rim-hit",
      });

      if (vDotN < 0) {
        const restitution = 0.22;
        ball.vx -= (1 + restitution) * vDotN * nx;
        ball.vy -= (1 + restitution) * vDotN * ny;
        const newVzPx = vzPx - (1 + restitution) * vDotN * nz;
        ball.vz = newVzPx / Z_TO_PX;
      }
    }
  }

  /* Stalled-on-rim nudge */
  const rimSpeed = Math.hypot(ball.vx, ball.vy, ball.vz * Z_TO_PX);
  if (ball.hoopState === "outside" && rimSpeed < 2.5 && dist3D < effR * 1.5 && ball.y < hoop.rimY + effR * 1.3) {
    if (dXZ < hoop.rimRadius * 0.65) {
      ball.vx += (hoop.centerX - ball.x) * 0.005;
      ball.vz += (HOOP_Z - ball.zDepth) * 0.005;
      ball.vy = Math.max(ball.vy, 0.1);
    } else {
      ball.vx += ball.x < hoop.centerX ? -0.1 : 0.1;
      ball.vz += ball.zDepth < HOOP_Z ? -0.1 : 0.1;
      ball.vy = Math.max(ball.vy, 0.1);
    }
  }
  if (ball.zDepth < 0) ball.zDepth = 0;
  ballZPx = ball.zDepth * Z_TO_PX;

  /* ── Backboard (3D Plane) ── */
  const backboardZPx = HOOP_GEOMETRY.backboardZPx;
  const atBackboardDepth = ballZPx + effR >= backboardZPx && ballZPx - effR <= backboardZPx + 20;
  const {
    backboardLeft,
    backboardRight,
    backboardTop,
    backboardBottom,
  } = HOOP_GEOMETRY;
  const prevBallTop = ball.prevY - effR;
  const ballTop = ball.y - effR;
  const backboardSoundTriggerBottom = backboardBottom + effR + 60;
  
  const hitsBackboardX = ball.x + effR > backboardLeft && ball.x - effR < backboardRight;
  const hitsBackboardY = ball.y + effR > backboardTop && ball.y - effR < backboardBottom;
  
  const assistedCleanLane =
    state.assistMode &&
    Math.abs(ball.x - hoop.centerX) < hoop.rimRadius * 0.9 &&
    Math.abs(ball.zDepth - HOOP_Z) <= RIM_Z_HALF * 1.1 &&
    ball.y < rimY + hoop.netHeight * 0.12;

  // We allow hitting the backboard on the way down now, but mostly it happens when rising or at the apex.
  // Assisted clean-lane shots should be guided through the mouth instead of rebounding off the board plane.
  const hitsBackboardPlane = !assistedCleanLane && atBackboardDepth && hitsBackboardX && hitsBackboardY && ball.vz > 0;
  
  const backboardNearContact =
    atBackboardDepth &&
    hitsBackboardX &&
    prevBallTop > backboardSoundTriggerBottom &&
    ballTop <= backboardSoundTriggerBottom;

  function playBackboardHitSound() {
    if (ball.backboardHitSoundArmed === false) return;
    ball.backboardHitSoundArmed = false;
    if (audioSystem) audioSystem.playRandomHit();
  }

  if (!hitsBackboardPlane) {
    ball.backboardHitSoundArmed = true;
  }
  if (backboardNearContact) {
    playBackboardHitSound();
  }

  let backboardHit = false;
  if (hitsBackboardPlane) {
    const incomingVy = ball.vy;
    const incomingVz = ball.vz;
    const backboardHitX = clamp(ball.x, backboardLeft, backboardRight);
    const backboardHitY = clamp(ball.y - effR, backboardTop, backboardBottom);
    
    // Reflect velocities
    ball.vy = ball.vy < 0 ? Math.abs(ball.vy) * 0.38 : ball.vy * 0.8;
    ball.vx *= 0.82;
    ball.vz = -Math.abs(ball.vz) * 0.6; // Bounce back in Z
    
    // Prevent getting stuck behind the backboard
    ball.zDepth = (backboardZPx - effR - 1) / Z_TO_PX;
    
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
      `backboard.hit contact=(${backboardHitX.toFixed(1)},${backboardHitY.toFixed(1)}) box=[${backboardLeft.toFixed(1)},${backboardTop.toFixed(1)}]-[${backboardRight.toFixed(1)},${backboardBottom.toFixed(1)}] ball=(${ball.x.toFixed(1)},${ball.y.toFixed(1)}) vy=${incomingVy.toFixed(2)}→${ball.vy.toFixed(2)} vz=${incomingVz.toFixed(2)}→${ball.vz.toFixed(2)}`,
      "warn"
    );
  }

  /* Post-collision speed cap */
  if (rimHit || backboardHit) {
    const MAX_POST_HIT_SPEED = 8;
    const sp = Math.hypot(ball.vx, ball.vy, ball.vz * Z_TO_PX);
    if (sp > MAX_POST_HIT_SPEED) {
      const k = MAX_POST_HIT_SPEED / sp;
      ball.vx *= k;
      ball.vy *= k;
      ball.vz *= k;
    }
  }

  /* ── Top-down crossing detection (3D-gated) ── */
  const ballBottom = ball.y + effR;
  const prevBallBottom = ball.prevY + effR;
  const atHoopDepthCrossing = Math.abs(ball.zDepth - HOOP_Z) < RIM_Z_HALF;
  const crossedRimFromAbove =
    atHoopDepthCrossing &&
    prevBallBottom <= rimY &&
    ballBottom > rimY &&
    ball.vy > 0 &&
    ball.x > captureLeftX &&
    ball.x < captureRightX;

  if (ball.hoopState === "outside" && crossedRimFromAbove) {
    ball.hoopState = "entering";
    ball.validEntry = true;
    ball.entryFrame = ball.flightTime;
    ball.clearedRimPlane = true;
    debug.recordMarker({
      x: ball.x,
      y: rimY,
      type: "cross",
      label: "X",
      color: "#80cbc4",
      detail: "top-down-crossing",
    });
    debug.log(
      `top-down crossing x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)} z=${ball.zDepth.toFixed(1)} bottom=${ballBottom.toFixed(1)} prevBottom=${prevBallBottom.toFixed(1)}`,
      "evt"
    );
  }

  /* ── Phase 1a: Centering BEFORE exit check ──
     This prevents the ball from being falsely ejected from "entering"
     state due to a momentary horizontal offset before centering corrects it. */
  if (ball.hoopState === "entering" || ball.hoopState === "scored") {
    const insideNet = ball.y < hoop.rimY + hoop.netHeight;
    if (insideNet) {
      const ballBottomInNet = ball.y + effR;
      const entryGraceActive = ball.entryFrame ? ball.flightTime - ball.entryFrame <= 12 : false;
      ball.x += (hoop.centerX - ball.x) * 0.22;
      ball.vx *= 0.55;
      if (ball.vy > 0) {
        ball.vy = Math.min(ball.vy, 4.5);
      } else if (entryGraceActive && ballBottomInNet >= rimY - 4) {
        ball.vy = Math.max(ball.vy * 0.25, 0.2);
      }
      ball.zDepth += (HOOP_Z - ball.zDepth) * HOOP_Z_LOCK_STRENGTH;
      ball.vz *= HOOP_Z_VELOCITY_DAMPING;
    }
  }

  /* ── Exit check (simplified with Z-gating) ──
     Z naturally prevents re-collisions after the ball passes through.
     Only revert to "outside" if the ball genuinely moves back above the rim
     or exits the capture zone horizontally before going deep. */
  if (ball.hoopState === "entering") {
    const framesSinceEntry = ball.entryFrame ? ball.flightTime - ball.entryFrame : 999;
    const entryGraceActive = framesSinceEntry <= 12;
    const ballBottom = ball.y + effR;
    const movedBackAboveRim = !entryGraceActive && ball.vy < 0 && ballBottom < rimY - 8;
    const shallowInNet = ball.y < rimY + hoop.netHeight * 0.12;
    const deepEnoughToCommit = ball.y >= rimY - 2 && ball.y <= rimY + hoop.netHeight * 0.65;
    const exitedMouthHorizontally =
      !deepEnoughToCommit &&
      shallowInNet &&
      (ball.x <= captureLeftX || ball.x >= captureRightX);
    if (movedBackAboveRim || exitedMouthHorizontally) {
      debug.log(`exit-entering reason=${movedBackAboveRim ? "above-rim" : "horizontal"} x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)} z=${ball.zDepth.toFixed(1)} vy=${ball.vy.toFixed(2)}`, "warn");
      ball.hoopState = "outside";
      ball.entryFrame = null;
    }
  }

  /* ── Score registration ── */
  const atNetDepthForScore = Math.abs(ball.zDepth - HOOP_Z) <= NET_Z_HALF;
  if (
    !ball.scored &&
    ball.validEntry &&
    ball.hoopState === "entering" &&
    ball.vy > 0 &&
    ball.y >= rimY + hoop.netHeight * 0.35 &&
    atNetDepthForScore &&
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
      `score-trigger x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)} z=${ball.zDepth.toFixed(1)} scoreDepth=${(rimY + hoop.netHeight * 0.35).toFixed(1)} zDepth=[${(HOOP_Z - NET_Z_HALF).toFixed(1)},${(HOOP_Z + NET_Z_HALF).toFixed(1)}] capture=[${captureLeftX.toFixed(1)},${captureRightX.toFixed(1)}]`,
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
          if (audioSystem) audioSystem.playDrop();
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
/* ═══════════════════════════════════════════════
   DRAWING — Image-based rendering
   ═══════════════════════════════════════════════ */

function drawBackground() {
  if (!renderSystem) return;
  renderSystem.drawBackground();
}

function depthScale(z) {
  if (!renderSystem) {
    const t = clamp(z / 130.5, 0, 1.6);
    return 1 - Math.pow(t, 0.85) * 0.6;
  }
  return renderSystem.depthScale(z);
}

function getDynamicScale() {
  if (!renderSystem) {
    if (ball.hoopState === "entering" || ball.hoopState === "scored") {
      return depthScale(HOOP_Z);
    }
    if (!ball.active && !ball.scored) {
      return BALL_REST_SCALE;
    }
    return depthScale(ball.zDepth);
  }
  return renderSystem.getDynamicScale();
}

function drawBallGlow() {
  if (!renderSystem) return;
  renderSystem.drawBallGlow();
}

function drawBallShadowAndTrail() {
  if (!renderSystem) return;
  renderSystem.drawBallShadowAndTrail();
}

function drawBallSprite() {
  if (!renderSystem) return;
  renderSystem.drawBallSprite();
}

function drawAimGuide() {
  if (!renderSystem) return;
  renderSystem.drawAimGuide();
}

function drawScoreMessage() {
  if (!renderSystem) return;
  renderSystem.drawScoreMessage();
}

function drawAssistGlow() {
  if (!renderSystem) return;
  renderSystem.drawAssistGlow();
}

function resetNetAnimation() {
  if (!netSystem) return;
  netSystem.resetNetAnimation();
}

function isBallDrivingNet() {
  if (!netSystem) return false;
  return netSystem.isBallDrivingNet();
}

function updateNetAnimation() {
  if (!netSystem) return;
  netSystem.updateNetAnimation();
}

function drawNet() {
  if (!netSystem) return;
  netSystem.drawNet();
}

function drawFrontHoop() {
  if (!netSystem) return;
  netSystem.drawFrontHoop();
}

function drawDebugRim() {
  if (!debugRimSystem) return;
  debugRimSystem.drawDebugRim();
}

/* ─── Main draw ─── */
function drawScene() {
  if (!renderSystem) return;
  renderSystem.drawScene();
}

let lastFrameTimeMs = null;
let simulationClockMs = null;
let simulationAccumulatorMs = 0;
let renderDelayTimer = 0;
let renderDirty = true;
let fpsSampleStartMs = 0;
let fpsFrameCount = 0;
let fpsLastValue = 0;

if (fpsIndicator) {
  fpsIndicator.hidden = !FPS_ENABLED;
}

function hasActiveRenderWork() {
  return Boolean(
    ball.active ||
    state.dragging ||
    state.scoreMessage ||
    (particlesSystem && particlesSystem.hasParticles && particlesSystem.hasParticles()) ||
    (netSystem && netSystem.isAnimating && netSystem.isAnimating()) ||
    birdSystem
  );
}

function shouldTickIdleTimer() {
  return state.started && !state.finished;
}

function requestRender() {
  renderDirty = true;
  if (state.animationFrame || renderDelayTimer) return;
  state.animationFrame = window.requestAnimationFrame(render);
}

function scheduleNextRender() {
  state.animationFrame = null;
  if (hasActiveRenderWork()) {
    state.animationFrame = window.requestAnimationFrame(render);
    return;
  }
  if (shouldTickIdleTimer()) {
    renderDelayTimer = window.setTimeout(() => {
      renderDelayTimer = 0;
      state.animationFrame = window.requestAnimationFrame(render);
    }, IDLE_RENDER_INTERVAL_MS);
  }
}

function stepSimulation(stepNowMs) {
  if (birdSystem) birdSystem.update();
  updateBallPhysics();
  updateRoundTimer(stepNowMs);
  updateNetAnimation();
  if (particlesSystem) particlesSystem.update();
}

function updateFpsIndicator(now) {
  if (!FPS_ENABLED || !fpsIndicator) return;
  if (!fpsSampleStartMs) {
    fpsSampleStartMs = now;
    fpsFrameCount = 0;
    return;
  }

  fpsFrameCount += 1;
  const elapsed = now - fpsSampleStartMs;
  if (elapsed < 500) return;

  fpsLastValue = Math.round((fpsFrameCount * 1000) / elapsed);
  fpsIndicator.textContent = `FPS ${fpsLastValue}`;
  fpsSampleStartMs = now;
  fpsFrameCount = 0;
}

function render(now = performance.now()) {
  updateFpsIndicator(now);

  if (lastFrameTimeMs === null) {
    lastFrameTimeMs = now;
    simulationClockMs = now;
  }

  const activeWork = hasActiveRenderWork();
  if (!activeWork && shouldTickIdleTimer()) {
    lastFrameTimeMs = now;
    simulationClockMs = now;
    simulationAccumulatorMs = 0;
    updateRoundTimer(now);
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    drawScene();
    if (debug.isEnabled()) {
      debug.renderState();
    }
    renderDirty = false;
    scheduleNextRender();
    return;
  }

  const frameDeltaMs = clamp(now - lastFrameTimeMs, 0, MAX_FRAME_DELTA_MS);
  lastFrameTimeMs = now;
  simulationAccumulatorMs += frameDeltaMs;

  let steps = 0;
  while (simulationAccumulatorMs >= FIXED_STEP_MS && steps < MAX_STEPS_PER_RENDER) {
    simulationClockMs += FIXED_STEP_MS;
    stepSimulation(simulationClockMs);
    simulationAccumulatorMs -= FIXED_STEP_MS;
    steps += 1;
  }

  if (steps === MAX_STEPS_PER_RENDER && simulationAccumulatorMs >= FIXED_STEP_MS) {
    simulationAccumulatorMs = 0;
  }

  if (steps === 0 && !renderDirty) {
    scheduleNextRender();
    return;
  }

  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  drawScene();
  if (particlesSystem) particlesSystem.draw();
  if (debug.isEnabled()) {
    debug.renderState();
  }
  renderDirty = false;
  scheduleNextRender();
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
  requestRender();
});
restartCancelButton.addEventListener("click", () => {
  restartConfirmOverlay.classList.remove("visible");
  requestRender();
});
restartConfirmButton.addEventListener("click", () => {
  restartConfirmOverlay.classList.remove("visible");
  resetGame();
});
helpButton.addEventListener("click", () => {
  loadDeferredImages(helpOverlay);
  helpOverlay.classList.add("visible");
  requestRender();
});
helpCloseButton.addEventListener("click", () => {
  if (!state.started) {
    beginGame();
    helpOverlay.classList.remove("visible");
    requestRender();
    return;
  }
  helpOverlay.classList.remove("visible");
  requestRender();
});
if (assistToggleButton) {
  assistToggleButton.addEventListener("click", toggleAssist);
}
if (muteButton) {
  muteButton.addEventListener("click", toggleMute);
}
if (assistTooltipCloseButton) {
  assistTooltipCloseButton.addEventListener("click", dismissAssistTooltip);
}
if (assistInfoCloseButton) {
  assistInfoCloseButton.addEventListener("click", () => {
    assistInfoOverlay.classList.remove("visible");
    requestRender();
  });
}

window.addEventListener("load", () => {
  scheduleDeferredImageLoad(startOverlay);
}, { once: true });
auxCloseButton.addEventListener("click", () => {
  if (uiSystem) {
    uiSystem.hideAuxOverlay();
  } else {
    auxOverlay.classList.remove("visible");
  }
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

/* ─── Debug modal triggers ─── */
if (DEBUG_ALLOWED) {
  document.querySelectorAll("[data-dbg-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!debug.isEnabled()) return;
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
            eyebrow: "",
            title: "3/3! Είσαι μέσα!",
            body: "Είσαι ένα βήμα πριν την συμμετοχή σου στην κλήρωση!",
            buttonLabel: "Διεκδίκησε το δώρο σου",
            showReplay: true,
            variant: "win",
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
        default:
          break;
      }
    });
  });

  const dbgHideAll = document.getElementById("dbgHideAll");
  if (dbgHideAll) {
    dbgHideAll.addEventListener("click", () => {
      if (!debug.isEnabled()) return;
      startOverlay.classList.remove("visible");
      helpOverlay.classList.remove("visible");
      restartConfirmOverlay.classList.remove("visible");
      messageOverlay.classList.remove("visible");
      auxOverlay.classList.remove("visible");
      leadForm.classList.add("hidden");
      state.awaitingMessage = false;
      requestRender();
    });
  }
}

/* ─── Boot ─── */
setupCanvas();
let _resizeTimerId = 0;
window.addEventListener("resize", () => {
  clearTimeout(_resizeTimerId);
  _resizeTimerId = setTimeout(() => {
    setupCanvas();
    requestRender();
  }, 150);
});

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
