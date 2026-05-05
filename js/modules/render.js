(function initHoopRushRender(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createRenderSystem({
    ctx,
    state,
    ball,
    hoop,
    assets,
    constants,
    clamp,
    getLaunchVector,
    hooks,
  }) {
    const {
      bgImage,
      ballImage,
      ballSpinFrames,
    } = assets;

    const {
      GAME_WIDTH,
      GAME_HEIGHT,
      GRAVITY,
      BALL_DISPLAY_RADIUS,
      BALL_REST_SCALE,
      DEPTH_ANCHOR_Y,
      HOOP_Z,
      NET_Z_HALF = 14,
      Z_TO_PX = 3.93,
      DRAW_STATIC_BACKGROUND = true,
    } = constants;

    let bgCache = null;

    function drawBackground() {
      if (!DRAW_STATIC_BACKGROUND) return;
      if (!bgCache && bgImage.complete && bgImage.naturalWidth) {
        try {
          const cw = ctx.canvas.width;
          const ch = ctx.canvas.height;
          bgCache = typeof OffscreenCanvas !== "undefined"
            ? new OffscreenCanvas(cw, ch)
            : Object.assign(document.createElement("canvas"), { width: cw, height: ch });
          bgCache.getContext("2d").drawImage(bgImage, 0, 0, cw, ch);
        } catch (_) {
          bgCache = null;
        }
      }
      if (bgCache) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(bgCache, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(bgImage, 0, 0, GAME_WIDTH, GAME_HEIGHT);
      }
    }

    function depthScale(z) {
      const t = clamp(z / 130.5, 0, 1.6);
      return 1 - Math.pow(t, 0.85) * 0.6;
    }

    const rimDepthScale = depthScale(HOOP_Z);

    function isBallAtHoopRenderDepth() {
      return (
        ball.hoopState === "entering" ||
        ball.hoopState === "scored" ||
        (
          ball.clearedRimPlane &&
          ball.vy > 0 &&
          ball.y >= hoop.rimY - BALL_DISPLAY_RADIUS * 0.55 &&
          ball.y <= hoop.rimY + hoop.netHeight &&
          Math.abs(ball.zDepth - HOOP_Z) <= NET_Z_HALF
        )
      );
    }

    function getDynamicScale() {
      if (isBallAtHoopRenderDepth()) {
        return rimDepthScale;
      }
      if (!ball.active && !ball.scored) {
        return BALL_REST_SCALE;
      }
      return depthScale(ball.zDepth);
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

    let glowGradCache = null;
    let glowGradKey = -1;
    function drawBallGlow() {
      if (!state.dragging || ball.active) return;
      const pulse = (Math.sin(performance.now() / 180) + 1) * 0.5;
      const baseR = BALL_DISPLAY_RADIUS * getDynamicScale();
      const glowR = baseR + 10 + pulse * 8;
      /* Cache key: quantized pulse step (0..19) + quantized radius. Gradient anchored at (0,0); translate to ball pos. */
      const key = (Math.round(pulse * 20) << 12) | (Math.round(glowR * 4) & 0xfff);
      if (key !== glowGradKey || !glowGradCache) {
        glowGradCache = ctx.createRadialGradient(0, 0, baseR * 0.6, 0, 0, glowR);
        glowGradCache.addColorStop(0, `rgba(255, 196, 64, ${0.35 + pulse * 0.25})`);
        glowGradCache.addColorStop(1, "rgba(255, 196, 64, 0)");
        glowGradKey = key;
      }
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.fillStyle = glowGradCache;
      ctx.beginPath();
      ctx.arc(0, 0, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawBallShadowAndTrail() {
      if (ball.opacity <= 0) return;
      const trailCount = ball.trailCount || ball.trail.length;
      if (!isBallAtHoopRenderDepth() && trailCount > 1) {
        const len = trailCount;
        const startIndex = ball.trailCount ? ball.trailIndex || 0 : 0;
        for (let i = 0; i < len - 1; i++) {
          const t = (i + 1) / len;
          const pt = ball.trail[(startIndex + i) % len];
          if (!pt) continue;
          const r = BALL_DISPLAY_RADIUS * pt.scale * (0.3 + t * 0.55);
          const alpha = t * 0.32;
          ctx.globalAlpha = alpha;
          ctx.drawImage(ballImage, pt.x - r, pt.y - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;
      }

      if (ball.hoopState === "scored") {
        const ballR = BALL_DISPLAY_RADIUS * rimDepthScale;
        const shadowGroundY = 560 + ballR + 2;
        const heightAboveGround = Math.max(0, shadowGroundY - ball.y);
        const proximityT = 1 - clamp(heightAboveGround / 200, 0, 1);
        const shadowScale = rimDepthScale * (0.3 + proximityT * 0.7);
        const shadowAlpha = 0.08 + proximityT * 0.18;
        ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
        ctx.beginPath();
        ctx.ellipse(
          ball.x,
          shadowGroundY,
          BALL_DISPLAY_RADIUS * shadowScale,
          BALL_DISPLAY_RADIUS * 0.2 * shadowScale,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        return;
      }

      if (ball.y < GAME_HEIGHT - 80) {
        const scale = depthScale(ball.zDepth);
        const shadowOffset = BALL_DISPLAY_RADIUS * (0.55 + clamp(ball.zDepth / 110, 0, 1) * 0.75);
        const shadowY = clamp(ball.y + shadowOffset, hoop.rimY + 34, GAME_HEIGHT - 50);
        const shadowScale = Math.max(0.28, 1 - shadowOffset / 130) * scale;
        ctx.fillStyle = `rgba(0, 0, 0, ${0.18 * shadowScale})`;
        ctx.beginPath();
        ctx.ellipse(
          ball.x,
          shadowY,
          BALL_DISPLAY_RADIUS * shadowScale,
          BALL_DISPLAY_RADIUS * 0.25 * shadowScale,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }

    function drawBallSprite() {
      if (ball.opacity <= 0) return;
      const r = BALL_DISPLAY_RADIUS * getDynamicScale();
      const ballSprite = getBallRenderImage(ball.angle, ball.active);
      ctx.save();
      ctx.globalAlpha = ball.opacity;
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
      const previewLaunch = getCachedAimLaunch(dx, dy);

      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      let px = ball.x;
      let py = ball.y;
      let vx = previewLaunch.vx;
      let vy = previewLaunch.vy;
      let sp = previewLaunch.spin;
      ctx.moveTo(px, py);
      for (let i = 0; i < 30; i++) {
        vx += sp * 0.002;
        sp *= 0.995;
        const speed = Math.hypot(vx, vy);
        if (speed > 0.1) {
          const drag = 0.0008 * speed;
          vx -= (vx / speed) * drag;
          vy -= (vy / speed) * drag;
        }
        px += vx;
        py += vy + 0.5 * GRAVITY;
        vy += GRAVITY;
        ctx.lineTo(px, py);
        if (py < 0 || px < 0 || px > GAME_WIDTH || py > GAME_HEIGHT) break;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    let scoreTextCache = null;
    let scoreTextCacheKey = "";
    const SCORE_TEXT_W = 220;
    const SCORE_TEXT_H = 52;

    function ensureScoreTextCache(text) {
      if (scoreTextCacheKey === text && scoreTextCache) return;
      try {
        scoreTextCache = typeof OffscreenCanvas !== "undefined"
          ? new OffscreenCanvas(SCORE_TEXT_W, SCORE_TEXT_H)
          : Object.assign(document.createElement("canvas"), { width: SCORE_TEXT_W, height: SCORE_TEXT_H });
        const sctx = scoreTextCache.getContext("2d");
        sctx.clearRect(0, 0, SCORE_TEXT_W, SCORE_TEXT_H);
        sctx.textAlign = "center";
        sctx.textBaseline = "middle";
        sctx.font = "700 32px 'Bergen Sans', sans-serif";
        sctx.lineWidth = 6;
        sctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
        sctx.strokeText(text, SCORE_TEXT_W / 2, SCORE_TEXT_H / 2);
        sctx.fillStyle = "rgba(94, 200, 212, 1)";
        sctx.fillText(text, SCORE_TEXT_W / 2, SCORE_TEXT_H / 2);
        scoreTextCacheKey = text;
      } catch (_) {
        scoreTextCache = null;
        scoreTextCacheKey = "";
      }
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

      ensureScoreTextCache(state.scoreMessage.text);
      if (scoreTextCache) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.drawImage(scoreTextCache, -SCORE_TEXT_W / 2, -SCORE_TEXT_H / 2);
        ctx.restore();
        return;
      }

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 32px 'Bergen Sans', sans-serif";
      ctx.lineWidth = 6;
      ctx.strokeStyle = `rgba(0, 0, 0, ${0.7 * alpha})`;
      ctx.strokeText(state.scoreMessage.text, 0, 0);
      ctx.fillStyle = `rgba(94, 200, 212, ${alpha})`;
      ctx.fillText(state.scoreMessage.text, 0, 0);
      ctx.restore();
    }

    function drawAssistGlow() {
      if (!state.assistMode || state.finished || !state.started) return;
      const pulse = (Math.sin(performance.now() / 140) + 1) * 0.5;
      ctx.beginPath();
      ctx.fillStyle = `rgba(12, 162, 80, ${0.06 + pulse * 0.06})`;
      ctx.arc(hoop.centerX, hoop.rimY, 80 + pulse * 14, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawScene() {
      drawBackground();
      hooks.drawCrowd();
      hooks.drawBird();
      drawAssistGlow();

      drawBallShadowAndTrail();
      drawBallGlow();

      const dxRim = ball.x - hoop.centerX;
      const frontRimZ = HOOP_Z - Math.sqrt(Math.max(0, hoop.rimRadius * hoop.rimRadius - dxRim * dxRim)) / Z_TO_PX;
      const ballBehindHoop =
        ((ball.hoopState === "entering" || ball.hoopState === "scored") && ball.y >= hoop.rimY - 2) ||
        ball.zDepth >= frontRimZ;

      if (ballBehindHoop) {
        drawBallSprite();
        hooks.drawNet();
        hooks.drawFrontHoop();
      } else {
        hooks.drawNet();
        hooks.drawFrontHoop();
        drawBallSprite();
      }

      drawScoreMessage();
      drawAimGuide();
      hooks.drawDebugRim();
    }

    let aimCacheKey = "";
    let aimCacheLaunch = null;

    function getCachedAimLaunch(dx, dy) {
      const key = `${Math.round(dx * 2)}:${Math.round(dy * 2)}:${state.assistMode ? 1 : 0}`;
      if (key !== aimCacheKey || !aimCacheLaunch) {
        aimCacheKey = key;
        aimCacheLaunch = getLaunchVector(dx, dy);
      }
      return aimCacheLaunch;
    }

    return {
      drawBackground,
      depthScale,
      getDynamicScale,
      drawBallGlow,
      drawBallShadowAndTrail,
      drawBallSprite,
      drawAimGuide,
      drawScoreMessage,
      drawAssistGlow,
      drawScene,
    };
  }

  HoopRushModules.render = {
    createRenderSystem,
  };
})(window);
