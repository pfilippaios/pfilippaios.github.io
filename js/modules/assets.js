(function initHoopRushAssets(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createAssetSystem({
    enableBird = false,
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
    let crowdSequencesResolved = 0;

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
    const criticalAssetCount = 4;

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
      scheduleBackgroundWork(startDeferredAssetLoads);
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

    function loadImageAsset({
      primarySrc,
      onLoad = onCriticalAssetLoad,
      onFinalError = onCriticalAssetLoad,
      label = primarySrc,
      priority = "auto",
    }) {
      const image = prepareImageElement(new Image(), priority);

      image.onload = () => onLoad(image);
      image.onerror = () => {
        console.warn(`Failed to load image asset: ${label}`);
        onFinalError(image);
      };
      image.src = primarySrc;

      return image;
    }

    const bgImage = loadImageAsset({
      primarySrc: "./assets/game/background/bg.webp",
      priority: "high",
    });

    const ballImage = loadImageAsset({
      primarySrc: "./assets/game/ball/ball.webp",
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

    function settleCrowdSequences() {
      crowdSequencesResolved++;

      if (crowdSequencesResolved !== crowdSequenceKeys.length) return;

      if (Object.keys(crowdSequenceImages).length) {
        onCrowdSequencesReady(crowdSequenceImages);
        return;
      }

      onCrowdSequencesError();
    }

    function startDeferredAssetLoads() {
      if (deferredAssetsStarted) return;
      deferredAssetsStarted = true;

      for (let index = 0; index < ballSpinFrameCount; index++) {
        ballSpinFrames[index] = loadImageAsset({
          primarySrc: `./assets/game/ball/ball-spin-${index + 1}.webp`,
          onLoad: () => {},
          onFinalError: () => {},
          label: `ball-spin-${index + 1}`,
        });
      }

      netFrameAssets.slice(1).forEach(({ key, src }, index) => {
        netFrames[index + 1] = loadImageAsset({
          primarySrc: src,
          onLoad: () => {},
          onFinalError: () => {},
          label: `net-frame-${key}`,
        });
      });

      if (enableBird) {
        for (let index = 0; index < birdFrameCount; index++) {
          birdFrames[index] = loadImageAsset({
            primarySrc: `./assets/game/bird/bird-smooth-${index + 1}.webp`,
            onLoad: () => {},
            onFinalError: () => {},
            label: `bird-frame-${index + 1}`,
          });
        }
      }

      crowdSequenceKeys.forEach((key) => {
        loadImageAsset({
          primarySrc: `./assets/game/crowd/crowd_${key}.webp`,
          onLoad: (image) => {
            crowdSequenceImages[key] = image;
            settleCrowdSequences();
          },
          onFinalError: () => {
            settleCrowdSequences();
          },
          label: `crowd-${key}`,
        });
      });
    }

    return {
      bgImage,
      ballImage,
      ballSpinFrames,
      netFrames,
      frontHoopImage,
      birdFrames,
      isFrontHoopReady: () => frontHoopReady,
    };
  }

  HoopRushModules.assets = {
    createAssetSystem,
  };
})(window);
