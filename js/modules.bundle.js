(function initHoopRushUtils(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function hash01(seed) {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
    return value - Math.floor(value);
  }

  function hashString01(value, salt = 0) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash01((hash >>> 0) + salt);
  }

  function hexToRgba(hex, alpha) {
    const clean = hex.replace("#", "");
    const size = clean.length === 3 ? 1 : 2;
    const channels = [];
    for (let i = 0; i < 3; i++) {
      const part = clean.slice(i * size, i * size + size);
      const value = parseInt(size === 1 ? `${part}${part}` : part, 16);
      channels.push(Number.isNaN(value) ? 255 : value);
    }
    return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
  }

  HoopRushModules.utils = {
    clamp,
    hash01,
    hashString01,
    hexToRgba,
  };
})(window);

(function initHoopRushAssets(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createAssetSystem({
    enableBird = false,
    enableCrowd = true,
    onAllReady,
    onCrowdSequencesReady,
    onCrowdSequencesError,
  }) {
    let frontHoopReady = false;
    let criticalAssetsLoaded = 0;
    let bootAssetsReady = false;
    let deferredAssetsStarted = false;
    const crowdSequenceImages = {};
    const crowdSequenceKeys = ["left", "center", "right"];

    const ballSpinFrameCount = 8;
    const birdFrameCount = 8;
    const netFrameAssets = [
      { key: "idle", src: "./assets/game/net/net-state-01-idle.webp" },
      { key: "preopen", src: "./assets/game/net/net-state-02-preopen.webp" },
      { key: "catch", src: "./assets/game/net/net-state-03-catch.webp" },
      { key: "drop", src: "./assets/game/net/net-state-04-drop.webp" },
      { key: "stretch", src: "./assets/game/net/net-state-05-stretch.webp" },
      { key: "swayLeft", src: "./assets/game/net/net-state-06-sway-left.webp" },
      { key: "swayRight", src: "./assets/game/net/net-state-07-sway-right.webp" },
      { key: "recoil", src: "./assets/game/net/net-state-08-recoil.webp" },
    ];
    const ballSpinFrames = Array.from({ length: ballSpinFrameCount }, () => null);
    const netFrames = Array.from({ length: netFrameAssets.length }, () => null);
    const birdFrames = Array.from({ length: birdFrameCount }, () => null);
    const criticalAssetCount = 3;

    function scheduleBackgroundWork(callback) {
      if (typeof global.requestIdleCallback === "function") {
        global.requestIdleCallback(() => callback(), { timeout: 600 });
        return;
      }
      global.setTimeout(callback, 32);
    }

    function onCriticalAssetLoad() {
      criticalAssetsLoaded++;
      if (bootAssetsReady || criticalAssetsLoaded < criticalAssetCount) return;

      bootAssetsReady = true;
      onAllReady();
    }

    function prepareImageElement(image, priority = "auto") {
      image.decoding = "async";
      try {
        image.fetchPriority = priority;
      } catch (error) {
        // Ignore unsupported fetchPriority assignments.
      }
      return image;
    }

    function decodeImageWhenIdle(image) {
      if (!image || typeof image.decode !== "function") return;
      scheduleBackgroundWork(() => {
        image.decode().catch(() => {});
      });
    }

    function loadImageAsset({
      primarySrc,
      onLoad = onCriticalAssetLoad,
      onFinalError = onCriticalAssetLoad,
      label = primarySrc,
      priority = "auto",
    }) {
      const image = prepareImageElement(new Image(), priority);

      const handleLoad = () => {
        onLoad(image);
        decodeImageWhenIdle(image);
      };

      image.onload = handleLoad;
      image.onerror = () => {
        console.warn(`Failed to load image asset: ${label}`);
        onFinalError(image);
      };
      image.src = primarySrc;

      return image;
    }

    const bgImage = prepareImageElement(new Image(), "high");

    const ballImage = loadImageAsset({
      primarySrc: "./assets/game/ball/new_ball.webp",
      priority: "high",
    });

    netFrames[0] = loadImageAsset({
      primarySrc: netFrameAssets[0].src,
      label: `net-frame-${netFrameAssets[0].key}`,
      priority: "high",
    });

    const frontHoopImage = loadImageAsset({
      primarySrc: "./assets/game/hoop/front-hoop.webp",
      priority: "high",
      onLoad: () => {
        frontHoopReady = true;
        onCriticalAssetLoad();
      },
    });

    function loadAsync(src, label) {
      return new Promise((resolve) => {
        loadImageAsset({
          primarySrc: src,
          onLoad: (img) => resolve(img),
          onFinalError: (img) => resolve(img),
          label: label,
          priority: "low",
        });
      });
    }

    async function startDeferredAssetLoads() {
      if (deferredAssetsStarted) return;
      deferredAssetsStarted = true;

      const ballFrameLoads = Array.from({ length: ballSpinFrameCount }, (_, index) =>
        loadAsync(`./assets/game/ball/ball-spin-${index + 1}.webp`, `ball-spin-${index + 1}`)
          .then((img) => {
            ballSpinFrames[index] = img;
          })
      );

      const netFrameLoads = netFrameAssets.slice(1).map(({ key, src }, offset) =>
        loadAsync(src, `net-frame-${key}`).then((img) => {
          netFrames[offset + 1] = img;
        })
      );

      await Promise.allSettled([...ballFrameLoads, ...netFrameLoads]);

      if (enableBird) {
        await Promise.allSettled(
          Array.from({ length: birdFrameCount }, (_, index) =>
            loadAsync(`./assets/game/bird/bird-smooth-${index + 1}.webp`, `bird-frame-${index + 1}`)
              .then((img) => {
                birdFrames[index] = img;
              })
          )
        );
      }

      if (enableCrowd) {
        await Promise.allSettled(
          crowdSequenceKeys.map((key) =>
            loadAsync(`./assets/game/crowd/crowd_${key}.webp`, `crowd-${key}`).then((img) => {
              if (img && img.complete && img.naturalWidth) {
                crowdSequenceImages[key] = img;
              }
            })
          )
        );

        if (Object.keys(crowdSequenceImages).length) {
          onCrowdSequencesReady(crowdSequenceImages);
        } else {
          onCrowdSequencesError();
        }
      }
    }

    return {
      bgImage,
      ballImage,
      ballSpinFrames,
      netFrames,
      frontHoopImage,
      birdFrames,
      isFrontHoopReady: () => frontHoopReady,
      startDeferredAssetLoads,
    };
  }

  HoopRushModules.assets = {
    createAssetSystem,
  };
})(window);

