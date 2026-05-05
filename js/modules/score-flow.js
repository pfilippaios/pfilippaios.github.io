(function initHoopRushScoreFlow(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createScoreFlowSystem({
    state,
    ball,
    constants,
    debug,
    hooks,
  }) {
    const scoreMessages = ["Καλάθι!", "Μπαμ!", "Φοβερό!", "Τέλειο!", "Σωστός!", "Ναι!"];
    let scoreTransitionActive = false;
    let scoreTransitionStartedAt = 0;

    function registerScore() {
      if (ball.scored || state.finished) return;
      ball.scored = true;
      ball.hoopState = "scored";
      state.justScored = true;
      state.shotsMade += 1;
      state.score += constants.SCORE_VALUE;
      state.scoreMessage = {
        text: scoreMessages[Math.floor(Math.random() * scoreMessages.length)],
        startTime: performance.now(),
      };
      hooks.updateHud();
      debug.log(
        `SCORE! made=${state.shotsMade}/${constants.WIN_THRESHOLD} attempts=${state.attemptsUsed}/${constants.MAX_ATTEMPTS}`,
        "evt",
      );
      if (constants.TEST_MODE) {
        global.setTimeout(hooks.resetBall, 420);
        return;
      }

      scoreTransitionActive = true;
      scoreTransitionStartedAt = performance.now();
    }

    function finishScoreTransition() {
      if (state.finished) {
        scoreTransitionActive = false;
        return;
      }

      scoreTransitionActive = false;
      const remaining = constants.MAX_ATTEMPTS - state.attemptsUsed;
      if (state.shotsMade >= constants.WIN_THRESHOLD) {
        hooks.showWinOverlay();
      } else if (remaining <= 0) {
        hooks.showLossOverlay();
      }
      hooks.resetBall();
    }

    function updateScoreTransition(now = performance.now()) {
      if (!scoreTransitionActive) return;
      if (state.finished) {
        scoreTransitionActive = false;
        return;
      }

      if (ball.settledTime) {
        const sinceSettle = now - ball.settledTime;

        if (sinceSettle >= 500 && !ball.disappearPoofDone) {
          ball.disappearPoofDone = true;
          hooks.spawnPuff(ball.x, ball.y);
          ball.opacity = 0;
        }

        if (sinceSettle >= 900 && !ball.reappearPoofDone) {
          ball.reappearPoofDone = true;
          hooks.spawnPuff(constants.GAME_WIDTH * 0.5, constants.BALL_REST_Y, 15);
          hooks.spawnStars(constants.GAME_WIDTH * 0.5, constants.BALL_REST_Y, 10);
          ball.x = constants.GAME_WIDTH * 0.5;
          ball.y = constants.BALL_REST_Y;
          ball.opacity = 1.0;
          ball.hoopState = "outside";
          ball.scored = false;
          ball.trail = [];
          ball.z = 0;
          ball.zDepth = 0;
          ball.vz = 0;
          ball.validEntry = false;
          ball.entryFrame = null;
          ball.clearedRimPlane = false;
        }

        if (sinceSettle >= 1400) {
          finishScoreTransition();
          return;
        }
      }

      if (now - scoreTransitionStartedAt >= 5000) {
        finishScoreTransition();
      }
    }

    function isTransitionActive() {
      return scoreTransitionActive;
    }

    return {
      isTransitionActive,
      registerScore,
      updateScoreTransition,
    };
  }

  HoopRushModules.scoreFlow = {
    createScoreFlowSystem,
  };
})(window);
