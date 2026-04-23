(function initHoopRushAudio(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createAudioElement(src, { loop = false, volume = 1 } = {}) {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.loop = loop;
    audio.volume = volume;
    audio.__baseVolume = volume;
    audio.playsInline = true;
    audio.setAttribute("playsinline", "");
    audio.load();
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

  function createPool(src, size, volume) {
    return Array.from({ length: size }, () => createAudioElement(src, { volume }));
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

    function syncMuted(audio) {
      audio.muted = muted;
      return audio;
    }

    const crowdLoop = createAudioElement(crowdSrc, { loop: false, volume: 0 });
    const bgMusicLoop = bgMusicSrc
      ? createAudioElement(bgMusicSrc, { loop: true, volume: 0 })
      : null;
    const netPool = createPool(netSrc, 1, netVolume);
    const dropPool = createPool(dropSrc, 1, dropVolume);
    const hitPools = hitSources.map((src) => createPool(src, 1, hitVolume));
    const loopStates = {
      crowd: {
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
      },
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
      global.cancelAnimationFrame(loopState.segmentFrame);
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
          loopState.segmentFrame = 0;
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

        loopState.segmentFrame = global.requestAnimationFrame(step);
      }

      loopState.segmentFrame = global.requestAnimationFrame(step);
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