(function initHoopRushAudio(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createAudioElement(src, { loop = false, volume = 1, preload = "none", autoLoad = false } = {}) {
    const audio = new Audio(src);
    audio.preload = preload;
    audio.loop = loop;
    audio.volume = volume;
    audio.__baseVolume = volume;
    audio.__loadRequested = false;
    audio.playsInline = true;
    audio.setAttribute("playsinline", "");
    if (autoLoad) {
      audio.__loadRequested = true;
      audio.load();
    }
    return audio;
  }

  function clearStopTimer(audio) {
    if (!audio.__stopTimerId) return;
    global.clearTimeout(audio.__stopTimerId);
    audio.__stopTimerId = 0;
  }

  function clearFadeFrame(audio) {
    if (!audio.__fadeFrameId) return;
    global.cancelAnimationFrame(audio.__fadeFrameId);
    audio.__fadeFrameId = 0;
  }

  function restoreAudioVolume(audio) {
    if (typeof audio.__baseVolume === "number") {
      audio.volume = audio.__baseVolume;
    }
  }

  function ensureAudioLoaded(audio, preload = "auto") {
    if (audio.__loadRequested) return;
    audio.__loadRequested = true;
    audio.preload = preload;
    audio.load();
  }

  function createPool(src, size, volume, options) {
    return Array.from({ length: size }, () => createAudioElement(src, { volume, ...options }));
  }

  function createAudioSystem({
    bgMusicSrc,
    crowdSrc,
    netSrc,
    dropSrc,
    hitSources = [],
    bgMusicVolume = 0.16,
    crowdVolume = 0.12,
    crowdSegmentEndMs = 30000,
    netVolume = 0.8,
    dropVolume = 0.85,
    dropFadeOutMs = 220,
    hitVolume = 0.65,
    hitCooldownMs = 140,
    bgMusicFadeMs = 1800,
    crowdFadeMs = 1600,
    debug,
  }) {
    let muted = false;
    let lastHitAt = -Infinity;
    let effectsPrimed = false;

    function syncMuted(audio) {
      audio.muted = muted;
      return audio;
    }

    const crowdLoop = crowdSrc
      ? createAudioElement(crowdSrc, { loop: false, volume: 0, preload: "none" })
      : null;
    const bgMusicLoop = bgMusicSrc
      ? createAudioElement(bgMusicSrc, { loop: true, volume: 0, preload: "none" })
      : null;
    const netPool = createPool(netSrc, 1, netVolume, { preload: "none" });
    const dropPool = createPool(dropSrc, 1, dropVolume, { preload: "none" });
    const hitPools = hitSources.map((src) => createPool(src, 1, hitVolume, { preload: "none" }));
    const loopStates = {
      crowd: crowdLoop
        ? {
            audio: syncMuted(crowdLoop),
            label: "crowd",
            targetVolume: crowdVolume,
            fadeMs: crowdFadeMs,
            fadeFrame: 0,
            segmentFrame: 0,
            segmentStartMs: 0,
            segmentEndMs: crowdSegmentEndMs,
            segmentFadeOutMs: crowdFadeMs,
            started: false,
          }
        : null,
      bgMusic: bgMusicLoop
        ? {
            audio: syncMuted(bgMusicLoop),
            label: "bg-music",
            targetVolume: bgMusicVolume,
            fadeMs: bgMusicFadeMs,
            fadeFrame: 0,
            segmentFrame: 0,
            started: false,
          }
        : null,
    };
    const allAudioElements = [
      crowdLoop,
      bgMusicLoop,
      ...netPool,
      ...dropPool,
      ...hitPools.flat(),
    ].filter(Boolean);
    allAudioElements.forEach(syncMuted);

    function logPlaybackFailure(label, error) {
      console.warn(`Audio playback failed for ${label}`, error);
      if (debug && typeof debug.log === "function") {
        debug.log(`audio.${label}.failed`, "warn");
      }
    }

    function cancelLoopFade(loopState) {
      if (!loopState.fadeFrame) return;
      global.cancelAnimationFrame(loopState.fadeFrame);
      loopState.fadeFrame = 0;
    }

    function cancelSegmentFrame(loopState) {
      if (!loopState || !loopState.segmentFrame) return;
      global.clearInterval(loopState.segmentFrame);
      loopState.segmentFrame = 0;
    }

    function fadeLoopIn(loopState) {
      cancelLoopFade(loopState);
      const nowFn =
        global.performance && typeof global.performance.now === "function"
          ? () => global.performance.now()
          : () => Date.now();
      const startTime = nowFn();

      loopState.audio.volume = 0;

      function step() {
        const progress = Math.min(1, (nowFn() - startTime) / loopState.fadeMs);
        loopState.audio.volume = loopState.targetVolume * progress;

        if (progress < 1) {
          loopState.fadeFrame = global.requestAnimationFrame(step);
          return;
        }

        loopState.fadeFrame = 0;
      }

      loopState.fadeFrame = global.requestAnimationFrame(step);
    }

    function monitorSegmentLoop(loopState) {
      if (!loopState || !loopState.segmentEndMs) return;

      cancelSegmentFrame(loopState);

      function step() {
        if (loopState.audio.paused) {
          cancelSegmentFrame(loopState);
          return;
        }

        const currentMs = loopState.audio.currentTime * 1000;
        const fadeOutStartMs = Math.max(
          loopState.segmentStartMs,
          loopState.segmentEndMs - loopState.segmentFadeOutMs
        );

        if (currentMs >= fadeOutStartMs) {
          const remainingMs = Math.max(0, loopState.segmentEndMs - currentMs);
          const fadeRatio = loopState.segmentFadeOutMs > 0
            ? Math.min(1, remainingMs / loopState.segmentFadeOutMs)
            : 0;
          loopState.audio.volume = loopState.targetVolume * fadeRatio;
        }

        if (currentMs >= loopState.segmentEndMs) {
          try {
            loopState.audio.currentTime = loopState.segmentStartMs / 1000;
          } catch (error) {
            // Ignore seek errors for media that is still becoming seekable.
          }
          if (loopState.audio.volume < loopState.targetVolume) {
            fadeLoopIn(loopState);
          }
        }
      }

      loopState.segmentFrame = global.setInterval(step, 200);
    }

    function resetAudio(audio) {
      clearStopTimer(audio);
      clearFadeFrame(audio);
      audio.pause();
      restoreAudioVolume(audio);
      try {
        audio.currentTime = 0;
      } catch (error) {
        // Ignore currentTime errors on not-yet-ready media.
      }
    }

    function fadeOutAndStop(audio, fadeOutMs) {
      clearFadeFrame(audio);
      if (fadeOutMs <= 0) {
        resetAudio(audio);
        return;
      }

      const nowFn =
        global.performance && typeof global.performance.now === "function"
          ? () => global.performance.now()
          : () => Date.now();
      const startTime = nowFn();
      const startVolume = audio.volume;

      function step() {
        if (audio.paused) {
          clearFadeFrame(audio);
          restoreAudioVolume(audio);
          return;
        }

        const progress = Math.min(1, (nowFn() - startTime) / fadeOutMs);
        audio.volume = startVolume * (1 - progress);

        if (progress < 1) {
          audio.__fadeFrameId = global.requestAnimationFrame(step);
          return;
        }

        resetAudio(audio);
      }

      audio.__fadeFrameId = global.requestAnimationFrame(step);
    }

    function playFromPool(pool, label, { maxDurationMs = 0, fadeOutMs = 0 } = {}) {
      if (!pool.length) return;

      const audio = pool.find((item) => item.paused || item.ended) || pool[0];
      ensureAudioLoaded(audio);
      resetAudio(audio);

      const playPromise = audio.play();
      if (maxDurationMs > 0) {
        const fadeDelayMs = Math.max(0, maxDurationMs - fadeOutMs);
        audio.__stopTimerId = global.setTimeout(() => {
          if (fadeOutMs > 0) {
            fadeOutAndStop(audio, Math.min(fadeOutMs, maxDurationMs));
            return;
          }
          resetAudio(audio);
        }, fadeDelayMs);
      }
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((error) => logPlaybackFailure(label, error));
      }
    }

    function startLoop(loopState, { silentFailure = false } = {}) {
      if (!loopState) return;
      if (loopState.started && !loopState.audio.paused) return;

      loopState.started = true;
      ensureAudioLoaded(loopState.audio);
      if (typeof loopState.segmentStartMs === "number") {
        try {
          loopState.audio.currentTime = loopState.segmentStartMs / 1000;
        } catch (error) {
          // Ignore seek errors before metadata is fully available.
        }
      }
      const playPromise = loopState.audio.play();

      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .then(() => {
            if (loopState.audio.volume < loopState.targetVolume) {
              fadeLoopIn(loopState);
            }
            monitorSegmentLoop(loopState);
          })
          .catch((error) => {
            loopState.started = false;
            cancelLoopFade(loopState);
            cancelSegmentFrame(loopState);
            loopState.audio.volume = 0;
            if (!silentFailure) {
              logPlaybackFailure(loopState.label, error);
            }
          });
        return;
      }

      if (loopState.audio.volume < loopState.targetVolume) {
        fadeLoopIn(loopState);
      }
      monitorSegmentLoop(loopState);
    }

    function startMusic(options) {
      startLoop(loopStates.bgMusic, options);
    }

    function startCrowd(options) {
      startLoop(loopStates.crowd, options);
    }

    function stopLoop(loopState) {
      if (!loopState) return;
      loopState.started = false;
      cancelLoopFade(loopState);
      cancelSegmentFrame(loopState);
      loopState.audio.pause();
      loopState.audio.volume = 0;
      if (typeof loopState.segmentStartMs === "number") {
        try {
          loopState.audio.currentTime = loopState.segmentStartMs / 1000;
        } catch (error) {
          // Ignore seek errors before media is fully seekable.
        }
      }
    }

    function stopCrowd() {
      stopLoop(loopStates.crowd);
    }

    function startAmbient(options) {
      startMusic(options);
      startCrowd(options);
    }

    function primeEffects() {
      if (effectsPrimed) return;
      effectsPrimed = true;
      [...netPool, ...dropPool, ...hitPools.flat()].forEach((audio) => ensureAudioLoaded(audio));
    }

    function playNet() {
      playFromPool(netPool, "net");
    }

    function playDrop() {
      playFromPool(dropPool, "drop", {
        maxDurationMs: 750,
        fadeOutMs: dropFadeOutMs,
      });
    }

    function playRandomHit() {
      if (!hitPools.length) return;
      const now =
        global.performance && typeof global.performance.now === "function"
          ? global.performance.now()
          : Date.now();
      if (now - lastHitAt < hitCooldownMs) return;
      lastHitAt = now;
      const pool = hitPools[Math.floor(Math.random() * hitPools.length)];
      playFromPool(pool, "hit");
    }

    function setMuted(nextMuted) {
      muted = Boolean(nextMuted);
      allAudioElements.forEach(syncMuted);
      return muted;
    }

    function toggleMuted() {
      return setMuted(!muted);
    }

    function isMuted() {
      return muted;
    }

    return {
      startMusic,
      startCrowd,
      stopCrowd,
      startAmbient,
      primeEffects,
      playNet,
      playDrop,
      playRandomHit,
      setMuted,
      toggleMuted,
      isMuted,
    };
  }

  HoopRushModules.audio = {
    createAudioSystem,
  };
})(window);

(function initHoopRushParticles(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createParticlesSystem({ ctx }) {
    const particles = [];

    function spawnPuff(x, y, count = 12, color = "rgba(255, 255, 255, 0.7)") {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 2.5;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          decay: 0.02 + Math.random() * 0.03,
          size: 4 + Math.random() * 12,
          color,
          type: "puff",
        });
      }
    }

    function spawnStars(x, y, count = 8) {
      const colors = ["#FFD700", "#FF69B4", "#00FF7F", "#00BFFF", "#FF4500"];
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.0 + Math.random() * 3.5;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          decay: 0.015 + Math.random() * 0.02,
          size: 3 + Math.random() * 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          type: "star",
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.2,
        });
      }
    }

    function update() {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // Light gravity
        p.life -= p.decay;
        if (p.type === "star") p.angle += p.spin;
        if (p.life <= 0) {
          particles[i] = particles[particles.length - 1];
          particles.pop();
        }
      }
    }

    function draw() {
      ctx.save();
      for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        if (p.type === "star") {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          const s = p.size;
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.3, -s * 0.3);
          ctx.lineTo(s, 0);
          ctx.lineTo(s * 0.3, s * 0.3);
          ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.3, s * 0.3);
          ctx.lineTo(-s, 0);
          ctx.lineTo(-s * 0.3, -s * 0.3);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + (1 - p.life)), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    return {
      hasParticles: () => particles.length > 0,
      spawnPuff,
      spawnStars,
      update,
      draw,
    };
  }

  HoopRushModules.particles = {
    createParticlesSystem,
  };
})(window);

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

