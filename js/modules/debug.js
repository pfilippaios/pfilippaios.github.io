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

    const debug = {
      entries: [],
      fileLog: [],
      markers: [],
      latestHit: null,
      max: 120,
      markerMax: 28,
      markerTtlMs: 2800,
      log(msg, level = "info") {
        const t = (performance.now() / 1000).toFixed(2);
        this.entries.push({ t, msg, level });
        this.fileLog.push(`[${t}] [${level.toUpperCase()}] ${msg}`);
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
        const blob = new Blob([this.fileLog.join("\n")], { type: "text/plain" });
        const anchor = document.createElement("a");
        anchor.href = URL.createObjectURL(blob);
        anchor.download = `hoop-rush-${Date.now()}.log`;
        anchor.click();
        URL.revokeObjectURL(anchor.href);
      },
      async copy() {
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
        if (!enabled) return;
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
ball.x=${ball.x.toFixed(1)} y=${ball.y.toFixed(1)} z=${ball.z.toFixed(1)}
ball.vx=${ball.vx.toFixed(2)} vy=${ball.vy.toFixed(2)} flight=${ball.flightTime || 0} frontGrace=${ball.frontRimGraceUsed}
logLines=${this.fileLog.length} markers=${this.markers.length} lastHit=${lastHit}`;
      },
    };

    if (!enabled && debugPanel) {
      debugPanel.hidden = true;
      debugPanel.style.display = "none";
    }

    if (enabled && debugClearBtn) {
      debugClearBtn.addEventListener("click", () => debug.clear());
    }
    if (enabled && debugCopyBtn) {
      debugCopyBtn.addEventListener("click", async () => {
        try {
          await debug.copy();
          debug.log("copied full debug log to clipboard", "evt");
        } catch (error) {
          debug.log(`copy-log failed: ${error.message}`, "err");
        }
      });
    }
    if (enabled && debugDownloadBtn) {
      debugDownloadBtn.addEventListener("click", () => debug.download());
    }
    if (enabled && debugToggleBtn) {
      debugToggleBtn.addEventListener("click", () => {
        if (!debugPanel) return;
        debugPanel.classList.toggle("collapsed");
        debugToggleBtn.textContent = debugPanel.classList.contains("collapsed") ? "Show" : "Hide";
      });
    }

    if (enabled) {
      global.__hoopRushDebug = debug;
      global.addEventListener("keydown", (event) => {
        if (!debugPanel) return;
        if (event.key === "d" || event.key === "D") {
          debugPanel.classList.toggle("collapsed");
          if (debugToggleBtn) debugToggleBtn.textContent = debugPanel.classList.contains("collapsed") ? "Show" : "Hide";
        }
        if (event.key === "l" || event.key === "L") {
          debug.download();
        }
      });
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
