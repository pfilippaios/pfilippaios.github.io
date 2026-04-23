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