(function initHoopRushCrowd(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createCrowdSystem({
    ctx,
    gameWidth,
    gameHeight,
    seatMapUrl,
    seatSourceSize,
    maxFans,
    randomSeed,
    fallbackSeats,
    clamp,
    hashString01,
  }) {
    const CROWD_REFERENCE_WIDTHS = {
      left: 2001,
      center: 2030,
      right: 2047,
    };
    const CROWD_REFERENCE_SPANS = {
      left: [
        { start: 0, end: 286 },
        { start: 358, end: 630 },
        { start: 696, end: 966 },
        { start: 1028, end: 1296 },
        { start: 1378, end: 1656 },
        { start: 1732, end: 2000 },
      ],
      center: [
        { start: 0, end: 289 },
        { start: 360, end: 641 },
        { start: 709, end: 994 },
        { start: 1038, end: 1319 },
        { start: 1386, end: 1672 },
        { start: 1742, end: 2029 },
      ],
      right: [
        { start: 0, end: 286 },
        { start: 354, end: 679 },
        { start: 725, end: 998 },
        { start: 1050, end: 1365 },
        { start: 1418, end: 1687 },
        { start: 1776, end: 2046 },
      ],
    };

    let crowdSequences = null;
    let crowdInstances = [];
    let crowdSeatMap = null;
    let crowdSeatMapLoadStarted = false;

    function setSequencesFromImages(images) {
      try {
        const nextSequences = createCrowdAnimationSequences(images);
        crowdSequences = Object.keys(nextSequences).length ? nextSequences : null;
      } catch (e) {
        console.warn("Crowd system: Failed to process sequences", e);
        crowdSequences = null;
      }
    }

    function clearSequences() {
      crowdSequences = null;
    }

    function setup() {
      buildCrowdInstances();
      loadCrowdSeatMap();
    }

    function createCrowdAnimationSequences(images) {
      const sequences = {};

      for (const [key, image] of Object.entries(images || {})) {
        if (!image) continue;
        const frames = createCrowdFramesFromImage(image, key);
        if (frames && frames.length) {
          sequences[key] = frames;
        }
      }

      const fallbackFrames = sequences.center || sequences.left || sequences.right || null;
      if (!fallbackFrames) return {};

      return {
        left: sequences.left || fallbackFrames,
        center: sequences.center || fallbackFrames,
        right: sequences.right || fallbackFrames,
      };
    }

    function createCrowdFramesFromImage(image, sequenceKey = "") {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (width === 0 || height === 0) return [];
      const referenceWidth = CROWD_REFERENCE_WIDTHS[sequenceKey] || width;
      const scaleCompensation = referenceWidth / width;
      
      const sourceCanvas = document.createElement("canvas");
      sourceCanvas.width = width;
      sourceCanvas.height = height;
      const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
      sourceCtx.drawImage(image, 0, 0);

      let spans = [];
      let pixelData = null;

      try {
        const frame = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
        pixelData = frame.data;
        const { data } = frame;
        const occupiedColumns = new Uint8Array(sourceCanvas.width);

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          const isGreenScreen = a > 0 && g > 150 && g > r + 55 && g > b + 55;

          if (isGreenScreen) {
            data[i + 3] = 0;
            continue;
          }

          if (data[i + 3] === 0) continue;
          const pixelIndex = i / 4;
          const x = pixelIndex % sourceCanvas.width;
          occupiedColumns[x] = 1;
        }

        sourceCtx.putImageData(frame, 0, 0);

        const mergeGapPx = Math.max(8, Math.round(sourceCanvas.width * 0.012));
        const minSpanPx = Math.max(20, Math.round(sourceCanvas.width * 0.025));
        let spanStart = null;

        for (let x = 0; x < occupiedColumns.length; x++) {
          if (occupiedColumns[x]) {
            if (spanStart === null) spanStart = x;
            continue;
          }

          if (spanStart !== null) {
            const prev = spans[spans.length - 1];
            if (prev && spanStart - prev.end - 1 <= mergeGapPx) {
              prev.end = x - 1;
            } else {
              spans.push({ start: spanStart, end: x - 1 });
            }
            spanStart = null;
          }
        }

        if (spanStart !== null) {
          const prev = spans[spans.length - 1];
          if (prev && spanStart - prev.end - 1 <= mergeGapPx) {
            prev.end = occupiedColumns.length - 1;
          } else {
            spans.push({ start: spanStart, end: occupiedColumns.length - 1 });
          }
        }

        spans = spans.filter((span) => span.end - span.start + 1 >= minSpanPx);
      } catch (e) {
        console.warn("Crowd system: getImageData failed (CORS), using fallback spans");
        pixelData = null; // Do not attempt precise Y-crop when CORS fails
        const referenceSpans = CROWD_REFERENCE_SPANS[sequenceKey];
        if (referenceSpans?.length) {
          const scale = width / referenceWidth;
          spans = referenceSpans.map((span) => ({
            start: Math.round(span.start * scale),
            end: Math.round(span.end * scale),
          }));
        } else {
          // Generic 6-frame slice
          const fw = Math.floor(width / 6);
          for (let i = 0; i < 6; i++) {
            spans.push({ start: i * fw, end: (i + 1) * fw - 1 });
          }
        }
      }

      return spans
        .map((span) => createCrowdFrameCanvas(sourceCanvas, pixelData, span, scaleCompensation))
        .filter(Boolean);
    }

    function createCrowdFrameCanvas(sourceCanvas, pixelData, span, scaleCompensation = 1) {
      let minY = 0;
      let maxY = sourceCanvas.height - 1;

      if (pixelData) {
        minY = sourceCanvas.height;
        maxY = -1;
        for (let y = 0; y < sourceCanvas.height; y++) {
          for (let x = span.start; x <= span.end; x++) {
            const alphaIndex = (y * sourceCanvas.width + x) * 4 + 3;
            if (pixelData[alphaIndex] === 0) continue;
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
        if (maxY < minY) return null;
      }

      const padding = 2;
      const width = span.end - span.start + 1;
      const cropHeight = sourceCanvas.height - minY;
      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = width + padding * 2;
      frameCanvas.height = cropHeight + padding * 2;

      const frameCtx = frameCanvas.getContext("2d");
      frameCtx.drawImage(
        sourceCanvas,
        span.start,
        minY,
        width,
        cropHeight,
        padding,
        padding,
        width,
        cropHeight,
      );
      frameCanvas.hoopRushScaleCompensation = scaleCompensation;

      return frameCanvas;
    }

    function loadCrowdSeatMap() {
      if (crowdSeatMapLoadStarted || !window.fetch) return;
      crowdSeatMapLoadStarted = true;

      fetch(seatMapUrl)
        .then((response) => {
          if (!response.ok) throw new Error(`seat map ${response.status}`);
          return response.json();
        })
        .then((seatMap) => {
          if (!Array.isArray(seatMap?.seats) || !seatMap.seats.length) {
            throw new Error("seat map has no seats");
          }
          crowdSeatMap = seatMap;
          buildCrowdInstances();
        })
        .catch((error) => {
          console.warn("Using fallback crowd seats", error);
        });
    }

    function getCrowdSeatSource() {
      if (crowdSeatMap?.seats?.length) {
        return {
          image: crowdSeatMap.image || seatSourceSize,
          seats: crowdSeatMap.seats,
        };
      }

      return {
        image: seatSourceSize,
        seats: fallbackSeats,
      };
    }

    function normalizeCrowdSeat(seat, sourceImage) {
      const sourceWidth = sourceImage?.width || seatSourceSize.width;
      const sourceHeight = sourceImage?.height || seatSourceSize.height;
      const x = (Number(seat.cx) / sourceWidth) * gameWidth;
      const y = (Number(seat.cy) / sourceHeight) * gameHeight;
      const perspective = clamp((y - 185) / 270, 0, 1);
      const id = seat.seat_id || seat.id || `${seat.row}-${seat.cx}-${seat.cy}`;
      const sourceScale = Number.isFinite(Number(seat.scale)) ? Number(seat.scale) : 1;

      return {
        id,
        x,
        y,
        row: Number(seat.row) || 0,
        area: Number(seat.area) || 0,
        perspective,
        section: seat.section || "",
        sourceScale,
        rank: hashString01(id, randomSeed),
      };
    }

    function isCrowdSeatDrawable(seat) {
      if (seat.y < 185 || seat.y > 455) return false;
      if (seat.area < 120) return false;

      const overlapsBackboard = seat.x > 82 && seat.x < 338 && seat.y > 150 && seat.y < 390;
      const overlapsPole = seat.x > 185 && seat.x < 235 && seat.y > 350;
      return !overlapsBackboard && !overlapsPole;
    }

    function getSequenceKeyForSeat(seat) {
      const section = String(seat.section || "").toLowerCase();

      if (section.includes("center")) return "center";
      if (section.includes("left")) return "left";
      if (section.includes("right")) return "right";

      if (seat.x < gameWidth * 0.34) return "left";
      if (seat.x > gameWidth * 0.66) return "right";
      return "center";
    }

    function buildCrowdInstances() {
      crowdInstances = [];

      const seatSource = getCrowdSeatSource();
      const candidates = seatSource.seats
        .map((seat) => normalizeCrowdSeat(seat, seatSource.image))
        .filter(isCrowdSeatDrawable)
        .sort((a, b) => a.rank - b.rank);
      const pickedSeats = [];

      for (const seat of candidates) {
        const tooClose = pickedSeats.some((pickedSeat) => {
          return Math.abs(seat.y - pickedSeat.y) < 8 && Math.abs(seat.x - pickedSeat.x) < 28;
        });

        if (tooClose) continue;
        pickedSeats.push(seat);
        if (pickedSeats.length >= maxFans) break;
      }

      pickedSeats.sort((a, b) => a.y - b.y);

      for (const seat of pickedSeats) {
        const phase = hashString01(`${seat.id}:phase`, randomSeed) * Math.PI * 2;
        const scaleNudge = 0.96 + hashString01(`${seat.id}:scale`, randomSeed) * 0.08;
        const alphaNudge = (hashString01(`${seat.id}:alpha`, randomSeed) - 0.5) * 0.08;
        const speedNudge = hashString01(`${seat.id}:speed`, randomSeed);
        const sourceScaleNudge = clamp(0.92 + seat.sourceScale * 0.08, 0.94, 1.04);

        crowdInstances.push({
          x: seat.x,
          seatY: seat.y,
          sequenceKey: getSequenceKeyForSeat(seat),
          scale: (0.074 + seat.perspective * 0.058) * scaleNudge * sourceScaleNudge,
          visibleRatio: clamp(0.52 + seat.perspective * 0.12, 0.5, 0.66),
          alpha: clamp(0.54 + seat.perspective * 0.22 + alphaNudge, 0.46, 0.82),
          bobAmplitude: 0.06 + seat.perspective * 0.18,
          bobPhase: phase,
          swayAmplitude: 0.08 + seat.perspective * 0.26,
          tiltAmplitude: 0.01 + seat.perspective * 0.018,
          waveSpeed: 0.001 + speedNudge * 0.00075,
          frameDurationMs: 180 + speedNudge * 140,
          frameOffsetMs: hashString01(`${seat.id}:frame`, randomSeed) * 1800,
          flip: hashString01(`${seat.id}:flip`, randomSeed) > 0.5,
        });
      }
    }

    function getCrowdFrame(instance, now) {
      const sequence = crowdSequences?.[instance.sequenceKey];
      if (!sequence?.length) return null;

      const elapsed = Math.max(0, now + instance.frameOffsetMs);
      const frameIndex = Math.floor(elapsed / instance.frameDurationMs) % sequence.length;
      return sequence[frameIndex];
    }

    function drawCrowdFan(instance, now) {
      const frame = getCrowdFrame(instance, now);
      if (!frame) return;
      const scaleCompensation = Number(frame.hoopRushScaleCompensation) || 1;

      const wave = Math.sin(now * instance.waveSpeed + instance.bobPhase);
      const bob = wave * instance.bobAmplitude;
      const sway = Math.sin(now * instance.waveSpeed * 0.72 + instance.bobPhase) * instance.swayAmplitude;
      const tilt = wave * instance.tiltAmplitude;
      const pulseX = 1 + Math.max(0, wave) * 0.018;
      const pulseY = 1 + Math.max(0, -wave) * 0.014;
      const spriteWidth = frame.width * instance.scale * scaleCompensation;
      const spriteHeight = frame.height * instance.scale * scaleCompensation;
      const visibleHeight = Math.round(spriteHeight * instance.visibleRatio);
      
      // Move fans slightly lower relative to their seat mapping
      const verticalOffset = 6; 

      ctx.save();
      ctx.globalAlpha = instance.alpha * (0.96 + Math.max(0, wave) * 0.04);
      ctx.translate(instance.x + sway, instance.seatY + bob + verticalOffset);
      ctx.rotate(tilt);
      ctx.scale(instance.flip ? -pulseX : pulseX, pulseY);
      ctx.beginPath();
      // Clip from top of the visible part down to the seat baseline
      ctx.rect(-spriteWidth / 2 - 1, -visibleHeight - 1, spriteWidth + 2, visibleHeight + 2);
      ctx.clip();
      // Draw image shifted down so the top is at -visibleHeight,
      // which means we keep the top `visibleHeight` pixels of the original sprite (head/torso)
      ctx.drawImage(frame, -spriteWidth / 2, -visibleHeight, spriteWidth, spriteHeight);
      ctx.restore();
    }

    function draw(now = performance.now()) {
      if (!crowdInstances.length || !crowdSequences) return;

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      for (const instance of crowdInstances) {
        drawCrowdFan(instance, now);
      }
      ctx.restore();
    }

    return {
      setSequencesFromImages,
      clearSequences,
      setup,
      draw,
    };
  }

  HoopRushModules.crowd = {
    createCrowdSystem,
  };
})(window);

(function initHoopRushUi(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createUiSystem({
    nodes,
    state,
    constants,
    formatTimer,
    auxPages,
  }) {
    const {
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
    } = nodes;

    function updateHud() {
      triesLeftNode.textContent = `${state.attemptsUsed}/${constants.MAX_ATTEMPTS}`;
      madeValueNode.textContent = `${state.shotsMade}/${constants.WIN_THRESHOLD}`;
      if (timerValueNode) timerValueNode.textContent = formatTimer(state.timeRemainingMs);
      if (playCountValueNode) playCountValueNode.textContent = String(state.playCount);

      const missedCount = state.attemptsUsed - state.shotsMade;
      if (!state.assistMode && !state.assistTooltipDismissed && missedCount >= 2) {
        if (assistTooltip) assistTooltip.classList.remove("hidden");
      } else {
        if (assistTooltip) assistTooltip.classList.add("hidden");
      }
    }

    function showOverlay({ eyebrow, title, body, buttonLabel, showReplay = false, variant = "" }) {
      messageEyebrow.textContent = eyebrow || "";
      messageTitle.textContent = title;
      messageBody.textContent = body;
      messageButton.textContent = buttonLabel;
      if (showReplay) {
        replayButton.classList.remove("hidden");
      } else {
        replayButton.classList.add("hidden");
      }
      const card = messageOverlay.querySelector(".overlay-card");
      if (card) {
        card.classList.remove("is-win", "is-loss");
        if (variant) card.classList.add(`is-${variant}`);
      }
      messageOverlay.classList.add("visible");
      state.awaitingMessage = true;
    }

    function hideOverlay(overlay) {
      overlay.classList.remove("visible");
    }

    function openAuxPage(pageKey) {
      const page = auxPages[pageKey];
      if (!page) return;
      auxOverlayTitle.textContent = page.title;
      auxOverlayContent.innerHTML = page.body;
      auxOverlay.classList.add("visible");
    }

    function hideAuxOverlay() {
      auxOverlay.classList.remove("visible");
    }

    return {
      updateHud,
      showOverlay,
      hideOverlay,
      openAuxPage,
      hideAuxOverlay,
    };
  }

  HoopRushModules.ui = {
    createUiSystem,
  };
})(window);

(function initHoopRushDebug(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createDebugSystem({
    enabled,
    nodes,
    getState,
    getBall,
    constants,
  }) {
    const {
      debugPanel,
      debugStateNode,
      debugLogNode,
      debugFileLogNode,
      debugClearBtn,
      debugCopyBtn,
      debugDownloadBtn,
      debugToggleBtn,
    } = nodes;

    let active = Boolean(enabled);

    const debug = {
      entries: [],
      fileLog: [],
      markers: [],
      latestHit: null,
      max: 120,
      fileMax: 900,
      markerMax: 28,
      markerTtlMs: 2800,
      isEnabled() {
        return active;
      },
      setEnabled(nextActive) {
        active = Boolean(nextActive);
        if (debugPanel) {
          debugPanel.hidden = !active;
          debugPanel.style.display = active ? "flex" : "none";
          if (active) debugPanel.classList.remove("collapsed");
        }
        if (debugToggleBtn) debugToggleBtn.textContent = "Hide";
        if (active) {
          global.__hoopRushDebug = debug;
          this.renderLog();
          this.renderFileLog();
          this.renderState();
          this.log("debug enabled", "evt");
        }
      },
      toggleEnabled() {
        this.setEnabled(!active);
      },
      log(msg, level = "info") {
        const t = (performance.now() / 1000).toFixed(2);
        this.fileLog.push(`[${t}] [${level.toUpperCase()}] ${msg}`);
        if (this.fileLog.length > this.fileMax) {
          this.fileLog.splice(0, this.fileLog.length - this.fileMax);
        }
        if (!active) return;

        this.entries.push({ t, msg, level });
        if (this.entries.length > this.max) this.entries.shift();
        this.renderLog();
        this.renderFileLog();
      },
      renderLog() {
        if (!debugLogNode) return;
        const cls = { info: "entry", warn: "entry warn", err: "entry err", evt: "entry evt" };
        debugLogNode.innerHTML = this.entries
          .map((entry) => `<div class="${cls[entry.level] || "entry"}">[${entry.t}] ${entry.msg}</div>`)
          .join("");
        debugLogNode.scrollTop = debugLogNode.scrollHeight;
      },
      clear() {
        this.entries = [];
        this.fileLog = [];
        this.markers = [];
        this.latestHit = null;
        this.renderLog();
        this.renderFileLog();
        this.renderState();
      },
      renderFileLog() {
        const text = this.fileLog.join("\n");
        if (debugFileLogNode) {
          debugFileLogNode.value = text;
          debugFileLogNode.scrollTop = debugFileLogNode.scrollHeight;
        }
        global.__hoopRushDebugLog = text;
        global.__hoopRushDebugEntries = [...this.fileLog];
      },
      download() {
        this.renderFileLog();
        const blob = new Blob([this.fileLog.join("\n")], { type: "text/plain" });
        const anchor = document.createElement("a");
        anchor.href = URL.createObjectURL(blob);
        anchor.download = `hoop-rush-${Date.now()}.log`;
        anchor.click();
        URL.revokeObjectURL(anchor.href);
      },
      async copy() {
        this.renderFileLog();
        const text = this.fileLog.join("\n");
        if (!text) return;
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return;
        }
        if (debugFileLogNode) {
          debugFileLogNode.focus();
          debugFileLogNode.select();
          document.execCommand("copy");
        }
      },
      recordMarker({ x, y, type, label, color, detail = "" }) {
        if (!active) return;
        const createdAt = performance.now();
        const marker = { x, y, type, label, color, detail, createdAt };
        this.markers.push(marker);
        if (this.markers.length > this.markerMax) this.markers.shift();
        this.latestHit = marker;
      },
      pruneMarkers(now = performance.now()) {
        const cutoff = now - this.markerTtlMs;
        this.markers = this.markers.filter((marker) => marker.createdAt >= cutoff);
      },
      renderState() {
        if (!debugStateNode) return;
        const state = getState();
        const ball = getBall();
        const lastHit = this.latestHit
          ? `${this.latestHit.type}@${this.latestHit.x.toFixed(1)},${this.latestHit.y.toFixed(1)}`
          : "-";
        debugStateNode.textContent =
          `started=${state.started} finished=${state.finished} assist=${state.assistMode}
attempts=${state.attemptsUsed}/${constants.MAX_ATTEMPTS} made=${state.shotsMade}/${constants.WIN_THRESHOLD} score=${state.score}
dragging=${state.dragging} awaitMsg=${state.awaitingMessage}
ball.active=${ball.active} scored=${ball.scored} hoop=${ball.hoopState}
ball.x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)} yDepth=${ball.z.toFixed(1)} zDepth=${(ball.zDepth || 0).toFixed(1)}
ball.vx=${ball.vx.toFixed(2)} vy=${ball.vy.toFixed(2)} vz=${(ball.vz || 0).toFixed(2)} flight=${ball.flightTime || 0}
logLines=${this.fileLog.length} markers=${this.markers.length} lastHit=${lastHit}`;
      },
    };

    if (debugPanel) {
      debugPanel.hidden = !active;
      debugPanel.style.display = active ? "flex" : "none";
    }

    if (debugClearBtn) {
      debugClearBtn.addEventListener("click", () => debug.clear());
    }
    if (debugCopyBtn) {
      debugCopyBtn.addEventListener("click", async () => {
        try {
          await debug.copy();
          debug.log("copied full debug log to clipboard", "evt");
        } catch (error) {
          debug.log(`copy-log failed: ${error.message}`, "err");
        }
      });
    }
    if (debugDownloadBtn) {
      debugDownloadBtn.addEventListener("click", () => debug.download());
    }
    if (debugToggleBtn) {
      debugToggleBtn.addEventListener("click", () => {
        if (!debugPanel) return;
        debugPanel.classList.toggle("collapsed");
        debugToggleBtn.textContent = debugPanel.classList.contains("collapsed") ? "Show" : "Hide";
      });
    }

    global.__hoopRushDebug = debug;
    global.addEventListener("keydown", (event) => {
      const tagName = event.target?.tagName;
      const isEditableTarget =
        event.target?.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
      if (isEditableTarget) return;

      if (event.ctrlKey && event.shiftKey && (event.key === "d" || event.key === "D")) {
        event.preventDefault();
        debug.toggleEnabled();
        return;
      }
      if (event.key === "d" || event.key === "D") {
        event.preventDefault();
        if (!active) {
          debug.setEnabled(true);
          return;
        }
        if (!debugPanel) return;
        debugPanel.classList.toggle("collapsed");
        if (debugToggleBtn) debugToggleBtn.textContent = debugPanel.classList.contains("collapsed") ? "Show" : "Hide";
        return;
      }
      if (!active) return;
      if (event.key === "l" || event.key === "L") {
        debug.download();
      }
    });

    if (active) {
      global.__hoopRushDebug = debug;
      debug.renderLog();
      debug.renderFileLog();
      debug.log("boot", "evt");
    }

    return debug;
  }

  HoopRushModules.debug = {
    createDebugSystem,
  };
})(window);

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
      const debugEnabled =
        typeof constants.DEBUG_ENABLED === "function" ? constants.DEBUG_ENABLED() : constants.DEBUG_ENABLED;
      if (!debugEnabled) return;

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
      const backboardHeight = 55;
      const hoopZ = constants.HOOP_Z || 75;
      const zToPx = constants.Z_TO_PX || 3.93;
      const netZHalf = constants.NET_Z_HALF || 14;
      const backboardZ = hoopZ + (hoop.rimRadius + 12) / zToPx;

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
      ctx.fillText(`backboard z=${backboardZ.toFixed(1)}`, backboardLeft + 2, backboardTop - 4);

      ctx.strokeStyle = "rgba(255, 99, 99, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(hoop.centerX, rimY, hoop.rimRadius, hoop.rimRadius * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 99, 99, 0.9)";
      ctx.fillText("rim screen ref", hoop.centerX + hoop.rimRadius + 4, rimY - 4);

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
      ctx.fillText(`ball.y=${ball.y.toFixed(0)} vy=${ball.vy.toFixed(2)} hoop=${ball.hoopState}`, 8, constants.GAME_HEIGHT - 48);
      ctx.fillText(`zDepth=${(ball.zDepth || 0).toFixed(1)} vz=${(ball.vz || 0).toFixed(2)} hoopZ=${hoopZ} netZ=±${netZHalf}`, 8, constants.GAME_HEIGHT - 34);
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
        eyebrow: "",
        title: `${state.shotsMade}/${constants.WIN_THRESHOLD}! Είσαι μέσα!`,
        body: "Είσαι ένα βήμα πριν την συμμετοχή σου στην κλήρωση!",
        buttonLabel: "Διεκδίκησε το δώρο σου",
        showReplay: true,
        variant: "win",
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
        eyebrow: "SHOOT & WIN",
        title: timedOut ? "Ο χρόνος έληξε" : "Δεν τα κατάφερες αυτή τη φορά",
        body: "Προσάρμοσε τη γωνία του σουτ και στόχευσε λίγο πάνω από τη στεφάνη.",
        buttonLabel: "Παίξε ξανά!",
        variant: "loss",
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

      const maxTransitionMs = 5000;
      const scoreTime = performance.now();

      const finishScoreTransition = () => {
        if (state.finished) return;
        const remaining = constants.MAX_ATTEMPTS - state.attemptsUsed;
        if (state.shotsMade >= constants.WIN_THRESHOLD) {
          hooks.showWinOverlay();
        } else if (remaining <= 0) {
          hooks.showLossOverlay();
        }
        hooks.resetBall();
      };

      const checkTransition = () => {
        if (state.finished) return;
        const now = performance.now();

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

        if (now - scoreTime >= maxTransitionMs) {
          finishScoreTransition();
          return;
        }

        global.requestAnimationFrame(checkTransition);
      };

      global.requestAnimationFrame(checkTransition);
    }

    return {
      registerScore,
    };
  }

  HoopRushModules.scoreFlow = {
    createScoreFlowSystem,
  };
})(window);

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
      ball.flightTime = 0;
      ball.z = 0;
      ball.zDepth = 0;
      ball.vz = 0;
      ball.validEntry = false;
      ball.entryFrame = null;
      ball.clearedRimPlane = false;
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

