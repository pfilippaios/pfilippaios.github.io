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
