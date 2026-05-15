(() => {
  const MIN_VISIBLE_MS = 400;
  const steps = ["讀懂意思", "找出重點", "整理成卡片"];
  const state = {
    isLoading: false,
    visible: false,
    elapsedMs: 0,
    startedAt: 0,
    showTimer: 0,
    tickTimer: 0,
    lastSubmitAt: 0,
  };

  const originalFetch = window.fetch.bind(window);
  const form = document.querySelector("#lesson-form");
  const input = document.querySelector("#sentence-input");
  const gameHeader = document.querySelector("#game-header");
  const lessonShell = document.querySelector("#lesson-shell");
  const structurePanel = document.querySelector("#structure-panel");
  const categoryTabs = document.querySelector("#category-tabs");
  const resultsList = document.querySelector("#results-list");
  const practicePanel = document.querySelector("#practice-panel");

  if (!form || !input || !gameHeader || !resultsList) return;

  form.addEventListener("submit", blockWhileLoading, true);
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing) return;
    blockWhileLoading(event);
  }, true);

  window.fetch = async (resource, options) => {
    if (!isAnalyzeRequest(resource)) return originalFetch(resource, options);

    beginLoading();
    try {
      const response = await originalFetch(resource, options);
      if (!response.ok) scheduleErrorState();
      return response;
    } catch (error) {
      scheduleErrorState();
      throw error;
    } finally {
      finishLoading();
    }
  };

  new MutationObserver(() => {
    const headerText = gameHeader.textContent || "";
    if (state.isLoading && /判斷中|分析中|AI 思考中|處理中|生成中|Thinking/.test(headerText)) {
      gameHeader.textContent = "";
    }
    const bodyText = `${headerText} ${resultsList.textContent || ""}`;
    if (!state.isLoading && /暫時無法分析|API 暫時沒有回應|Could not analyze/.test(bodyText)) {
      renderErrorState();
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  function blockWhileLoading(event) {
    if (!state.isLoading) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function isAnalyzeRequest(resource) {
    const url = typeof resource === "string" ? resource : resource && resource.url;
    return typeof url === "string" && url.includes("/api/analyze");
  }

  function beginLoading() {
    clearTimers();
    state.isLoading = true;
    state.visible = false;
    state.elapsedMs = 0;
    state.startedAt = performance.now();
    state.lastSubmitAt = Date.now();
    gameHeader.textContent = "";

    state.showTimer = window.setTimeout(() => {
      if (!state.isLoading) return;
      state.visible = true;
      renderLoadingState();
      renderSkeletonCards();
      state.tickTimer = window.setInterval(() => {
        if (!state.isLoading || !state.visible) return;
        state.elapsedMs = performance.now() - state.startedAt;
        renderLoadingState();
      }, 180);
    }, MIN_VISIBLE_MS);
  }

  function finishLoading() {
    state.isLoading = false;
    clearTimers();
  }

  function clearTimers() {
    window.clearTimeout(state.showTimer);
    window.clearInterval(state.tickTimer);
    state.showTimer = 0;
    state.tickTimer = 0;
  }

  function scheduleErrorState() {
    window.setTimeout(renderErrorState, 60);
  }

  function LoadingMapState({ isLoading, elapsedMs, error, onRetry }) {
    const wrap = document.createElement("div");
    wrap.className = `kotoha-map-state${error ? " error" : ""}`;

    if (error) {
      const message = document.createElement("div");
      message.className = "kotoha-error-line";
      message.textContent = "這次沒有整理好，可以再試一次。";
      const retry = document.createElement("button");
      retry.className = "kotoha-retry";
      retry.type = "button";
      retry.textContent = "重新整理";
      retry.addEventListener("click", onRetry);
      wrap.append(message, retry);
      return wrap;
    }

    if (!isLoading) return wrap;

    const message = document.createElement("div");
    message.className = "kotoha-loading-line";
    message.textContent = loadingText(elapsedMs);

    const stepIndex = activeStep(elapsedMs);
    const stepLine = document.createElement("div");
    stepLine.className = "kotoha-loading-steps";
    steps.forEach((step, index) => {
      const label = document.createElement("span");
      label.className = `kotoha-step${index === stepIndex ? " active" : ""}`;
      label.textContent = step;
      stepLine.append(label);
      if (index < steps.length - 1) {
        const separator = document.createElement("span");
        separator.className = "kotoha-step-separator";
        separator.textContent = "→";
        stepLine.append(separator);
      }
    });

    wrap.append(message, stepLine);
    return wrap;
  }

  function loadingText(elapsedMs) {
    if (elapsedMs < 1500) return "正在讀懂你想說的話…";
    if (elapsedMs < 4000) return "正在整理你的語言地圖…";
    if (elapsedMs < 8000) return "正在挑出最適合現在學的部分…";
    return "這句話有點豐富，我再幫你整理清楚一點…";
  }

  function activeStep(elapsedMs) {
    if (elapsedMs < 1500) return 0;
    if (elapsedMs < 4000) return 1;
    return 2;
  }

  function renderLoadingState() {
    if (!state.visible) return;
    state.elapsedMs = performance.now() - state.startedAt;
    gameHeader.replaceChildren(LoadingMapState({
      isLoading: true,
      elapsedMs: state.elapsedMs,
      error: false,
      onRetry: retryCurrentSentence,
    }));
  }

  function renderErrorState() {
    state.isLoading = false;
    clearTimers();
    if (lessonShell) lessonShell.hidden = false;
    if (structurePanel) {
      structurePanel.hidden = true;
      structurePanel.innerHTML = "";
    }
    if (categoryTabs) categoryTabs.innerHTML = "";
    if (practicePanel) {
      practicePanel.hidden = true;
      practicePanel.innerHTML = "";
    }
    resultsList.innerHTML = "";
    gameHeader.replaceChildren(LoadingMapState({
      isLoading: false,
      elapsedMs: 0,
      error: true,
      onRetry: retryCurrentSentence,
    }));
  }

  function renderSkeletonCards() {
    if (!lessonShell || !resultsList) return;
    lessonShell.hidden = false;
    if (structurePanel) {
      structurePanel.hidden = true;
      structurePanel.innerHTML = "";
    }
    if (categoryTabs) categoryTabs.innerHTML = "";
    if (practicePanel) {
      practicePanel.hidden = true;
      practicePanel.innerHTML = "";
    }
    const wrap = document.createElement("div");
    wrap.className = "kotoha-skeleton-list";
    for (let index = 0; index < 3; index += 1) {
      const card = document.createElement("div");
      card.className = "kotoha-skeleton-card";
      card.innerHTML = '<div class="kotoha-skeleton-line title"></div><div class="kotoha-skeleton-line reading"></div><div class="kotoha-skeleton-line note"></div><div class="kotoha-skeleton-line note short"></div>';
      wrap.append(card);
    }
    resultsList.replaceChildren(wrap);
  }

  function retryCurrentSentence() {
    if (state.isLoading) return;
    const text = input.value.trim();
    if (!text) return;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }
})();