(function initHoopRushControls(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createControlsSystem({
    canvas,
    state,
    ball,
    hoop,
    constants,
    clamp,
    debug,
    updateHud,
    nodes,
  }) {
    const {
      GAME_WIDTH,
      GAME_HEIGHT,
      BALL_DISPLAY_RADIUS,
      GRAVITY,
      HOOP_Z,
      Z_TO_PX = 3.93,
      Z_DRAG = 0.997,
    } = constants;

    const {
      assistToggleButton,
      assistTooltip,
      assistTooltipDismissButton,
      assistInfoOverlay,
    } = nodes;

    let assistInfoShownThisSession = false;

    function getPointerPosition(event) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = GAME_WIDTH / rect.width;
      const scaleY = GAME_HEIGHT / rect.height;
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      };
    }

    function isPointerOnBall(position) {
      return Math.hypot(position.x - ball.x, position.y - ball.y) <= BALL_DISPLAY_RADIUS + 20;
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
      return y - (vy * vy) / (2 * GRAVITY);
    }

    function estimateFramesToYOnDescent(vy0, startY, targetY, requireClearance = true) {
      let y = startY;
      let vy = vy0;
      let vx = 0;
      let frames = 0;
      let passedApex = false;
      let clearedTarget = startY <= targetY;
      for (let i = 0; i < 300; i++) {
        const speed = Math.hypot(vx, vy);
        if (speed > 0.1) {
          const dragForce = 0.0008 * speed;
          vy -= (vy / speed) * dragForce;
        }
        y += vy + 0.5 * GRAVITY;
        vy += GRAVITY;
        frames++;
        if (y <= targetY) clearedTarget = true;
        if (vy > 0) passedApex = true;
        if (passedApex && (!requireClearance || clearedTarget) && y >= targetY) return frames;
      }
      return null;
    }

    function estimateFramesToApex(vy0) {
      let vy = vy0;
      let vx = 0;
      for (let frames = 1; frames <= 300; frames++) {
        const speed = Math.hypot(vx, vy);
        if (speed > 0.1) {
          const dragForce = 0.0008 * speed;
          vy -= (vy / speed) * dragForce;
        }
        vy += GRAVITY;
        if (vy >= 0) return frames;
      }
      return 1;
    }

    function getInitialVzForTarget(targetZ, frames) {
      const dragSum = (1 - Math.pow(Z_DRAG, frames)) / (1 - Z_DRAG);
      return targetZ / Math.max(dragSum, 1);
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
      const collisionRadius = BALL_DISPLAY_RADIUS * 0.7;
      const entryTargetY = hoop.rimY - collisionRadius;
      const entryFrames = estimateFramesToYOnDescent(launch.vy, ball.y, entryTargetY);
      const centerRimFrames = estimateFramesToYOnDescent(launch.vy, ball.y, hoop.rimY);
      const frontRimZ = HOOP_Z - hoop.rimRadius / Z_TO_PX;
      const targetZ = (entryFrames || state.assistMode) ? HOOP_Z : frontRimZ;
      const framesToDepth = entryFrames || centerRimFrames || estimateFramesToApex(launch.vy);
      ball.vz = getInitialVzForTarget(targetZ, framesToDepth);
      ball.active = true;
      ball.trail = [];
      ball.trailIndex = 0;
      ball.trailCount = 0;
      clearDragState();
      state.attemptsUsed += 1;
      updateHud();
      debug.log(
        `launch vx=${ball.vx.toFixed(2)} vy=${ball.vy.toFixed(2)} vz=${ball.vz.toFixed(2)} zTarget=${targetZ.toFixed(1)} zFrames=${framesToDepth} dx=${dx.toFixed(0)} dy=${dy.toFixed(0)} attempt=${state.attemptsUsed}`,
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

    function isAnimating() {
      return netAnimation.energy > 0.01 || netAnimation.frameIndex !== NET_FRAME_INDEX.idle || isBallDrivingNet();
    }

    function drawNet() {
      const img = netFrames[netAnimation.frameIndex] || netFrames[NET_FRAME_INDEX.idle];
      if (!img || !img.complete || !img.naturalWidth) return;

      const NET_WIDTH_MULT = 2.75;
      const NET_Y_OFFSET = -13;
      const width = hoop.rimRadius * NET_WIDTH_MULT;
      const aspect = img.naturalHeight / img.naturalWidth;
      const height = width * aspect;

      const x = hoop.centerX - width / 2;
      const y = hoop.rimY + NET_Y_OFFSET;

      const clipTop = hoop.rimY - 4;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 40, clipTop, width + 80, height + 80);
      ctx.clip();
      ctx.drawImage(img, x, y, width, height);
      ctx.restore();
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
      isAnimating,
      updateNetAnimation,
      drawNet,
      drawFrontHoop,
    };
  }

  HoopRushModules.net = {
    createNetSystem,
  };
})(window);

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

