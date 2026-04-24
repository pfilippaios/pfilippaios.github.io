/* ─── Configuration & Feature Flags ─── */
const ENABLE_BIRD = false;
const TEST_MODE = false;
const SLOW_MO = 1.0;
const DEBUG_ENABLED = false;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const triesLeftNode = document.getElementById("triesLeft");
const madeValueNode = document.getElementById("madeValue");
const timerValueNode = document.getElementById("timerValue");
const playCountValueNode = document.getElementById("playCountValue");
const startOverlay = document.getElementById("startOverlay");
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
  !createCrowdSystem ||
  !createUiSystem ||
  !createSessionSystem ||
  !loadInitialPlayCount ||
  !createDebugSystem ||
  !createDebugRimSystem ||
  !createRoundFlow ||
  !createScoreFlowSystem ||
  !createControlsSystem ||
  !createNetSystem ||
  !createRenderSystem
) {
  throw new Error("Hoop Rush modules failed to load. Check js/modules script order.");
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
} = assetSystem;

/* ─── Debug panel ─── */
const debugPanel = document.getElementById("debugPanel");
const debugStateNode = document.getElementById("debugState");
const debugLogNode = document.getElementById("debugLog");
const debugFileLogNode = document.getElementById("debugFileLog");
const debugClearBtn = document.getElementById("debugClear");
const debugCopyBtn = document.getElementById("debugCopy");
const debugDownloadBtn = document.getElementById("debugDownload");
const debugToggleBtn = document.getElementById("debugToggle");

/* ─── Constants ─── */
const DPR = Math.max(window.devicePixelRatio || 1, 1);
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
const CROWD_SEAT_MAP_URL = "./js/seats/basketball_seat_map.json";
const CROWD_SEAT_SOURCE_SIZE = { width: 1142, height: 2048 };
const CROWD_MAX_FANS = 18;
const CROWD_RANDOM_SEED = Math.floor(Math.random() * 100000);
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
  backboardHitSoundArmed: true,
};

debug = createDebugSystem({
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
});

audioSystem = createAudioSystem({
  bgMusicSrc: "./assets/audio/bg_music.mp3",
  crowdSrc: "./assets/audio/crowd.mp3",
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
  constants: {
    GAME_WIDTH,
    GAME_HEIGHT,
    BALL_DISPLAY_RADIUS,
    GRAVITY,
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
      if (DEBUG_ENABLED) drawDebugRim();
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
function showOverlay({ eyebrow, title, body, buttonLabel, showReplay = false }) {
  if (!uiSystem) return;
  uiSystem.showOverlay({ eyebrow, title, body, buttonLabel, showReplay });
}

function hideOverlay(overlay) {
  if (!uiSystem) return;
  uiSystem.hideOverlay(overlay);
}

function openAuxPage(pageKey) {
  if (!uiSystem) return;
  uiSystem.openAuxPage(pageKey);
}

/* ─── Ball / Game reset ─── */
function resetBall() {
  if (!sessionSystem) return;
  sessionSystem.resetBall();
}

function resetGame() {
  if (audioSystem) audioSystem.stopCrowd();
  if (!sessionSystem) return;
  sessionSystem.resetGame();
}

function beginGame() {
  if (!sessionSystem) return;
  if (audioSystem) audioSystem.startAmbient();
  sessionSystem.beginGame();
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
}

function handlePointerMove(event) {
  if (!controlsSystem) return;
  controlsSystem.handlePointerMove(event);
}

function launchBall() {
  if (!controlsSystem) return;
  controlsSystem.launchBall();
}

function handlePointerUp() {
  if (!controlsSystem) return;
  controlsSystem.handlePointerUp();
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
  controlsSystem.toggleAssist();
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
debugRimSystem = createDebugRimSystem({
  ctx,
  state,
  ball,
  hoop,
  constants: {
    DEBUG_ENABLED,
    BALL_COLLISION_RADIUS,
    BALL_DISPLAY_RADIUS,
    GAME_WIDTH,
    GAME_HEIGHT,
  },
  debug,
  hexToRgba,
});

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
  const prevBallTop = ball.prevY - effR;
  const ballTop = ball.y - effR;
  const backboardSoundTriggerBottom = backboardBottom + effR + 60;
  const hitsBackboardX = ball.x + effR > backboardLeft && ball.x - effR < backboardRight;
  const hitsBackboardY = ball.y + effR > backboardTop && ball.y - effR < backboardBottom;
  const descendingIntoBackboard = hitsBackboardX && hitsBackboardY && ball.vy < 0;
  const backboardNearContact =
    hitsBackboardX &&
    ball.vy < 0 &&
    prevBallTop > backboardSoundTriggerBottom &&
    ballTop <= backboardSoundTriggerBottom;

  function playBackboardHitSound() {
    if (ball.backboardHitSoundArmed === false) return;
    ball.backboardHitSoundArmed = false;
    if (audioSystem) audioSystem.playRandomHit();
  }

  if (!descendingIntoBackboard) {
    ball.backboardHitSoundArmed = true;
  }
  if (backboardNearContact) {
    playBackboardHitSound();
  }

  let backboardHit = false;
  if (descendingIntoBackboard) {
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
      return depthScale(clamp((DEPTH_ANCHOR_Y - hoop.rimY) / 3.93, 0, 110));
    }
    if (!ball.active && !ball.scored) {
      return BALL_REST_SCALE;
    }
    return depthScale(ball.z);
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

function stepSimulation(stepNowMs) {
  if (birdSystem) birdSystem.update();
  updateBallPhysics();
  updateRoundTimer(stepNowMs);
  updateNetAnimation();
  if (particlesSystem) particlesSystem.update();
}

function render(now = performance.now()) {
  if (lastFrameTimeMs === null) {
    lastFrameTimeMs = now;
    simulationClockMs = now;
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

  if (steps === 0) {
    state.animationFrame = window.requestAnimationFrame(render);
    return;
  }

  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  drawScene();
  if (particlesSystem) particlesSystem.draw();
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
if (muteButton) {
  muteButton.addEventListener("click", toggleMute);
}
if (assistTooltipCloseButton) {
  assistTooltipCloseButton.addEventListener("click", dismissAssistTooltip);
}
if (assistInfoCloseButton) {
  assistInfoCloseButton.addEventListener("click", () => {
    assistInfoOverlay.classList.remove("visible");
  });
}
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
