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
        const frames = createCrowdFramesFromImage(image);
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

    function createCrowdFramesFromImage(image) {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (width === 0 || height === 0) return [];
      
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

        let spanStart = null;

        for (let x = 0; x < occupiedColumns.length; x++) {
          if (occupiedColumns[x]) {
            if (spanStart === null) spanStart = x;
            continue;
          }

          if (spanStart !== null) {
            spans.push({ start: spanStart, end: x - 1 });
            spanStart = null;
          }
        }

        if (spanStart !== null) {
          spans.push({ start: spanStart, end: occupiedColumns.length - 1 });
        }
      } catch (e) {
        console.warn("Crowd system: getImageData failed (CORS), using fallback spans");
        pixelData = null; // Do not attempt precise Y-crop when CORS fails
        if (width === 2001) { // crowd_left
          spans = [{start: 0, end: 286}, {start: 358, end: 630}, {start: 696, end: 966}, {start: 1028, end: 1296}, {start: 1378, end: 1656}, {start: 1732, end: 2000}];
        } else if (width === 2030) { // crowd_center
          spans = [{start: 0, end: 289}, {start: 360, end: 641}, {start: 709, end: 994}, {start: 1038, end: 1319}, {start: 1386, end: 1672}, {start: 1742, end: 2029}];
        } else if (width === 2047) { // crowd_right
          spans = [{start: 0, end: 286}, {start: 354, end: 679}, {start: 725, end: 998}, {start: 1050, end: 1365}, {start: 1418, end: 1687}, {start: 1776, end: 2046}];
        } else {
          // Generic 6-frame slice
          const fw = Math.floor(width / 6);
          for (let i = 0; i < 6; i++) {
            spans.push({ start: i * fw, end: (i + 1) * fw - 1 });
          }
        }
      }

      return spans
        .map((span) => createCrowdFrameCanvas(sourceCanvas, pixelData, span))
        .filter(Boolean);
    }

    function createCrowdFrameCanvas(sourceCanvas, pixelData, span) {
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

      const wave = Math.sin(now * instance.waveSpeed + instance.bobPhase);
      const bob = wave * instance.bobAmplitude;
      const sway = Math.sin(now * instance.waveSpeed * 0.72 + instance.bobPhase) * instance.swayAmplitude;
      const tilt = wave * instance.tiltAmplitude;
      const pulseX = 1 + Math.max(0, wave) * 0.018;
      const pulseY = 1 + Math.max(0, -wave) * 0.014;
      const spriteWidth = frame.width * instance.scale;
      const spriteHeight = frame.height * instance.scale;
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