(function initHoopRushLeadForm(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  const DEFAULT_MESSAGES = {
    pending: "Γίνεται καταχώρηση της συμμετοχής σου...",
    success: "Η συμμετοχή σου καταχωρήθηκε. Πάτα Επανεκκίνηση για νέα παρτίδα.",
    error: "Δεν ήταν δυνατή η καταχώρηση αυτή τη στιγμή. Δοκίμασε ξανά σε λίγο.",
    missingEndpoint:
      "Η φόρμα δεν έχει συνδεθεί ακόμα με endpoint καταχώρησης. Ο maintainer πρέπει να ορίσει το HoopRushLeadFormConfig.endpoint.",
  };

  function ensureDefaultFeedback(feedbackNode) {
    if (!feedbackNode) return "";
    const initialMessage = feedbackNode.dataset.defaultMessage || feedbackNode.textContent.trim();
    feedbackNode.dataset.defaultMessage = initialMessage;
    return initialMessage;
  }

  function setFeedback(feedbackNode, message, status) {
    if (!feedbackNode) return;
    feedbackNode.textContent = message;
    feedbackNode.dataset.status = status;
  }

  function setSubmitState(form, isSubmitting) {
    const submitButton = form.querySelector('[type="submit"]');
    form.dataset.submitting = isSubmitting ? "true" : "false";
    form.setAttribute("aria-busy", isSubmitting ? "true" : "false");

    if (!submitButton) return;
    const defaultLabel = submitButton.dataset.defaultLabel || submitButton.textContent.trim();
    submitButton.dataset.defaultLabel = defaultLabel;
    submitButton.disabled = isSubmitting;
    submitButton.setAttribute("aria-disabled", isSubmitting ? "true" : "false");
    submitButton.textContent = isSubmitting ? "Υποβολή..." : defaultLabel;
  }

  function normalizeConfig(form) {
    const runtimeConfig = global.HoopRushLeadFormConfig || {};
    const endpoint = String(
      runtimeConfig.endpoint || form.dataset.submitUrl || form.getAttribute("action") || "",
    ).trim();

    return {
      endpoint,
      method: String(
        runtimeConfig.method || form.dataset.submitMethod || form.getAttribute("method") || "POST",
      ).toUpperCase(),
      payloadType: String(
        runtimeConfig.payloadType || form.dataset.submitPayloadType || "json",
      ).toLowerCase(),
      pendingMessage:
        runtimeConfig.pendingMessage || form.dataset.pendingMessage || DEFAULT_MESSAGES.pending,
      successMessage:
        runtimeConfig.successMessage || form.dataset.successMessage || DEFAULT_MESSAGES.success,
      errorMessage:
        runtimeConfig.errorMessage || form.dataset.errorMessage || DEFAULT_MESSAGES.error,
      missingEndpointMessage:
        runtimeConfig.missingEndpointMessage ||
        form.dataset.missingEndpointMessage ||
        DEFAULT_MESSAGES.missingEndpoint,
      extraFields:
        runtimeConfig.extraFields && typeof runtimeConfig.extraFields === "object"
          ? runtimeConfig.extraFields
          : {},
    };
  }

  function buildFormData(form, config) {
    const formData = new FormData(form);
    formData.set("consent", form.elements.consent && form.elements.consent.checked ? "true" : "false");
    formData.set("submittedAt", new Date().toISOString());
    formData.set("pageUrl", global.location.href);
    formData.set("pageTitle", global.document.title);

    Object.entries(config.extraFields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.set(key, String(value));
      }
    });

    return formData;
  }

  function buildRequestOptions(form, config) {
    const formData = buildFormData(form, config);

    if (config.payloadType === "form-data") {
      return {
        method: config.method,
        headers: {
          Accept: "application/json",
        },
        body: formData,
      };
    }

    const payload = {};
    formData.forEach((value, key) => {
      payload[key] = value;
    });

    return {
      method: config.method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    };
  }

  function resetLeadFormUi(form, feedbackNode) {
    const defaultMessage = ensureDefaultFeedback(feedbackNode);
    setSubmitState(form, false);
    setFeedback(feedbackNode, defaultMessage, "idle");
  }

  async function submitLeadForm(form, feedbackNode) {
    const config = normalizeConfig(form);

    if (!config.endpoint) {
      setFeedback(feedbackNode, config.missingEndpointMessage, "error");
      return;
    }

    setSubmitState(form, true);
    setFeedback(feedbackNode, config.pendingMessage, "pending");

    try {
      const response = await global.fetch(config.endpoint, buildRequestOptions(form, config));
      if (!response.ok) {
        throw new Error(`Lead form request failed with ${response.status}`);
      }

      form.reset();
      resetLeadFormUi(form, feedbackNode);
      setFeedback(feedbackNode, config.successMessage, "success");
    } catch (error) {
      console.error("Lead form submission failed", error);
      setSubmitState(form, false);
      setFeedback(feedbackNode, config.errorMessage, "error");
    }
  }

  function initLeadForm(formSelector = "#leadForm", feedbackSelector = "#formFeedback") {
    const form = global.document.querySelector(formSelector);
    const feedbackNode = global.document.querySelector(feedbackSelector);
    if (!form || form.dataset.hoopRushLeadFormReady === "true") return null;

    form.dataset.hoopRushLeadFormReady = "true";
    resetLeadFormUi(form, feedbackNode);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitLeadForm(form, feedbackNode);
    });

    form.addEventListener("hooprush:lead-form-reset", () => {
      resetLeadFormUi(form, feedbackNode);
    });

    return {
      form,
      feedbackNode,
      resetUi: () => resetLeadFormUi(form, feedbackNode),
      submit: () => submitLeadForm(form, feedbackNode),
    };
  }

  HoopRushModules.leadForm = {
    initLeadForm,
  };

  initLeadForm();
})(window);

