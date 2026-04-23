(function initHoopRushControls(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createControlsSystem({
    canvas,
    state,
    ball,
    constants,
    clamp,
    debug,
    updateHud,
    nodes,
  }) {
    const {
      assistToggleButton,
      assistTooltip,
      assistTooltipDismissButton,
      assistInfoOverlay,
    } = nodes;

    let assistInfoShownThisSession = false;

    function getPointerPosition(event) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = constants.GAME_WIDTH / rect.width;
      const scaleY = constants.GAME_HEIGHT / rect.height;
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      };
    }

    function isPointerOnBall(position) {
      return Math.hypot(position.x - ball.x, position.y - ball.y) <= constants.BALL_DISPLAY_RADIUS + 20;
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
      return y - (vy * vy) / (2 * constants.GRAVITY);
    }

    function clearDragState() {
      state.dragging = false;
      state.pointerStart = null;
      state.pointerCurrent = null;
    }

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
      if (!state.pointerStart || !state.pointerCurrent) return false;
      const dx = state.pointerCurrent.x - state.pointerStart.x;
      const dy = state.pointerCurrent.y - state.pointerStart.y;
      const swipeDistance = Math.hypot(dx, dy);
      const launch = getLaunchVector(dx, dy);
      if (swipeDistance < 12 || launch.upwardPull <= 20) {
        clearDragState();
        return false;
      }

      ball.vx = launch.vx;
      ball.vy = launch.vy;
      ball.spin = launch.spin;
      ball.active = true;
      ball.trail = [];
      clearDragState();
      state.attemptsUsed += 1;
      updateHud();
      debug.log(
        `launch vx=${ball.vx.toFixed(2)} vy=${ball.vy.toFixed(2)} dx=${dx.toFixed(0)} dy=${dy.toFixed(0)} attempt=${state.attemptsUsed}`,
        "evt",
      );
      return true;
    }

    function handlePointerUp() {
      if (!state.dragging) return;
      launchBall();
    }

    function updateAssistButton() {
      if (!assistToggleButton) return;
      assistToggleButton.setAttribute("aria-pressed", state.assistMode ? "true" : "false");
    }

    function dismissAssistTooltip() {
      state.assistTooltipDismissed = true;
      if (assistTooltip) assistTooltip.classList.add("hidden");
      if (assistTooltipDismissButton) assistTooltipDismissButton.blur();
    }

    function toggleAssist() {
      if (assistTooltip) assistTooltip.classList.add("hidden");
      if (!assistInfoShownThisSession) {
        assistInfoShownThisSession = true;
        if (assistInfoOverlay) assistInfoOverlay.classList.add("visible");
      }
      state.assistMode = !state.assistMode;
      updateAssistButton();
      debug.log(`assist ${state.assistMode ? "on" : "off"}`, "evt");
    }

    return {
      getPointerPosition,
      isPointerOnBall,
      getLaunchProfile,
      getLaunchVector,
      getPredictedApexY,
      handlePointerDown,
      handlePointerMove,
      handlePointerUp,
      launchBall,
      updateAssistButton,
      dismissAssistTooltip,
      toggleAssist,
    };
  }

  HoopRushModules.controls = {
    createControlsSystem,
  };
})(window);
