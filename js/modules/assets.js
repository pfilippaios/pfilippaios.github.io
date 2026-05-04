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

    const bgImage = loadImageAsset({
      primarySrc: "./assets/game/background/bg.webp",
      priority: "high",
    });

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
