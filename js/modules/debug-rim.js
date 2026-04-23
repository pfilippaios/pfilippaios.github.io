(function initHoopRushDebugRim(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createDebugRimSystem({
    ctx,
    state,
    ball,
    hoop,
    constants,
    debug,
    hexToRgba,
  }) {
    let debugApex = Infinity;

    function drawDebugRim() {
      if (!constants.DEBUG_ENABLED) return;

      const effR = constants.BALL_COLLISION_RADIUS;
      const rimY = hoop.rimY;
      const leftRimX = hoop.centerX - hoop.rimRadius;
      const rightRimX = hoop.centerX + hoop.rimRadius;
      const innerLeftRimX = leftRimX + 4;
      const innerRightRimX = rightRimX - 4;
      const capturePadding = constants.BALL_DISPLAY_RADIUS * 0.28;
      const captureLeftX = innerLeftRimX - capturePadding;
      const captureRightX = innerRightRimX + capturePadding;
      const captureTop = rimY - effR * 0.55;
      const scoreDepthY = rimY + hoop.netHeight * 0.35;
      const committedBottomY = rimY + hoop.netHeight * 0.65;
      const backboardLeft = hoop.centerX - hoop.backboardWidth * 0.5;
      const backboardTop = rimY - 110;
      const backboardWidth = hoop.backboardWidth;
      const backboardHeight = 18;

      if (ball.active && ball.y < debugApex) debugApex = ball.y;
      if (!ball.active) debugApex = Infinity;
      debug.pruneMarkers();

      ctx.save();

      ctx.lineWidth = 1.25;
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "rgba(77, 208, 225, 0.95)";
      ctx.strokeRect(captureLeftX, captureTop, captureRightX - captureLeftX, scoreDepthY - captureTop);
      ctx.fillStyle = "rgba(77, 208, 225, 0.9)";
      ctx.font = "10px monospace";
      ctx.fillText("capture", captureLeftX + 3, captureTop - 4);

      ctx.strokeStyle = "rgba(171, 71, 188, 0.95)";
      ctx.strokeRect(captureLeftX, rimY - 2, captureRightX - captureLeftX, committedBottomY - (rimY - 2));
      ctx.fillStyle = "rgba(171, 71, 188, 0.9)";
      ctx.fillText("committed", captureLeftX + 3, committedBottomY + 12);

      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(255, 209, 102, 0.95)";
      ctx.strokeRect(backboardLeft, backboardTop, backboardWidth, backboardHeight);
      ctx.fillStyle = "rgba(255, 209, 102, 0.95)";
      ctx.fillText("backboard", backboardLeft + 2, backboardTop - 4);

      ctx.strokeStyle = "rgba(255, 99, 99, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(hoop.centerX, rimY, hoop.rimRadius, hoop.rimRadius * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
      ctx.beginPath();
      ctx.moveTo(0, rimY);
      ctx.lineTo(constants.GAME_WIDTH, rimY);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 107, 107, 0.8)";
      const rimPointPerspective = 0.3;
      const rimPointCount = 24;
      for (let i = 0; i < rimPointCount; i++) {
        const angle = (i / rimPointCount) * Math.PI * 2;
        const py = rimY + Math.sin(angle) * hoop.rimRadius * rimPointPerspective;
        if (py > rimY + 2) continue;
        const px = hoop.centerX + Math.cos(angle) * hoop.rimRadius;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (ball.active || state.dragging) {
        ctx.strokeStyle = ball.hoopState === "entering" ? "rgba(124, 255, 107, 0.95)" : "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, effR, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = "rgba(124, 255, 107, 0.9)";
      ctx.beginPath();
      ctx.moveTo(captureLeftX, scoreDepthY);
      ctx.lineTo(captureRightX, scoreDepthY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(124, 255, 107, 0.9)";
      ctx.fillText("score depth", captureRightX - 56, scoreDepthY - 5);

      if (debugApex < constants.GAME_HEIGHT) {
        ctx.strokeStyle = "rgba(124, 255, 107, 0.65)";
        ctx.beginPath();
        ctx.moveTo(0, debugApex);
        ctx.lineTo(constants.GAME_WIDTH, debugApex);
        ctx.stroke();
      }

      const now = performance.now();
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.font = "10px monospace";
      for (const marker of debug.markers) {
        const age = now - marker.createdAt;
        const alpha = Math.max(0.18, 1 - age / debug.markerTtlMs);
        ctx.fillStyle = hexToRgba(marker.color || "#ffffff", alpha);
        ctx.strokeStyle = `rgba(0, 0, 0, ${Math.min(0.9, alpha + 0.2)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillText(marker.label || marker.type || "hit", marker.x, marker.y - 8);
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "yellow";
      ctx.font = "12px monospace";
      ctx.fillText(`ball.y=${ball.y.toFixed(0)} vy=${ball.vy.toFixed(2)} hoop=${ball.hoopState}`, 8, constants.GAME_HEIGHT - 34);
      ctx.fillText(`rimY=${rimY} apex=${isFinite(debugApex) ? debugApex.toFixed(0) : "-"} scoreY=${scoreDepthY.toFixed(1)}`, 8, constants.GAME_HEIGHT - 20);
      ctx.fillText(`capture=[${captureLeftX.toFixed(1)}, ${captureRightX.toFixed(1)}] ballR=${effR.toFixed(1)}`, 8, constants.GAME_HEIGHT - 6);

      ctx.restore();
    }

    return {
      drawDebugRim,
    };
  }

  HoopRushModules.debugRim = {
    createDebugRimSystem,
  };
})(window);