(function initHoopRushContestTerms(global) {
  const rawTerms = `
Όροι & προϋποθέσεις Διαγωνισμού
A. Διοργανώτρια Διαγωνισμού
1. Η ανώνυμη εταιρία με την επωνυμία «ΦΥΣΙΚΟ ΑΕΡΙΟ ΕΛΛΗΝΙΚΗ ΕΤΑΙΡΕΙΑ
ΕΝΕΡΓΕΙΑΣ» που εδρεύει στην Αθήνα, στην Λεωφόρο Κηφισίας 7 («Εταιρεία»)
διοργανώνει προωθητική ενέργεια μέσω διαγωνισμού (καλούμενο εφεξής ο
«Διαγωνισμός»), με διενέργεια κλήρωσης (εφεξής η «Κλήρωση»), με τους
ακόλουθους όρους συμμετοχής (εφεξής οι «Όροι»), οι οποίοι θα είναι
αναρτημένοι και διαρκώς ενημερωμένοι κατά τη διάρκεια του Διαγωνισμού,
στον εξής σύνδεσμο https://www.fysikoaerioellados.gr/company/chrisima-
eggrafa/».
2. Οι διαγωνιζόμενοι (εφεξής «Συμμετέχοντες») θα λαμβάνουν γνώση του Διαγωνισμού μέσω διαφημιστικών προβολών στα μέσα κοινωνικής δικτύωσης, ενδεικτικά μέσω Meta ads, ή/και μέσω οργανικών αναρτήσεων της Εταιρείας. Μέσω σχετικού συνδέσμου, οι Συμμετέχοντες θα οδηγούνται σε ειδικά διαμορφωμένη ηλεκτρονική σελίδα (landing page), όπου θα μπορούν να ενημερώνονται για τις σχετικές πληροφορίες του Διαγωνισμού, όπως τον τρόπο συμμετοχής, τη διάρκεια και τα δώρα.
3. Σκοπός των παρόντων όρων είναι ο καθορισμός των όρων συμμετοχής στον
Διαγωνισμό, καθώς και της σχετικής ανάδειξης των νικητών στο πλαίσιο του
Διαγωνισμού αυτού.
4. Η συμμετοχή στον διαγωνισμό συνιστά αυτοδικαίως και ανεπιφύλακτη αποδοχή
των παρόντων Όρων χωρίς οποιαδήποτε περαιτέρω χρέωση ή διαδικασία.
5. Η Διοργανώτρια διατηρεί το δικαίωμα να τροποποιήσει τους Όρους (πέραν
αυτών της συναίνεσης για τη λήψη και επεξεργασία δεδομένων προσωπικού
χαρακτήρα) όπως, ενδεικτικώς να μεταθέσει τις ημερομηνίες διεξαγωγής του
Διαγωνισμού, να αλλάξει τα προσφερόμενα Δώρα σύμφωνα με την κρίση της
(σημειώνεται ότι οι όποιες τυχόν τροποποιήσεις αφορούν μόνο μελλοντικές
συμμετοχές και όχι τις ήδη ολοκληρωθείσες), ενημερώνοντας σχετικά το κοινό με
κάθε πρόσφορο μέσο και χωρίς να φέρει ουδεμία ευθύνη έναντι οποιουδήποτε
προσώπου, διαγωνιζόμενου ή μη. Η Εταιρεία θα αναρτά την εκάστοτε ισχύουσα
έκδοση των Όρων Χρήσης, προκειμένου να ενημερώνεται ο Συμμετέχων και
προτείνεται ο Συμμετέχων να ελέγχει ανά τακτά χρονικά διαστήματα το
περιεχόμενο της Ιστοσελίδας για ενδεχόμενες αλλαγές. Η εξακολούθηση της
συμμετοχής και μετά τις εκάστοτε αλλαγές σημαίνει την ανεπιφύλακτη εκ μέρους
του Συμμετέχοντος αποδοχή των όρων.

B. Διάρκεια Διαγωνισμού
1. Η διάρκεια του Διαγωνισμού ορίζεται από την 05/05/2026 έως και την 25/05/2026 (εφεξής η «Διάρκεια»).
2. Έγκυρες θεωρούνται οι συμμετοχές που θα υποβληθούν εντός της Διάρκειας
του Διαγωνισμού και θα πληρούν τις προϋποθέσεις των παρόντων Όρων.3. Διευκρινίζεται ρητά ότι, μετά τη λήξη του Διαγωνισμού την 25/05/2026 ή της
νέας ημερομηνίας, που θα οριστεί μετά από τυχόν μετάθεση ή αλλαγή της
χρονικής διάρκειας του διαγωνισμού, οι συμμετοχές δεν είναι πλέον δυνατές και
οι ήδη γενόμενες θεωρούνται αυτοδικαίως ανύπαρκτες και ουδέν επάγονται
αποτέλεσμα, ούτε δεσμεύουν πλέον το ΦΥΣΙΚΟ ΑΕΡΙΟ ΕΛΛΗΝΙΚΗ ΕΤΑΙΡΙΑ
ΕΝΕΡΓΕΙΑΣ. Στην περίπτωση αυτή, οι συμμετέχοντες με τη συμμετοχή τους στο
Διαγωνισμό αποδέχονται ανέκκλητα ότι δεν αποκτούν δικαίωμα ή απαίτηση
κατά του ΦΥΣΙΚΟΥ ΑΕΡΙΟΥ ΕΛΛΗΝΙΚΗ ΕΤΑΙΡΕΙΑ ΕΝΕΡΓΕΙΑΣ, ούτε
νομιμοποιούνται να ζητήσουν, είτε τη συνέχιση του λήξαντος Διαγωνισμού, είτε
παράδοση των μη παραδοθέντων δώρων, είτε άλλη περαιτέρω αποζημίωση.

Γ. Δικαίωμα και τρόπος συμμετοχής στο Διαγωνισμό
1. Δικαίωμα συμμετοχής στο διαγωνισμό έχουν όλα τα άτομα άνω των 18 ετών με
δικαιοπρακτική ικανότητα και διαμένουν μόνιμα στην Ελλάδα καθώς και οι
συγγενείς τους α' και β’ βαθμού και οι σύζυγοί τους. Στους διαγωνισμούς δεν
έχουν δικαίωμα συμμετοχής οι εργαζόμενοι του Διοργανωτή, καθώς και οι
συγγενείς τους μέχρι β’ βαθμό. Για όσους δεν έχουν συμπληρώσει το 18ο έτος
της ηλικίας τους η συμμετοχή είναι δυνατή μόνο με παρουσία του προσώπου που
ασκεί τη γονική μέριμνα για την παροχή συναίνεσης για τη συμμετοχή και για την
παραλαβή του δώρου σε περίπτωση που αναδειχθούν νικητές.
2. Κατά τη Διάρκεια του Διαγωνισμού, οι Συμμετέχοντες, προκειμένου να δηλώσουν τη συμμετοχή τους, θα πρέπει να μεταβούν στην ειδικά διαμορφωμένη ηλεκτρονική σελίδα (landing page) του Διαγωνισμού μέσω σχετικού συνδέσμου από διαφημιστική προβολή ή οργανική ανάρτηση της Εταιρείας. Στην landing page θα εμφανίζεται διαδραστικό παιχνίδι με θεματική μπάσκετ, στο οποίο ο Συμμετέχων καλείται να πραγματοποιήσει πέντε (5) βολές, μέσω swipe. Για να θεωρηθεί επιτυχής η συμμετοχή του στο παιχνίδι, ο Συμμετέχων θα πρέπει να σκοράρει τουλάχιστον τρεις (3) από τις πέντε (5) βολές. Σε περίπτωση που σκοράρει λιγότερες από τρεις (3) βολές, θα εμφανίζεται μήνυμα «Δοκίμασε ξανά» και ο Συμμετέχων θα έχει τη δυνατότητα να επαναλάβει το παιχνίδι.
Μετά την επιτυχή ολοκλήρωση του παιχνιδιού, θα εμφανίζεται σχετική οθόνη επιβράβευσης και ο Συμμετέχων θα καλείται να συμπληρώσει τα απαιτούμενα πεδία της φόρμας συμμετοχής, ήτοι e-mail, αριθμό κινητού τηλεφώνου και ταχυδρομικό κώδικα, καθώς και να αποδεχθεί τους παρόντες Όρους Συμμετοχής. Κατόπιν της επιτυχούς υποβολής της φόρμας, η συμμετοχή του καταχωρείται ως έγκυρη και λαμβάνει μέρος στην κλήρωση για τα δώρα. Διευκρινίζεται ότι, ανεξαρτήτως του αριθμού προσπαθειών στο παιχνίδι, κάθε πρόσωπο δικαιούται μόνο μία (1) έγκυρη συμμετοχή στην κλήρωση.
3. Με τη συμμετοχή του στο Διαγωνισμό ο συμμετέχων δηλώνει ανεπιφύλακτα την
αποδοχή των παρόντων όρων συμμετοχής στον εδώ αναφερόμενο Διαγωνισμό.

Δ. Δώρα Διαγωνισμού
1. Τα δώρα του Διαγωνισμού είναι τα κάτωθι:
α) Ένα (1) Samsung Projector.
β) Μία (1) Samsung τηλεόραση 4K OLED TV 55’’.
γ) Το ρεύμα της χρονιάς
Σχετικά με το μεγάλο δώρο του διαγωνισμού “Το ρεύμα της χρονιάς” πρόκειται για
Ένα (1) έτος δωρεάν κατανάλωσης ηλεκτρικού ρεύματος για ένα ορισμένο ακίνητο
από τον νικητή, με ανώτατο όριο κατανάλωσης έως 4.000 kWh και σύμφωνα με τους
όρους παροχής του ΦΥΣΙΚΟ ΑΕΡΙΟ ΕΛΛΗΝΙΚΗ ΕΤΑΙΡΕΙΑ ΕΝΕΡΓΕΙΑΣ.
Μετά από αυτό το όριο, η χρέωση θα γίνεται χωρίς την έκπτωση (100%), αλλά
κανονικά σύμφωνα με την ισχύουσα πολιτική τιμολόγησης του προϊόντος που θα
ισχύει στην περίπτωση αυτή. Η εξαργύρωση του δώρου θα πραγματοποιείται με τη
μορφή πίστωσης στους λογαριασμούς κατανάλωσης ηλεκτρικής ενέργειας του
νικητή, για διάστημα δώδεκα (12) μηνών από την ημερομηνία ενεργοποίησης του
δώρου. Το δώρο αφορά αποκλειστικά μία (1) παροχή ηλεκτρικού ρεύματος κατοικίας
που θα δηλώσει ο νικητής και δεν μεταβιβάζεται, δεν ανταλλάσσεται με μετρητά ή
άλλα αγαθά και δεν καλύπτει τυχόν οφειλές από προηγούμενους λογαριασμούς.
Έκαστο των δώρων είναι συγκεκριμένο, προσωπικό και δεν ανταλλάσσεται, ούτε
δύναται να ζητηθεί η αντικατάστασή του με άλλο ή η εξαργύρωσή του σε χρήμα
ή σε άλλα δώρα, σε οποιαδήποτε τιμή. Το ΦΥΣΙΚΟ ΑΕΡΙΟ ΕΛΛΗΝΙΚΗ ΕΤΑΙΡΕΙΑ
ΕΝΕΡΓΕΙΑΣ δε φέρει καμία ευθύνη για οτιδήποτε έχει σχέση με οποιοδήποτε εκ
των δώρων, εκτός της παράδοσής του στον εκάστοτε νικητή. Το δώρο που θα
παραδοθεί κατά τους παρόντες όρους παρέχεται στην κατάσταση στην οποία
αυτό έχει και ευρίσκεται, αποκλειόμενης της εφαρμογής των διατάξεων περί
ευθύνης του πωλητή ή άλλων διατάξεων που θεμελιώνουν ευθύνη αναφορικά με
πραγματικά ελαττώματα, συμφωνημένες ιδιότητες κ.λπ., έναντι του Φυσικού
Αερίου Ελληνική Εταιρεία Ενέργειας. Περαιτέρω, το Φυσικό Αέριο Ελληνική
Εταιρεία Ενέργειας δεν φέρει ουδεμία ευθύνη, ποινική ή αστική προς
οποιονδήποτε νικητή ή τρίτο, για οποιοδήποτε ατύχημα ήθελε συμβεί και/ή
ζημία και/ή βλάβη σωματική ή υλική ήθελε προκληθεί σε αυτούς, σχετιζόμενη
άμεσα ή έμμεσα με οποιοδήποτε εκ των δώρων ή για οποιαδήποτε άλλη αιτία.
Το Φυσικό Αέριο Ελληνική Εταιρεία Ενέργειας απαλλάσσεται από την υποχρέωση
παράδοσης δώρου σε περιπτώσεις που με οποιονδήποτε τρόπο δεν έχουν
τηρηθεί οι όροι συμμετοχής στον Διαγωνισμό.
2. Οι συμμετέχοντες στον διαγωνισμό παρέχουν τη συγκατάθεσή τους και την
εξουσιοδότηση στο ΦΥΣΙΚΟ ΑΕΡΙΟ ΕΛΛΗΝΙΚΗ ΕΤΑΙΡΕΙΑ ΕΝΕΡΓΕΙΑΣ για την
προβολή του διαγωνισμού και των αποτελεσμάτων του μέσω του έντυπου και
ηλεκτρονικού τύπου, μέσα κοινωνικής δικτύωσης κλπ.
3. Κάθε συμμετέχων ενημερώνεται ειδικώς ότι το ΦΥΣΙΚΟ ΑΕΡΙΟ ΕΛΛΗΝΙΚΗ
ΕΤΑΙΡΕΙΑ ΕΝΕΡΓΕΙΑΣ επιφυλάσσει για τον ίδιο το δικαίωμα να χρησιμοποιήσει και
να δημοσιεύσει οποιοδήποτε ειδησεογραφικό στοιχείο σχετικό με την κλήρωση
και την απονομή των Δώρων για διαφημιστικούς σκοπούς. Η συμμετοχή παρέχει
αυτομάτως αναφορικά με τα προαναφερόμενα και την προς τούτο συναίνεση και
εκχώρηση των αναγκαίων πνευματικών δικαιωμάτων ατελώς, χωρίς καμία οικονομική αξίωση ή απαίτηση των συμμετεχόντων και χωρίς την καταβολή σε
αυτούς οποιασδήποτε αμοιβής ή αποζημίωσης.

Ε. Κλήρωση - Ανάδειξη Νικητών
1. Μετά τη λήξη του Διαγωνισμού θα πραγματοποιηθεί μία (1) κλήρωση, με χρήση αποκλειστικά ηλεκτρονικών μέσων που δεν επιτρέπουν ανθρώπινη παρέμβαση, για την εξασφάλιση του τυχαίου και αδιάβλητου της διαδικασίας.
2. Στην κλήρωση θα συμμετέχουν όλες οι έγκυρες συμμετοχές που έχουν υποβληθεί από την έναρξη έως και τη λήξη του Διαγωνισμού, σύμφωνα με τα οριζόμενα στους παρόντες Όρους. Από την κλήρωση θα αναδειχθούν συνολικά τρεις (3) νικητές, οι οποίοι θα κερδίσουν τα δώρα του Διαγωνισμού ως εξής:
α) Ένας (1) νικητής θα κερδίσει το δώρο «Το Ρεύμα της Χρονιάς».
β) Ένας (1) νικητής θα κερδίσει ένα (1) Samsung Projector.
γ) Ένας (1) νικητής θα κερδίσει μία (1) Samsung τηλεόραση 4K OLED TV 55’’
Η αντιστοίχιση των δώρων στους νικητές θα πραγματοποιηθεί σύμφωνα με τη σειρά ανάδειξής τους κατά την κλήρωση ή/και σύμφωνα με τη διαδικασία που θα ορίσει ο Διοργανωτής.
3. Ο Διοργανωτής θα ενημερώνει τους νικητές τηλεφωνικά (μέσω κλήσης) στον
αριθμό κινητού τηλεφώνου που έχουν δηλώσει κατά τη συμμετοχή τους, το
αργότερο εντός σαράντα οκτώ (48) ωρών από την ημέρα πραγματοποίησης κάθε
κλήρωσης. Οι νικητές θα πρέπει να επικοινωνήσουν με το Φυσικό Αέριο Ελληνική
Εταιρεία Ενέργειας και να επιβεβαιώσουν τα στοιχεία τους, σύμφωνα με τις
οδηγίες που θα λάβουν, προκειμένου να οριστούν οι λεπτομέρειες για την
κατοχύρωση / αποστολή των δώρων. Αν οι νικητές δεν ανταποκριθούν σε
διάστημα σαράντα οχτώ (48) ωρών μετά την κλήρωση, το Φυσικό Αέριο Ελληνική
Εταιρεία Ενέργειας θα επικοινωνήσει με τον πρώτο (1ο) επιλαχόντα κατά σειρά
κλήρωσης. Αν ο πρώτος (1ος) επιλαχών δεν ανταποκριθεί σε διάστημα
εικοσιτεσσάρων (24) ωρών, το Φυσικό Αέριο Ελληνική Εταιρεία Ενέργειας θα
επικοινωνήσει με τον επόμενο επιλαχόντα. Σε περίπτωση που η επικοινωνία δεν
καταστεί δυνατή με κανέναν από τους επιλαχόντες μέσα σε χρονικό διάστημα
δέκα (10) ημερών, τότε το Δώρο θα ΑΚΥΡΩΘΕΙ.
4. Κατά την ηλεκτρονική επικοινωνία θα ζητούνται από τους νικητές τα πλήρη
στοιχεία τους (ονοματεπώνυμο, αριθμός κινητής τηλεφωνίας, διεύθυνση) για τη δυνατότητα εξακρίβωσης της ταυτοπροσωπίας κατά την κατοχύρωση/
παράδοση των Δώρων.
5. Όλα τα δώρα παρέχονται στον κάθε νικητή ως έχει, αποκλειόμενης της
εφαρμογής των διατάξεων περί ευθύνης του πωλητή ή άλλων διατάξεων του
δικαίου του καταναλωτή, οι οποίες θεμελιώνουν ευθύνη του Διοργανωτή
αναφορικά με πραγματικά ελαττώματα.

ΣΤ. Αποκλεισμός νικητή
1. Ο νικητής, σε οποιοδήποτε στάδιο, ακόμα και αυτό της παράδοσης και
παραλαβής του δώρου, μπορούν να αποκλεισθεί για τους εξής λόγους:
• σε περίπτωση που, για οποιονδήποτε λόγο, δεν αποδεχθεί πλήρως τους παρόντες όρους στο σύνολό τους, οι οποίοι θεωρούνται όλοι ουσιώδεις
• σε περίπτωση που η συμμετοχή του δεν πληροί κάποιον από τους όρους του παρόντος
• σε περίπτωση που κάποιο από τα στοιχεία που δήλωσε είναι ψευδές
• σε περίπτωση που η συμμετοχή τους αποτελεί, κατά την κρίση του Φυσικού Αερίου Ελληνική Εταιρεία Ενέργειας, αυτή καθ’ εαυτή προϊόν παράνομης τεχνικής επιρροής στα συστήματα του Φυσικού Αερίου Ελληνική Εταιρεία Ενέργειας ή εν γένει απάτης ή αθέμιτης παρεμβολής του συμμετέχοντα ή τρίτου
• σε περίπτωση που, για οποιονδήποτε λόγο δεν υπογράψει τη σχετική δήλωση παραλαβής και αποδοχής δώρου
6. Κατά την παραλαβή του δώρου, ο νικητής θα πρέπει να επιδείξει αστυνομική
ταυτότητα προκειμένου να βεβαιωθεί η ταυτοπροσωπία καθώς και το ενήλικο
της ηλικίας του. Σε περίπτωση που ο νικητής δεν έχει συμπληρώσει το 18ο έτος
της ηλικίας του, η παραλαβή του δώρου είναι δυνατή μόνο κατόπιν παρουσίας
του προσώπου που ασκεί τη γονική μέριμνα για την παροχή συναίνεσης. Ο
νικητής αναλαμβάνει αποκλειστικά την ευθύνη και τον έγκαιρο προγραμματισμό
για την διευθέτηση των παραπάνω λεπτομερειών ανάληψης του δώρου του.
7. Το Φυσικό Αέριο Ελληνική Εταιρεία Ενέργειας απαλλάσσεται από την
υποχρέωση παράδοσης δώρου σε περιπτώσεις που με οποιονδήποτε τρόπο δεν
έχουν τηρηθεί οι όροι συμμετοχής στο Διαγωνισμό.
8. Το Φυσικό Αέριο Ελληνική Εταιρεία Ενέργειας στο πλαίσιο του παρόντος
Διαγωνισμού, διατηρεί το δικαίωμα να ανακοινώνει τα ονόματα και να
δημοσιεύει φωτογραφίες, ηχητικές παραστάσεις και μαγνητοσκοπήσεις των
νικητών στους Δικτυακούς της Τόπους, σε οποιοδήποτε έντυπό της, καθώς και να
προβεί σε διαφημιστική εκμετάλλευση κάθε σχετικού γεγονότος, όπως της
αξιοποίησης του Δώρου κ.λ.π.
9. Κάθε νικητής με τη συμμετοχή του στο Διαγωνισμό, συναινεί ανεπιφύλακτα στα
ανωτέρω χωρίς την καταβολή οποιασδήποτε αμοιβής ή αποζημιώσεως. Με
επιφύλαξη των παραπάνω οριζόμενων, άρνηση του νικητή να συμμετάσχει σε σχετικό διαφημιστικό πρόγραμμα ή άλλη ανακοίνωση ή άρνηση να περιληφθεί
το όνομά του σε καταχωρήσεις, εφόσον κληθεί για τούτο, νομιμοποιεί το Φυσικό
Αέριο Ελληνική Εταιρεία Ενέργειας να αρνηθεί τη χορήγηση του σχετικού Δώρου,
ή να το ανακαλέσει. Η συμμετοχή στο διαγωνισμό συνεπάγεται ρητή και
ανεπιφύλακτη συναίνεση του συμμετέχοντα για την καταχώρηση δεδομένων
προσωπικού χαρακτήρα που τον αφορούν σε αρχείο που θα τηρείται από την
εταιρεία Φυσικό Αέριο Ελληνική Εταιρεία Ενέργειας σύμφωνα με τις διατάξεις
της εθνικής νομοθεσίας και του Γενικού Κανονισμού περί Προστασίας
Προσωπικών Δεδομένων (ΕΕ 679/2016) με σκοπό και στα πλαίσια της διενέργειας
του Διαγωνισμού.

Ζ. Τροποποίηση Όρων – Δώρων
1. Το Φυσικό Αέριο Ελληνική Εταιρεία Ενέργειας διατηρεί το δικαίωμα για εύλογη αιτία
να αλλάξει οποτεδήποτε τους όρους και το δώρο, να αναβάλει ή και να ματαιώσει το
Διαγωνισμό και την κλήρωση, χωρίς καμία πρότερη προειδοποίηση. Στην περίπτωση
αυτή το Φυσικό Αέριο Ελληνική Εταιρεία Ενέργειας δεν θα υπέχει οποιαδήποτε υποχρέωση
για τυχόν αποζημίωση προς τον τυχερό, που θα αναδειχθεί από την εν λόγω κλήρωση.

Η. Περιορισμός ευθύνης του Φυσικού Αερίου Ελληνική Εταιρεία Ενέργειας
1. Το Φυσικό Αέριο Ελληνική Εταιρεία Ενέργειας και οι τυχόν συνδεδεμένες με
αυτήν εταιρείες, οι υπάλληλοι και τα διευθυντικά στελέχη τους δεν φέρουν καμιά
απολύτως ευθύνη, στον βαθμό που αποκλεισμός της ευθύνης επιτρέπεται από
το νόμο, για οποιαδήποτε άμεση, έμμεση, ηθική, θετική ή άλλου είδους ζημία
προέρχεται από ή συνδέεται με τη πραγματοποίηση του συγκεκριμένου
Διαγωνισμού.
2. Το Φυσικό Αέριο Ελληνική Εταιρεία Ενέργειας δεν ευθύνεται σε οποιαδήποτε
περίπτωση για τυχόν άμεσες ή έμμεσες ζημίες, δαπάνες και έξοδα που μπορεί να
προκύψουν από τυχόν διακοπή, δυσλειτουργία ή καθυστέρηση, απόδοση και
γενικά με την πραγματική και νομική κατάσταση των Δώρων του Διαγωνισμού.
3. Επίσης, το Φυσικό Αέριο Ελληνική Εταιρεία Ενέργειας δεν υπέχει οποιαδήποτε
ευθύνη, ποινική ή αστική προς οποιονδήποτε νικητή ή τρίτο, για οποιοδήποτε
ατύχημα ήθελε συμβεί και/ή ζημία και/ή βλάβη σωματική ή υλική ήθελε
προκληθεί σε αυτούς, κατά τη χρήση των Δώρων, ή για οποιαδήποτε άλλη αιτία.

Θ. Λήξη Διαγωνισμού
1. Μετά τη λήξη του Διαγωνισμού καθώς και του πέρατος της διαδικασίας διανομής
των Δώρων κατά τα προαναφερόμενα, κάθε υποχρέωση το Φυσικό Αέριο
Ελληνική Εταιρεία Ενέργειας παύει να υφίσταται. Το Φυσικό Αέριο Ελληνική
Εταιρεία Ενέργειας δεν θα υπέχει οποιαδήποτε άλλη υποχρέωση έναντι των
Συμμετεχόντων.

Ι. Προσωπικά Δεδομένα
1. Στο πλαίσιο του Διαγωνισμού, το ΦΥΣΙΚΟ ΑΕΡΙΟ ΕΛΛΗΝΙΚΗ ΕΤΑΙΡΕΙΑ ΕΝΕΡΓΕΙΑΣ
θα τηρήσει αρχείο και θα συλλέξει απλά προσωπικά δεδομένα για το σκοπό
πραγματοποίησης του παρόντος Διαγωνισμού, λειτουργώντας ως Υπεύθυνος
Επεξεργασίας των δεδομένων. Τα προσωπικά δεδομένα που συλλέγονται από το
ΦΥΣΙΚΟ ΑΕΡΙΟ ΕΛΛΗΝΙΚΗ ΕΤΑΙΡΕΙΑ ΕΝΕΡΓΕΙΑΣ και θα αποτελέσουν αντικείμενο
επεξεργασίας, σύμφωνα με τους παρόντες όρους, περιλαμβάνουν τα εξής: (α)
όνομα, (β) επώνυμο, (γ) e-mail, (δ) οποιοδήποτε άλλο προσωπικό στοιχείο τεθεί
οικειοθελώς υπόψη της Διοργανώτριας Εταιρείας στο πλαίσιο του περιεχομένου
της προσωπικής ιστορίας των συμμετεχόντων.
3. Η συμμετοχή εκάστου ενδιαφερομένου στο Διαγωνισμό αποτελεί σαφή, ρητή
και με πλήρη επίγνωση δήλωση συναίνεσης, κατά την έννοια του Κανονισμού
Ε.Ε. 2016/679 (GDPR) και του ελληνικού νόμου 4624/2019, σχετικά με: (α) τη
χρήση των προσωπικών του δεδομένων για τις ανάγκες διεξαγωγής και
δημοσιότητας του Διαγωνισμού, καθώς και (β) για σκοπούς ενημέρωσης και
επικοινωνίας, σχετικά με το Διαγωνισμό. Ο Συμμετέχων μπορεί να ανακαλέσει
τη συναίνεσή του ανά πάσα στιγμή ελεύθερα.
4. Αποδέκτες των προσωπικών δεδομένων των συμμετεχόντων και των νικητών θα
είναι κατ’ αρχήν μόνο οι αρμοδίως εξουσιοδοτημένοι υπάλληλοι του ΦΥΣΙΚΟ
ΑΕΡΙΟ ΕΛΛΗΝΙΚΗ ΕΤΑΙΡΕΙΑ ΕΝΕΡΓΕΙΑΣ που είναι επιφορτισμένοι με καθήκοντα
για τη διεξαγωγή του παρόντος Διαγωνισμού. Επιπλέον, στο πλαίσιο της
επεξεργασίας αυτής και για τις ανάγκες της υλοποίησης του Διαγωνισμού, το
ΦΥΣΙΚΟ ΑΕΡΙΟ ΕΛΛΗΝΙΚΗ ΕΤΑΙΡΕΙΑ ΕΝΕΡΓΕΙΑΣ μπορεί να αξιοποιήσει υπηρεσίες
τρίτων μερών, στα οποία ενδέχεται να κοινοποιηθούν τα προσωπικά δεδομένα
των συμμετεχόντων και των νικητών, λειτουργώντας υπ’ αυτή την έννοια ως
εκτελούντες την επεξεργασία, ήτοι ιδίως την εταιρεία με την οποία
συνεργάζεται για τη διεξαγωγή του Διαγωνισμού.
5. Η συμμετοχή στο Διαγωνισμό συνεπάγεται ρητή και ανεπιφύλακτη συναίνεση
του Συμμετέχοντα τόσο για την καταχώρηση δεδομένων προσωπικού
χαρακτήρα, τα οποία τον αφορούν σε αρχείο που θα τηρείται από την Εταιρεία
όσο και την επεξεργασία των δεδομένων αυτών, σύμφωνα με τις διατάξεις της
εθνικής νομοθεσίας και του Γενικού Κανονισμού περί Προστασίας Προσωπικών
Δεδομένων (ΕΕ 679/2016), στα πλαίσια της διενέργειας και της επίτευξης του
σκοπού του Διαγωνισμού.
6. Όσον αφορά τον νικητή του Διαγωνισμού και τους τυχόν επιλαχόντες αυτών, το
ΦΥΣΙΚΟ ΑΕΡΙΟ ΕΛΛΗΝΙΚΗ ΕΤΑΙΡΕΙΑ ΕΝΕΡΓΕΙΑΣ ενημερώνει ότι η ίδια θα
επεξεργασθεί τα δεδομένα προσωπικού χαρακτήρα τους, που θα συλλέξει από
τους ίδιους, με σκοπό την ενημέρωσή τους και τη δημοσίευση των
αποτελεσμάτων του Διαγωνισμού, σύμφωνα με τα ειδικότερα οριζόμενα στους
παρόντες Όρους, καθώς και την πραγματοποίηση όλων των αναγκαίων
ενεργειών για την παράδοση του Δώρου.
7. Μετά την παράδοση του Δώρου και τη λήξη του Διαγωνισμού, οποιαδήποτε
δεδομένα, προσωπικού χαρακτήρα ή μη των συμμετεχόντων, του νικητή και7. τυχόν επιλαχόντων του Διαγωνισμού, που ελήφθησαν στα πλαίσια του
παρόντος Διαγωνισμού, θα καταστρέφονται
8. Για τυχόν άσκηση από το νικητή του Διαγωνισμού ή/και τους τυχόν επιλαχόντες
των δικαιωμάτων τους που απορρέουν από τις διατάξεις της εθνικής
Νομοθεσίας και του Γενικού Κανονισμού περί Προστασίας Προσωπικών
Δεδομένων (ΕΕ 679/2016), οι τελευταίοι μπορούν να επικοινωνήσουν με
εκπρόσωπο του ΦΥΣΙΚΟ ΑΕΡΙΟ ΕΛΛΗΝΙΚΗ ΕΤΑΙΡΕΙΑ ΕΝΕΡΓΕΙΑΣ ή να
αποστείλουν σχετικό ερώτημα στο customerservice@fysikoaerioellados.gr
9. Με την παροχή της σχετικής, προαιρετικής συγκατάθεσής του, ο Συμμετέχων συναινεί όπως το ΦΥΣΙΚΟ ΑΕΡΙΟ ΕΛΛΗΝΙΚΗ ΕΤΑΙΡΕΙΑ ΕΝΕΡΓΕΙΑΣ επεξεργάζεται τα προσωπικά του δεδομένα (όπως στοιχεία επικοινωνίας) για σκοπούς εμπορικής προώθησης προϊόντων και υπηρεσιών του, μέσω ηλεκτρονικών ή/και συμβατικών μέσων επικοινωνίας (ενδεικτικά e-mail, SMS, τηλεφωνική επικοινωνία). Η ανωτέρω συγκατάθεση είναι ελεύθερη και μπορεί να ανακληθεί οποτεδήποτε, χωρίς καμία επίπτωση στη συμμετοχή του στον Διαγωνισμό, μέσω των διαθέσιμων καναλιών επικοινωνίας της Εταιρείας ή σύμφωνα με τις οδηγίες που παρέχονται σε κάθε σχετική επικοινωνία.

Κ. Δωσιδικία
1. Οποιαδήποτε διαφορά σχετικά με το Διαγωνισμό και τους όρους συμμετοχής σε
αυτόν, επιλύεται από τα δικαστήρια των Αθηνών, ενώ ως εφαρμοστέο δίκαιο
ορίζεται το Ελληνικό.

Λ. Αποδοχή των όρων
a. Η συμμετοχή στο Διαγωνισμό προϋποθέτει και συνεπάγεται τη ρητή και
ανεπιφύλακτη αποδοχή του συνόλου των Όρων, παραιτούμενου εκάστου
συμμετέχοντος από την προσβολή εγκυρότητας των Όρων του Διαγωνισμού και
από τη διεκδίκηση οποιασδήποτε αποζημιώσεως με αφορμή ή εξαιτίας αυτού.
`.trim();

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderTerms(text) {
    const lines = text.split(/\n/);
    const html = [];
    let paragraph = [];
    let list = [];

    function flushParagraph() {
      if (!paragraph.length) return;
      html.push(`<p>${escapeHtml(paragraph.join(" ").replace(/\s+/g, " ").trim())}</p>`);
      paragraph = [];
    }

    function flushList() {
      if (!list.length) return;
      html.push(`<ul>${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
      list = [];
    }

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        flushParagraph();
        flushList();
        return;
      }

      if (/^[A-ZΑ-ΩΆ-Ώ]\.\s/.test(trimmed) || /^[Α-ΩΆ-Ώ]\.\s/.test(trimmed)) {
        flushParagraph();
        flushList();
        html.push(`<h3>${escapeHtml(trimmed)}</h3>`);
        return;
      }

      if (/^(\d+|[a-z])\.\s/.test(trimmed)) {
        flushParagraph();
      }

      if (trimmed.startsWith("•")) {
        flushParagraph();
        list.push(trimmed.replace(/^•\s*/, ""));
        return;
      }

      paragraph.push(trimmed);
    });

    flushParagraph();
    flushList();

    return html.join("");
  }

  global.HoopRushContestTermsHtml = renderTerms(rawTerms);
})(window);
