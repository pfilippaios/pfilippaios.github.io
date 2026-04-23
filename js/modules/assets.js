(function initHoopRushAssets(global) {
  const HoopRushModules = global.HoopRushModules || (global.HoopRushModules = {});

  function createAssetSystem({
    onAllReady,
    onCrowdSequencesReady,
    onCrowdSequencesError,
  }) {
    let assetsLoaded = 0;
    let frontHoopReady = false;
    const crowdSequenceImages = {};
    const crowdSequenceKeys = ["left", "center", "right"];
    let crowdSequencesResolved = 0;

    const ballSpinFrameCount = 8;
    const birdFrameCount = 8;
    const netFrameAssets = [
      { key: "idle", src: "./assets/net-state-01-idle.webp" },
      { key: "preopen", src: "./assets/net-state-02-preopen.webp" },
      { key: "catch", src: "./assets/net-state-03-catch.webp" },
      { key: "drop", src: "./assets/net-state-04-drop.webp" },
      { key: "stretch", src: "./assets/net-state-05-stretch.webp" },
      { key: "swayLeft", src: "./assets/net-state-06-sway-left.webp" },
      { key: "swayRight", src: "./assets/net-state-07-sway-right.webp" },
      { key: "recoil", src: "./assets/net-state-08-recoil.webp" },
    ];
    const totalAssets = 1 + 1 + ballSpinFrameCount + netFrameAssets.length + 1 + birdFrameCount + crowdSequenceKeys.length;

    function onAssetLoad() {
      assetsLoaded++;
      if (assetsLoaded >= totalAssets) {
        onAllReady();
      }
    }

    function loadImageAsset({ primarySrc, onLoad = onAssetLoad, onFinalError = onAssetLoad, label = primarySrc }) {
      const image = new Image();

      image.onload = () => onLoad(image);
      image.onerror = () => {
        console.warn(`Failed to load image asset: ${label}`);
        onFinalError(image);
      };
      image.src = primarySrc;

      return image;
    }

    const bgImage = loadImageAsset({
      primarySrc: "./assets/bg.webp",
    });

    const ballImage = loadImageAsset({
      primarySrc: "./assets/ball.webp",
    });

    const ballSpinFrames = Array.from({ length: ballSpinFrameCount }, (_, index) => {
      return loadImageAsset({
        primarySrc: `./assets/ball-spin-${index + 1}.webp`,
        label: `ball-spin-${index + 1}`,
      });
    });

    const netFrames = netFrameAssets.map(({ key, src }) => {
      return loadImageAsset({
        primarySrc: src,
        label: `net-frame-${key}`,
      });
    });

    const frontHoopImage = loadImageAsset({
      primarySrc: "./assets/front-hoop.webp",
      onLoad: () => {
        frontHoopReady = true;
        onAssetLoad();
      },
    });

    const birdFrames = Array.from({ length: birdFrameCount }, (_, index) => {
      return loadImageAsset({
        primarySrc: `./assets/bird-smooth-${index + 1}.webp`,
        label: `bird-frame-${index + 1}`,
      });
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

    crowdSequenceKeys.forEach((key) => {
      loadImageAsset({
        primarySrc: `./assets/crowd_${key}.png`,
        onLoad: (image) => {
          crowdSequenceImages[key] = image;
          settleCrowdSequences();
          onAssetLoad();
        },
        onFinalError: () => {
          settleCrowdSequences();
          onAssetLoad();
        },
        label: `crowd-${key}`,
      });
    });

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
