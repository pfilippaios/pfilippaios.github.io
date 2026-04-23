(function initHoopRushRoundFlow(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createRoundFlow({
    state,
    ball,
    constants,
    debug,
    ui,
    hooks,
  }) {
    function showWinOverlay() {
      state.finished = true;
      debug.log(`WIN made=${state.shotsMade}/${constants.WIN_THRESHOLD}`, "evt");
      ui.showOverlay({
        eyebrow: "Νικητής",
        title: "Τα κατάφερες",
        body: "Συμπλήρωσε τη φόρμα για να διεκδικήσεις το δώρο ΦΥΣΙΚΟ ΑΕΡΙΟ.",
        buttonLabel: "Πάμε στη φόρμα",
        showReplay: true,
      });
    }

    function showLossOverlay(reason = "attempts") {
      state.finished = true;
      const timedOut = reason === "timer";
      debug.log(
        `${timedOut ? "TIMEOUT" : "LOSS"} made=${state.shotsMade}/${constants.WIN_THRESHOLD}`,
        timedOut ? "warn" : "err",
      );
      ui.showOverlay({
        eyebrow: timedOut ? "0:00" : "Τέλος",
        title: timedOut ? "Ο χρόνος έληξε" : "Δεν τα κατάφερες",
        body: timedOut
          ? `Ο χρόνος τελείωσε. Έβαλες ${state.shotsMade}/${constants.WIN_THRESHOLD} καλάθια πριν λήξει το χρονόμετρο.`
          : `Έβαλες ${state.shotsMade}/${constants.WIN_THRESHOLD} καλάθια. Για την κλήρωση χρειάζονται ${constants.WIN_THRESHOLD}.`,
        buttonLabel: "Παίξε ξανά",
      });
    }

    function handleTimerExpired() {
      if (state.finished || !state.started) return;

      state.timeRemainingMs = 0;
      state.timerLastTickAt = null;
      state.dragging = false;
      state.pointerStart = null;
      state.pointerCurrent = null;
      if (ball.active) ball.active = false;

      debug.log(
        `timer-expired made=${state.shotsMade}/${constants.WIN_THRESHOLD} attempts=${state.attemptsUsed}/${constants.MAX_ATTEMPTS}`,
        "warn",
      );
      ui.updateHud();

      if (state.shotsMade >= constants.WIN_THRESHOLD) {
        showWinOverlay();
      } else {
        showLossOverlay("timer");
      }

      hooks.resetBall();
    }

    function updateRoundTimer(now = performance.now()) {
      if (!state.started || state.finished) return;

      if (state.timerLastTickAt === null) {
        state.timerLastTickAt = now;
        ui.updateHud();
        return;
      }

      const deltaMs = Math.max(0, now - state.timerLastTickAt);
      state.timerLastTickAt = now;
      if (deltaMs === 0) return;

      state.timeRemainingMs = Math.max(0, state.timeRemainingMs - deltaMs);
      ui.updateHud();

      if (state.timeRemainingMs <= 0) {
        handleTimerExpired();
      }
    }

    function concludeMiss() {
      if (state.finished) return;
      debug.log(
        `MISS attempts=${state.attemptsUsed}/${constants.MAX_ATTEMPTS} made=${state.shotsMade} ballY=${ball.y.toFixed(1)}`,
        "warn",
      );
      if (constants.TEST_MODE) {
        hooks.resetBall();
        return;
      }
      const remaining = constants.MAX_ATTEMPTS - state.attemptsUsed;
      const needed = constants.WIN_THRESHOLD - state.shotsMade;

      if (remaining <= 0) {
        if (state.shotsMade >= constants.WIN_THRESHOLD) {
          showWinOverlay();
        } else {
          showLossOverlay();
        }
        hooks.resetBall();
        return;
      }
      hooks.setAssistMode();
      ui.showOverlay({
        eyebrow: "Αστοχία",
        title: "Εκτός στόχου",
        body: needed > 0
          ? `Έμειναν ${remaining} προσπάθειες. Χρειάζονται ${needed} καλάθια ακόμα.`
          : `Έμειναν ${remaining} προσπάθειες. Συνέχισε την προσπάθεια!`,
        buttonLabel: "Πάμε για την επόμενη",
      });
      hooks.resetBall();
    }

    return {
      updateRoundTimer,
      handleTimerExpired,
      showWinOverlay,
      showLossOverlay,
      concludeMiss,
    };
  }

  HoopRushModules.roundFlow = {
    createRoundFlow,
  };
})(window);
