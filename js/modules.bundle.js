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

    function loadAsync(src, label, priority = "low") {
      return new Promise((resolve) => {
        loadImageAsset({
          primarySrc: src,
          onLoad: (img) => resolve(img),
          onFinalError: (img) => resolve(img),
          label: label,
          priority,
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
        loadAsync(src, `net-frame-${key}`, "high").then((img) => {
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
    audio.__warmRequested = false;
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
    const netPool = createPool(netSrc, 1, netVolume, { preload: "auto" });
    const dropPool = createPool(dropSrc, 1, dropVolume, { preload: "auto" });
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

    function warmAudioElement(audio) {
      if (!audio || audio.__warmRequested) return;
      audio.__warmRequested = true;

      const originalVolume = audio.volume;
      audio.volume = 0;
      audio.muted = true;

      const restore = () => {
        audio.pause();
        audio.volume = originalVolume;
        audio.muted = muted;
        try {
          audio.currentTime = 0;
        } catch (error) {
          // Ignore seek errors while the browser finishes preparing media.
        }
      };

      try {
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === "function") {
          playPromise.then(restore).catch(restore);
          return;
        }
      } catch (error) {
        // Some mobile browsers still reject warm-up playback. The later real play handles it.
      }

      restore();
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
      [...netPool, ...dropPool, ...hitPools.flat()].forEach((audio) => {
        ensureAudioLoaded(audio);
        warmAudioElement(audio);
      });
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

    const auxBodyCache = new Map();

    function resolveAuxBody(page) {
      if (typeof page.body === "string") return page.body;
      if (page.bodyTemplateId) {
        if (auxBodyCache.has(page.bodyTemplateId)) return auxBodyCache.get(page.bodyTemplateId);
        const tpl = document.getElementById(page.bodyTemplateId);
        const html = tpl && tpl.content
          ? Array.from(tpl.content.childNodes)
              .map((n) => (n.outerHTML !== undefined ? n.outerHTML : n.textContent))
              .join("")
          : (tpl ? tpl.innerHTML : "");
        auxBodyCache.set(page.bodyTemplateId, html);
        return html;
      }
      return "";
    }

    function openAuxPage(pageKey) {
      const page = auxPages[pageKey];
      if (!page) return;
      auxOverlayTitle.textContent = page.title;
      auxOverlayContent.innerHTML = resolveAuxBody(page);
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

    let cachedRect = canvas.getBoundingClientRect();
    let rectDirty = false;
    const markRectDirty = () => { rectDirty = true; };
    if (typeof window !== "undefined") {
      window.addEventListener("resize", markRectDirty, { passive: true });
      window.addEventListener("scroll", markRectDirty, { passive: true });
      window.addEventListener("orientationchange", markRectDirty, { passive: true });
    }

    function getPointerPosition(event) {
      if (rectDirty) {
        cachedRect = canvas.getBoundingClientRect();
        rectDirty = false;
      }
      const rect = cachedRect;
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
      rectDirty = true;
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
          const tx = (pt.x - r) | 0;
          const ty = (pt.y - r) | 0;
          ctx.drawImage(ballImage, tx, ty, r * 2, r * 2);
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

    const aimGuidePoints = [];
    let aimGuideKeyRx = NaN;
    let aimGuideKeyRy = NaN;
    let aimGuideKeyAssist = -1;
    let aimGuideStartX = NaN;
    let aimGuideStartY = NaN;

    function recomputeAimGuidePoints(dx, dy) {
      const previewLaunch = getCachedAimLaunch(dx, dy);
      let px = ball.x;
      let py = ball.y;
      let vx = previewLaunch.vx;
      let vy = previewLaunch.vy;
      let sp = previewLaunch.spin;
      const pts = aimGuidePoints;
      pts.length = 0;
      pts.push(px, py);
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
        pts.push(px, py);
        if (py < 0 || px < 0 || px > GAME_WIDTH || py > GAME_HEIGHT) break;
      }
    }

    function drawAimGuide() {
      if (!state.dragging || !state.pointerStart || !state.pointerCurrent) return;
      const dx = state.pointerCurrent.x - state.pointerStart.x;
      const dy = state.pointerCurrent.y - state.pointerStart.y;
      const rx = Math.round(dx * 2);
      const ry = Math.round(dy * 2);
      const assist = state.assistMode ? 1 : 0;
      if (
        rx !== aimGuideKeyRx ||
        ry !== aimGuideKeyRy ||
        assist !== aimGuideKeyAssist ||
        ball.x !== aimGuideStartX ||
        ball.y !== aimGuideStartY
      ) {
        aimGuideKeyRx = rx;
        aimGuideKeyRy = ry;
        aimGuideKeyAssist = assist;
        aimGuideStartX = ball.x;
        aimGuideStartY = ball.y;
        recomputeAimGuidePoints(dx, dy);
      }

      const pts = aimGuidePoints;
      if (pts.length < 4) return;

      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) {
        ctx.lineTo(pts[i], pts[i + 1]);
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

    let aimCacheRx = NaN;
    let aimCacheRy = NaN;
    let aimCacheAssist = -1;
    let aimCacheLaunch = null;

    function getCachedAimLaunch(dx, dy) {
      const rx = Math.round(dx * 2);
      const ry = Math.round(dy * 2);
      const assist = state.assistMode ? 1 : 0;
      if (
        rx !== aimCacheRx ||
        ry !== aimCacheRy ||
        assist !== aimCacheAssist ||
        !aimCacheLaunch
      ) {
        aimCacheRx = rx;
        aimCacheRy = ry;
        aimCacheAssist = assist;
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
      setFeedback(feedbackNode, "", "idle");
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
