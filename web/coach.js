(() => {
  const KOTOHA_COACH_HISTORY_KEY = "kotoha-coach-history-v1";
  const KOTOHA_COACH_TRANSLATION_KEY = "kotoha-coach-show-translation";
  const KOTOHA_COACH_GRAMMAR_KEY = "kotoha-coach-show-grammar";

  const shell = document.querySelector("#coach-shell");
  const form = document.querySelector("#coach-form");
  const input = document.querySelector("#coach-input");
  const messages = document.querySelector("#coach-messages");
  const translationToggle = document.querySelector("#coach-translation-toggle");
  const grammarToggle = document.querySelector("#coach-grammar-toggle");
  const clearButton = document.querySelector("#coach-clear");

  if (!shell || !form || !input || !messages) return;

  let coachHistory = loadCoachHistory();
  let showTranslation = localStorage.getItem(KOTOHA_COACH_TRANSLATION_KEY) !== "0";
  let showGrammar = localStorage.getItem(KOTOHA_COACH_GRAMMAR_KEY) === "1";
  let isSending = false;

  initCoach();

  function initCoach() {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      sendCoachMessage(input.value);
    });
    translationToggle?.addEventListener("click", toggleCoachTranslation);
    grammarToggle?.addEventListener("click", toggleCoachGrammar);
    clearButton?.addEventListener("click", clearCoachHistory);
    updateToggleLabels();
    renderCoachHistory();
  }

  function loadCoachHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KOTOHA_COACH_HISTORY_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveCoachHistory() {
    localStorage.setItem(KOTOHA_COACH_HISTORY_KEY, JSON.stringify(coachHistory.slice(-40)));
  }

  function renderCoachHistory() {
    messages.innerHTML = "";
    if (!coachHistory.length) {
      const empty = document.createElement("div");
      empty.className = "coach-empty";
      empty.textContent = "可以先說一句中文，也可以直接試一句日文。";
      messages.append(empty);
      return;
    }
    coachHistory.forEach((turn) => messages.append(renderCoachTurn(turn)));
    messages.scrollTop = messages.scrollHeight;
  }

  async function sendCoachMessage(rawText) {
    const text = String(rawText || "").trim();
    if (!text || isSending) return;
    isSending = true;
    input.value = "";
    const userTurn = { role: "user", text, createdAt: new Date().toISOString() };
    coachHistory.push(userTurn);
    saveCoachHistory();
    renderCoachHistory();
    renderCoachLoading();

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: coachHistory.slice(-10),
          settings: { showTranslation, showGrammar, level: "beginner" },
        }),
      });
      if (!response.ok) throw new Error(`Coach failed: ${response.status}`);
      const result = await response.json();
      const coachTurn = normalizeCoachTurn(result);
      coachHistory.push(coachTurn);
      saveCoachHistory();
      renderCoachHistory();
    } catch (error) {
      console.warn("Coach failed.", error);
      const coachTurn = normalizeCoachTurn(localCoachFallback(text));
      coachHistory.push(coachTurn);
      saveCoachHistory();
      renderCoachHistory();
    } finally {
      isSending = false;
      input.focus();
    }
  }

  function localCoachFallback(text) {
    const showTip = showGrammar;
    if (/貓|猫|ねこ/.test(text)) {
      const corrective = /猫好き/.test(text) && !/猫が好き/.test(text);
      return {
        coachMessage: {
          ja: corrective ? "意味はわかります。自然に言うなら「猫が好きです」です。" : "いいですね。猫が好きなんですね。",
          zh: corrective ? "意思懂。自然一點可以說「猫が好きです」。" : "很好耶。你喜歡貓對吧。",
          tone: corrective ? "corrective" : "encouraging",
          speakText: corrective ? "意味はわかります。自然に言うなら、猫が好きです、です。" : "いいですね。猫が好きなんですね。",
        },
        userAssist: {
          understoodAs: "我喜歡貓。",
          suggestedReplyJa: corrective ? "猫が好きです。" : "はい、猫が好きです。",
          suggestedReplyZh: corrective ? "我喜歡貓。" : "是的，我喜歡貓。",
          correction: corrective ? "猫好きです → 猫が好きです" : "",
          encouragement: corrective ? "這句已經能讓人懂，補上 が 會更自然。" : "很好，先用這句就能自然接話。",
        },
        grammarTip: showTip ? { title: "〜が好きです", body: "喜歡的對象通常用 が。", example: "猫が好きです。" } : {},
        nextOptions: [
          { label: "犬も好きです", ja: "犬も好きです。", zh: "我也喜歡狗。" },
          { label: "猫を飼っています", ja: "猫を飼っています。", zh: "我有養貓。" },
          { label: "動物が好きです", ja: "動物が好きです。", zh: "我喜歡動物。" },
        ],
      };
    }
    if (/滑雪|スキー/.test(text)) {
      return {
        coachMessage: {
          ja: "いいですね。明日、スキー場に行きたいんですね。",
          zh: "不錯耶。你明天想去滑雪場對吧。",
          tone: "encouraging",
          speakText: "いいですね。明日、スキー場に行きたいんですね。",
        },
        userAssist: {
          understoodAs: "我明天想去滑雪。",
          suggestedReplyJa: "はい、明日スキー場に行きたいです。",
          suggestedReplyZh: "是的，我明天想去滑雪場。",
          correction: "",
          encouragement: "這個話題很適合練 〜たいです。",
        },
        grammarTip: showTip ? { title: "〜たいです", body: "表示「想做某事」。", example: "行きたいです。" } : {},
        nextOptions: [
          { label: "スノーボードをしたいです", ja: "スノーボードをしたいです。", zh: "我想滑雪板。" },
          { label: "ウェアをレンタルしたいです", ja: "ウェアをレンタルしたいです。", zh: "我想租雪衣。" },
          { label: "友達と行きたいです", ja: "友達と行きたいです。", zh: "我想和朋友去。" },
        ],
      };
    }
    return {
      coachMessage: {
        ja: "いいですね。もう少し教えてください。",
        zh: "不錯耶。再多告訴我一點。",
        tone: "gentle",
        speakText: "いいですね。もう少し教えてください。",
      },
      userAssist: {
        understoodAs: text,
        suggestedReplyJa: "はい、話したいです。",
        suggestedReplyZh: "是的，我想聊聊。",
        correction: "",
        encouragement: "先用很短的一句也可以。",
      },
      grammarTip: {},
      nextOptions: [
        { label: "今日は楽しかったです", ja: "今日は楽しかったです。", zh: "今天很開心。" },
        { label: "少し疲れました", ja: "少し疲れました。", zh: "我有點累。" },
        { label: "日本語を話したいです", ja: "日本語を話したいです。", zh: "我想說日文。" },
      ],
    };
  }

  function normalizeCoachTurn(result) {
    const coachMessage = result?.coachMessage || {};
    const userAssist = result?.userAssist || {};
    return {
      role: "coach",
      ja: String(coachMessage.ja || "いいですね。もう少し教えてください。"),
      reading: String(coachMessage.reading || ""),
      zh: String(coachMessage.zh || "不錯耶。再多告訴我一點。"),
      tone: String(coachMessage.tone || "gentle"),
      speakText: String(coachMessage.speakText || coachMessage.ja || ""),
      userAssist: {
        understoodAs: String(userAssist.understoodAs || ""),
        suggestedReplyJa: String(userAssist.suggestedReplyJa || ""),
        suggestedReplyZh: String(userAssist.suggestedReplyZh || ""),
        correction: String(userAssist.correction || ""),
        encouragement: String(userAssist.encouragement || ""),
      },
      grammarTip: {
        title: String(result?.grammarTip?.title || ""),
        body: String(result?.grammarTip?.body || ""),
        example: String(result?.grammarTip?.example || ""),
      },
      nextOptions: Array.isArray(result?.nextOptions)
        ? result.nextOptions
            .map((option) => ({
              label: String(option.label || option.ja || ""),
              ja: String(option.ja || ""),
              zh: String(option.zh || ""),
            }))
            .filter((option) => option.ja)
            .slice(0, 3)
        : [],
      createdAt: new Date().toISOString(),
    };
  }

  function renderCoachTurn(turn) {
    const article = document.createElement("article");
    article.className = `coach-message ${turn.role === "user" ? "user" : "coach"}`;
    if (turn.role === "user") {
      article.textContent = turn.text || "";
      return article;
    }

    const head = document.createElement("div");
    head.className = "coach-message-head";
    const ja = document.createElement("div");
    ja.className = "coach-ja";
    ja.textContent = turn.ja;
    head.append(ja, voiceButton(turn.speakText || turn.ja));
    article.append(head);

    if (turn.reading) {
      const reading = document.createElement("div");
      reading.className = "coach-reading";
      reading.textContent = turn.reading;
      article.append(reading);
    }
    if (showTranslation && turn.zh) {
      const zh = document.createElement("div");
      zh.className = "coach-zh";
      zh.textContent = turn.zh;
      article.append(zh);
    }
    if (turn.userAssist?.correction) {
      const correction = document.createElement("div");
      correction.className = "coach-correction";
      correction.textContent = turn.userAssist.correction;
      article.append(correction);
    }
    if (turn.userAssist?.suggestedReplyJa) {
      article.append(renderSuggestedReply(turn.userAssist));
    }
    if (showGrammar && turn.grammarTip?.title && turn.grammarTip?.body) {
      article.append(renderGrammarTip(turn.grammarTip));
    }
    if (turn.nextOptions?.length) {
      article.append(renderNextOptions(turn.nextOptions));
    }
    return article;
  }

  function renderSuggestedReply(assist) {
    const wrap = document.createElement("div");
    wrap.className = "coach-suggested-reply";
    const label = document.createElement("div");
    label.className = "coach-small-label";
    label.textContent = "你可以這樣回";
    const line = document.createElement("button");
    line.type = "button";
    line.className = "coach-suggested-line";
    line.textContent = showTranslation && assist.suggestedReplyZh ? `${assist.suggestedReplyJa} / ${assist.suggestedReplyZh}` : assist.suggestedReplyJa;
    line.addEventListener("click", () => sendCoachMessage(assist.suggestedReplyJa));
    wrap.append(label, line);
    if (assist.encouragement) {
      const note = document.createElement("p");
      note.textContent = assist.encouragement;
      wrap.append(note);
    }
    return wrap;
  }

  function renderGrammarTip(tip) {
    const card = document.createElement("div");
    card.className = "coach-grammar-tip";
    const title = document.createElement("strong");
    title.textContent = tip.title;
    const body = document.createElement("p");
    body.textContent = tip.body;
    card.append(title, body);
    if (tip.example) {
      const example = document.createElement("div");
      example.className = "coach-grammar-example";
      example.textContent = `例：${tip.example}`;
      card.append(example);
    }
    return card;
  }

  function renderNextOptions(options) {
    const wrap = document.createElement("div");
    wrap.className = "coach-option-chips";
    options.forEach((option) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "coach-option-chip";
      chip.textContent = option.label || option.ja;
      chip.title = showTranslation && option.zh ? `${option.ja} / ${option.zh}` : option.ja;
      chip.addEventListener("click", () => sendCoachMessage(option.ja));
      wrap.append(chip);
    });
    return wrap;
  }

  function renderCoachLoading() {
    const loading = document.createElement("div");
    loading.className = "coach-loading";
    loading.textContent = showGrammar ? "正在幫你把回覆變得更自然…" : "教練正在想一句剛剛好的日文…";
    messages.append(loading);
    messages.scrollTop = messages.scrollHeight;
  }

  function renderCoachError() {
    const error = document.createElement("div");
    error.className = "coach-loading error";
    error.textContent = "這次教練沒有接好，再試一句就好。";
    messages.append(error);
    messages.scrollTop = messages.scrollHeight;
  }

  function toggleCoachTranslation() {
    showTranslation = !showTranslation;
    localStorage.setItem(KOTOHA_COACH_TRANSLATION_KEY, showTranslation ? "1" : "0");
    updateToggleLabels();
    renderCoachHistory();
  }

  function toggleCoachGrammar() {
    showGrammar = !showGrammar;
    localStorage.setItem(KOTOHA_COACH_GRAMMAR_KEY, showGrammar ? "1" : "0");
    updateToggleLabels();
    renderCoachHistory();
  }

  function updateToggleLabels() {
    if (translationToggle) {
      translationToggle.classList.toggle("active", showTranslation);
      translationToggle.textContent = showTranslation ? "翻譯 開" : "翻譯 關";
    }
    if (grammarToggle) {
      grammarToggle.classList.toggle("active", showGrammar);
      grammarToggle.textContent = showGrammar ? "文法 開" : "文法 關";
    }
  }

  function clearCoachHistory() {
    if (!coachHistory.length) return;
    if (!confirm("清空 AI 教練對話？")) return;
    coachHistory = [];
    saveCoachHistory();
    renderCoachHistory();
  }

  function voiceButton(text) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-button coach-voice";
    button.textContent = "♪";
    button.title = "播放日文";
    button.setAttribute("aria-label", "播放日文");
    button.addEventListener("click", () => playCoachVoice(text));
    return button;
  }

  function playCoachVoice(text) {
    if (!text || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 0.86;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  window.KotohaCoach = {
    initCoach,
    renderCoachHistory,
    sendCoachMessage,
    renderCoachTurn,
    renderCoachLoading,
    renderCoachError,
    toggleCoachTranslation,
    toggleCoachGrammar,
    playCoachVoice,
    clearCoachHistory,
  };
})();
