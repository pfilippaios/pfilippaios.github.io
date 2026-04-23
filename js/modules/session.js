(function initHoopRushSession(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function loadStoredPlayCount(storageKey) {
    try {
      const rawValue = global.localStorage.getItem(storageKey);
      const parsedValue = Number.parseInt(rawValue || "0", 10);
      return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
    } catch (error) {
      console.warn("Unable to read play count from localStorage", error);
      return 0;
    }
  }

  function saveStoredPlayCount(storageKey, value) {
    try {
      global.localStorage.setItem(storageKey, String(value));
    } catch (error) {
      console.warn("Unable to persist play count to localStorage", error);
    }
  }

  function createSessionSystem({
    state,
    ball,
    constants,
    nodes,
    ui,
    debug,
    hooks,
  }) {
    const {
      startOverlay,
      messageOverlay,
      leadForm,
      assistTooltip,
    } = nodes;

    function resetBall() {
      ball.x = constants.GAME_WIDTH * 0.5;
      ball.y = constants.BALL_REST_Y;
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
      ball.backboardHitSoundArmed = true;
      ball.disappearPoofDone = false;
      ball.reappearPoofDone = false;
      state.justScored = false;
      state.dragging = false;
      state.pointerStart = null;
      state.pointerCurrent = null;
      hooks.resetNetAnimation();
    }

    function incrementPlayCount() {
      state.playCount += 1;
      saveStoredPlayCount(constants.PLAY_COUNT_STORAGE_KEY, state.playCount);
    }

    function resetGame() {
      state.started = false;
      state.finished = false;
      state.attemptsUsed = 0;
      state.score = 0;
      state.shotsMade = 0;
      state.timeRemainingMs = constants.ROUND_DURATION_MS;
      state.timerLastTickAt = null;
      state.dragging = false;
      state.pointerStart = null;
      state.pointerCurrent = null;
      state.justScored = false;
      state.assistMode = false;
      state.assistTooltipDismissed = false;
      state.awaitingMessage = false;
      ui.hideOverlay(messageOverlay);
      startOverlay.classList.add("visible");
      leadForm.classList.add("hidden");
      leadForm.reset();
      leadForm.dispatchEvent(new CustomEvent("hooprush:lead-form-reset"));
      resetBall();
      ui.updateHud();
      hooks.updateAssistButton();
      if (assistTooltip) assistTooltip.classList.add("hidden");
    }

    function beginGame() {
      state.started = true;
      state.finished = false;
      state.attemptsUsed = 0;
      state.score = 0;
      state.shotsMade = 0;
      state.timeRemainingMs = constants.ROUND_DURATION_MS;
      state.timerLastTickAt = null;
      state.assistMode = false;
      state.assistTooltipDismissed = false;
      incrementPlayCount();
      startOverlay.classList.remove("visible");
      ui.hideOverlay(messageOverlay);
      leadForm.classList.add("hidden");
      state.awaitingMessage = false;
      resetBall();
      ui.updateHud();
      hooks.updateAssistButton();
      if (assistTooltip) assistTooltip.classList.add("hidden");
      debug.log("beginGame", "evt");
    }

    return {
      resetBall,
      resetGame,
      beginGame,
      incrementPlayCount,
    };
  }

  HoopRushModules.session = {
    createSessionSystem,
    loadStoredPlayCount,
  };
})(window);
