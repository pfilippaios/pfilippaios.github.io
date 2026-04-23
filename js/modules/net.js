(function initHoopRushNet(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createNetSystem({
    ctx,
    ball,
    hoop,
    netFrames,
    frontHoopImage,
    isFrontHoopReady,
    clamp,
  }) {
    const NET_FRAME_INDEX = {
      idle: 0,
      preopen: 1,
      catch: 2,
      drop: 3,
      stretch: 4,
      swayLeft: 5,
      swayRight: 6,
      recoil: 7,
    };

    const netAnimation = {
      energy: 0,
      frameIndex: NET_FRAME_INDEX.idle,
      lastDirection: 1,
    };

    function resetNetAnimation() {
      netAnimation.energy = 0;
      netAnimation.frameIndex = NET_FRAME_INDEX.idle;
      netAnimation.lastDirection = 1;
    }

    function isBallDrivingNet() {
      return (
        ball.active &&
        (ball.hoopState === "entering" || ball.hoopState === "scored") &&
        ball.y >= hoop.rimY - 10 &&
        ball.y <= hoop.rimY + hoop.netHeight + 42
      );
    }

    function updateNetAnimation() {
      const directionThreshold = 0.18;
      if (ball.vx <= -directionThreshold) {
        netAnimation.lastDirection = -1;
      } else if (ball.vx >= directionThreshold) {
        netAnimation.lastDirection = 1;
      }

      if (isBallDrivingNet()) {
        const depthProgress = clamp((ball.y - (hoop.rimY - 4)) / (hoop.netHeight + 14), 0, 1);
        const verticalStretch = clamp(ball.vy / 8, 0, 1);
        const horizontalSpeed = Math.abs(ball.vx);

        netAnimation.energy = Math.max(
          netAnimation.energy,
          clamp(0.28 + depthProgress * 0.5 + verticalStretch * 0.22 + horizontalSpeed * 0.18, 0, 1),
        );

        if (ball.y < hoop.rimY + hoop.netHeight * 0.06 || ball.vy <= 0.45) {
          netAnimation.frameIndex = NET_FRAME_INDEX.preopen;
        } else if (depthProgress < 0.24) {
          netAnimation.frameIndex = NET_FRAME_INDEX.catch;
        } else if (depthProgress < 0.58) {
          netAnimation.frameIndex = NET_FRAME_INDEX.drop;
        } else if (horizontalSpeed > 0.55) {
          netAnimation.frameIndex =
            netAnimation.lastDirection < 0 ? NET_FRAME_INDEX.swayLeft : NET_FRAME_INDEX.swayRight;
        } else {
          netAnimation.frameIndex = NET_FRAME_INDEX.stretch;
        }
        return;
      }

      if (netAnimation.energy > 0.01) {
        netAnimation.energy = Math.max(0, netAnimation.energy - 0.06);

        if (netAnimation.energy > 0.56) {
          netAnimation.frameIndex =
            netAnimation.lastDirection < 0 ? NET_FRAME_INDEX.swayRight : NET_FRAME_INDEX.swayLeft;
        } else if (netAnimation.energy > 0.22) {
          netAnimation.frameIndex = NET_FRAME_INDEX.recoil;
        } else if (netAnimation.energy > 0.08) {
          netAnimation.frameIndex = NET_FRAME_INDEX.preopen;
        } else {
          netAnimation.frameIndex = NET_FRAME_INDEX.idle;
        }
        return;
      }

      netAnimation.frameIndex = NET_FRAME_INDEX.idle;
    }

    function drawNet() {
      const img = netFrames[netAnimation.frameIndex] || netFrames[NET_FRAME_INDEX.idle];
      if (!img || !img.complete || !img.naturalWidth) return;

      const NET_WIDTH_MULT = 2.1;
      const NET_Y_OFFSET = -6;
      const baseWidth = hoop.rimRadius * NET_WIDTH_MULT;
      const aspect = img.naturalHeight / img.naturalWidth;
      const baseHeight = baseWidth * aspect;

      let width = baseWidth;
      let height = baseHeight;
      let xOffset = 0;

      if (netAnimation.frameIndex !== NET_FRAME_INDEX.idle) {
        const liveStretch = ball.active ? clamp(ball.vy * 0.0045, 0, 0.08) : netAnimation.energy * 0.025;
        height *= 1 + liveStretch;

        if (ball.active) {
          xOffset += clamp(ball.vx * 0.45, -5, 5);
        }

        if (netAnimation.frameIndex === NET_FRAME_INDEX.swayLeft) {
          xOffset -= 2 + netAnimation.energy * 4;
        } else if (netAnimation.frameIndex === NET_FRAME_INDEX.swayRight) {
          xOffset += 2 + netAnimation.energy * 4;
        } else if (netAnimation.frameIndex === NET_FRAME_INDEX.recoil) {
          xOffset += -netAnimation.lastDirection * (1.5 + netAnimation.energy * 4.5);
        } else if (!ball.active && netAnimation.energy > 0.08) {
          xOffset += -netAnimation.lastDirection * netAnimation.energy * 2;
        }
      }

      const x = hoop.centerX - width / 2 + xOffset;
      const y = hoop.rimY + NET_Y_OFFSET;
      ctx.drawImage(img, x, y, width, height);
    }

    function drawFrontHoop() {
      if (!isFrontHoopReady()) return;
      const FRONT_WIDTH_MULT = 2.6;
      const FRONT_Y_OFFSET = -14;
      const width = hoop.rimRadius * FRONT_WIDTH_MULT;
      const aspect = frontHoopImage.naturalHeight / frontHoopImage.naturalWidth;
      const height = width * aspect;
      const x = hoop.centerX - width / 2;
      const y = hoop.rimY + FRONT_Y_OFFSET;
      ctx.drawImage(frontHoopImage, x, y, width, height);
    }

    return {
      resetNetAnimation,
      isBallDrivingNet,
      updateNetAnimation,
      drawNet,
      drawFrontHoop,
    };
  }

  HoopRushModules.net = {
    createNetSystem,
  };
})(window);
