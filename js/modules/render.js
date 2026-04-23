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
    } = constants;

    function drawBackground() {
      ctx.drawImage(bgImage, 0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    function depthScale(z) {
      const t = clamp(z / 130.5, 0, 1.6);
      return 1 - Math.pow(t, 0.85) * 0.6;
    }

    const rimDepthScale = depthScale(clamp((DEPTH_ANCHOR_Y - hoop.rimY) / 3.93, 0, 110));

    function getDynamicScale() {
      if (ball.hoopState === "entering" || ball.hoopState === "scored") {
        return rimDepthScale;
      }
      if (!ball.active && !ball.scored) {
        return BALL_REST_SCALE;
      }
      return depthScale(ball.z);
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

    function drawBallGlow() {
      if (!state.dragging || ball.active) return;
      const pulse = (Math.sin(Date.now() / 180) + 1) * 0.5;
      const baseR = BALL_DISPLAY_RADIUS * getDynamicScale();
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
      if (ball.opacity <= 0) return;
      if (ball.trail.length > 1) {
        const len = ball.trail.length;
        for (let i = 0; i < len - 1; i++) {
          const t = (i + 1) / len;
          const pt = ball.trail[i];
          const r = BALL_DISPLAY_RADIUS * pt.scale * (0.3 + t * 0.55);
          const alpha = t * 0.32;
          const trailImage = getBallRenderImage(pt.angle, true);
          ctx.globalAlpha = alpha;
          ctx.drawImage(trailImage, pt.x - r, pt.y - r, r * 2, r * 2);
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
        const scale = depthScale(ball.z);
        const shadowY = (ball.z >= 200) ? ball.y + 10 : GAME_HEIGHT - 50;
        const shadowScale = Math.max(0.3, 1 - (shadowY - ball.y) / 600) * scale;
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
      const previewLaunch = getLaunchVector(dx, dy);

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

    function drawScene() {
      drawBackground();
      hooks.drawCrowd();
      hooks.drawBird();
      drawAssistGlow();

      drawBallShadowAndTrail();
      drawBallGlow();

      const droppingIntoNet =
        (ball.hoopState === "entering" || ball.hoopState === "scored") &&
        ball.vy > 0 &&
        ball.y >= hoop.rimY - 2;

      if (droppingIntoNet) {
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
