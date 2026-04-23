(function initHoopRushBird(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createBirdSystem({ gameWidth, flightBand, aspectRatio, frameSequence }) {
    const bird = {
      x: gameWidth + 80,
      y: 72,
      baseY: 72,
      width: 40,
      height: 40 * aspectRatio,
      speed: 0.32,
      direction: -1,
      bobPhase: 0,
      bobSpeed: flightBand.bobSpeed,
      bobAmplitude: 1.4,
      frameIndex: 0,
      frameSequenceIndex: 0,
      frameTick: 0,
      frameInterval: flightBand.frameInterval,
    };

    function reset(initialSpawn = false) {
      bird.direction = Math.random() > 0.5 ? 1 : -1;
      bird.width =
        flightBand.minWidth +
        Math.random() * (flightBand.maxWidth - flightBand.minWidth);
      bird.height = bird.width * aspectRatio;
      bird.baseY =
        flightBand.minY +
        Math.random() * (flightBand.maxY - flightBand.minY);
      bird.y = bird.baseY;
      bird.speed =
        flightBand.minSpeed +
        Math.random() * (flightBand.maxSpeed - flightBand.minSpeed);
      bird.bobPhase = Math.random() * Math.PI * 2;
      bird.bobAmplitude =
        flightBand.minBobAmplitude +
        Math.random() * (flightBand.maxBobAmplitude - flightBand.minBobAmplitude);
      bird.bobSpeed = flightBand.bobSpeed * (0.9 + Math.random() * 0.25);
      bird.frameInterval = flightBand.frameInterval + Math.floor(Math.random() * 2);
      bird.frameSequenceIndex = Math.floor(Math.random() * frameSequence.length);
      bird.frameIndex = frameSequence[bird.frameSequenceIndex];
      bird.frameTick = 0;

      const spawnPadding = initialSpawn ? 120 : 180 + Math.random() * 220;
      bird.x =
        bird.direction === -1
          ? gameWidth + bird.width + spawnPadding
          : -bird.width - spawnPadding;
    }

    function update() {
      bird.frameTick += 1;
      if (bird.frameTick >= bird.frameInterval) {
        bird.frameTick = 0;
        bird.frameSequenceIndex = (bird.frameSequenceIndex + 1) % frameSequence.length;
        bird.frameIndex = frameSequence[bird.frameSequenceIndex];
      }

      bird.bobPhase += bird.bobSpeed;
      bird.x += bird.speed * bird.direction;
      bird.y = bird.baseY + Math.sin(bird.bobPhase) * bird.bobAmplitude;

      const outOfView =
        bird.direction === -1
          ? bird.x < -bird.width - 120
          : bird.x > gameWidth + bird.width + 120;
      if (outOfView) {
        reset();
      }
    }

    function draw(ctx, frames) {
      const frame = frames[bird.frameIndex];
      if (!frame || !frame.complete) return;

      ctx.save();
      ctx.translate(bird.x, bird.y);
      if (bird.direction < 0) {
        ctx.scale(-1, 1);
      }
      ctx.globalAlpha = 0.72;
      ctx.drawImage(frame, -bird.width / 2, -bird.height / 2, bird.width, bird.height);
      ctx.restore();
    }

    return {
      reset,
      update,
      draw,
    };
  }

  HoopRushModules.bird = {
    createBirdSystem,
  };
})(window);
