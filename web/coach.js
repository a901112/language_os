(() => {
  const HISTORY_KEY = "kotoha-coach-history-v1";
  const TRANSLATION_KEY = "kotoha-coach-show-translation";
  const GRAMMAR_KEY = "kotoha-coach-show-grammar";

  const form = document.getElementById("coach-form");
  const input = document.getElementById("coach-input");
  const messages = document.getElementById("coach-messages");
  const translationToggle = document.getElementById("coach-translation-toggle");
  const grammarToggle = document.getElementById("coach-grammar-toggle");
  const clearButton = document.getElementById("coach-clear");

  let history = loadHistory();
  let showTranslation = localStorage.getItem(TRANSLATION_KEY) !== "0";
  let showGrammar = localStorage.getItem(GRAMMAR_KEY) === "1";
  let isSending = false;

  function initCoach() {
    if (!form || !input || !messages) return;
    updateToggleLabels();
    renderHistory();
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      sendCoachMessage(input.value);
    });
    translationToggle?.addEventListener("click", toggleTranslation);
    grammarToggle?.addEventListener("click", toggleGrammar);
    clearButton?.addEventListener("click", clearHistory);
  }

  function loadHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (_) {
      return [];
    }
  }

  function saveHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-40)));
  }

  async function sendCoachMessage(rawText) {
    const text = String(rawText || "").trim();
    if (!text || isSending) return;
    isSending = true;
    input.value = "";
    history.push({ role: "user", text, createdAt: new Date().toISOString() });
    saveHistory();
    renderHistory();
    renderLoading();

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: history.slice(-10),
          settings: { showTranslation, showGrammar, level: "beginner" },
        }),
      });
      if (!response.ok) throw new Error(`Coach failed: ${response.status}`);
      const result = await response.json();
      console.debug("Kotoha coach source:", result?.source || "unknown");
      removeLoading();
      history.push(normalizeTurn(result));
    } catch (error) {
      console.warn("Coach failed; using local topic fallback.", error);
      removeLoading();
      history.push(normalizeTurn(localCoachFallback(text)));
    } finally {
      saveHistory();
      renderHistory();
      isSending = false;
      input.focus();
    }
  }

  function option(label, ja, zh) {
    return { label, ja, zh };
  }

  function topicState(topic, detectedIntent, recommendedPattern) {
    return { topic, detectedIntent, recommendedPattern };
  }

  function localCoachFallback(text) {
    const showTip = showGrammar;
    const lower = String(text || "").toLowerCase();
    const hasFood = /吃|飽|餓|飯|拉麵|壽司|食べ|食べました|お腹|ご飯|ラーメン|寿司/.test(text);
    const hasGuess = /你覺得|覺得|猜|你猜|と思う|と思います|何だと思う/.test(text);

    if (hasGuess && hasFood) {
      return {
        source: "local",
        coachMessage: { ja: "何を食べましたか。ラーメンですか。", reading: "", zh: "你吃了什麼呢？是拉麵嗎？", tone: "gentle", speakText: "何を食べましたか。ラーメンですか。" },
        userAssist: { understoodAs: "你想讓教練猜猜你吃了什麼。", suggestedReplyJa: "ラーメンを食べました。", suggestedReplyZh: "我吃了拉麵。", correction: "", encouragement: "這樣就可以自然接食物話題。" },
        grammarTip: showTip ? { title: "〜を食べました", body: "表示「吃了～」。食物後面常接 を。", example: "ラーメンを食べました。" } : {},
        nextOptions: [option("ラーメンです", "ラーメンです。", "是拉麵。"), option("寿司を食べました", "寿司を食べました。", "我吃了壽司。"), option("秘密です", "秘密です。", "是秘密。")],
        topicState: topicState("food", "guess_food", "〜を食べました"),
      };
    }

    if (hasFood) {
      return {
        source: "local",
        coachMessage: { ja: "お腹いっぱいなんですね。何を食べましたか。", reading: "", zh: "你吃得很飽對吧。你吃了什麼？", tone: "gentle", speakText: "お腹いっぱいなんですね。何を食べましたか。" },
        userAssist: { understoodAs: "我剛吃得很飽。", suggestedReplyJa: "ラーメンを食べました。", suggestedReplyZh: "我吃了拉麵。", correction: "", encouragement: "先用一個食物名，就能把對話接下去。" },
        grammarTip: showTip ? { title: "〜を食べました", body: "表示「吃了～」。食物後面常接 を。", example: "ラーメンを食べました。" } : {},
        nextOptions: [option("ラーメンを食べました", "ラーメンを食べました。", "我吃了拉麵。"), option("ご飯を食べました", "ご飯を食べました。", "我吃了飯。"), option("食べすぎました", "食べすぎました。", "我吃太多了。")],
        topicState: topicState("food", "share_food", "〜を食べました"),
      };
    }

    if (hasGuess) {
      return {
        source: "local",
        coachMessage: { ja: "何だと思いますか。ヒントをください。", reading: "", zh: "你覺得是什麼呢？給我一點提示。", tone: "gentle", speakText: "何だと思いますか。ヒントをください。" },
        userAssist: { understoodAs: "你想讓教練猜一猜。", suggestedReplyJa: "ヒントは食べ物です。", suggestedReplyZh: "提示是食物。", correction: "", encouragement: "這句可以很輕鬆地把遊戲感接起來。" },
        grammarTip: showTip ? { title: "〜と思います", body: "表示「我覺得～」。猜測時很常用。", example: "何だと思いますか。" } : {},
        nextOptions: [option("ヒントをください", "ヒントをください。", "請給我提示。"), option("食べ物です", "食べ物です。", "是食物。"), option("秘密です", "秘密です。", "是秘密。")],
        topicState: topicState("guess", "ask_guess", "〜と思います"),
      };
    }

    if (/貓|猫|ねこ/.test(text)) {
      const corrective = /猫好き/.test(text) && !/猫が好き/.test(text);
      return {
        source: "local",
        coachMessage: { ja: corrective ? "意味はわかります。自然に言うなら「猫が好きです」です。" : "いいですね。猫が好きなんですね。", reading: "", zh: corrective ? "意思懂。自然一點可以說「猫が好きです」。" : "很好耶。你喜歡貓對吧。", tone: corrective ? "corrective" : "encouraging", speakText: corrective ? "意味はわかります。自然に言うなら、猫が好きです、です。" : "いいですね。猫が好きなんですね。" },
        userAssist: { understoodAs: "我喜歡貓。", suggestedReplyJa: corrective ? "猫が好きです。" : "はい、猫が好きです。", suggestedReplyZh: corrective ? "我喜歡貓。" : "是的，我喜歡貓。", correction: corrective ? "猫好きです → 猫が好きです" : "", encouragement: corrective ? "這句已經能讓人懂，補上 が 會更自然。" : "很好，先用這句就能自然接話。" },
        grammarTip: showTip ? { title: "〜が好きです", body: "喜歡的對象通常用 が。", example: "猫が好きです。" } : {},
        nextOptions: [option("犬も好きです", "犬も好きです。", "我也喜歡狗。"), option("猫を飼っています", "猫を飼っています。", "我有養貓。"), option("動物が好きです", "動物が好きです。", "我喜歡動物。")],
        topicState: topicState("animal", "talk_about_likes", "〜が好きです"),
      };
    }

    if (/滑雪|スキー|snowboard|snow/.test(text) || lower.includes("ski")) {
      return {
        source: "local",
        coachMessage: { ja: "いいですね。明日、スキー場に行きたいんですね。", reading: "", zh: "不錯耶。你明天想去滑雪場對吧。", tone: "encouraging", speakText: "いいですね。明日、スキー場に行きたいんですね。" },
        userAssist: { understoodAs: "我明天想去滑雪。", suggestedReplyJa: "はい、明日スキー場に行きたいです。", suggestedReplyZh: "是的，我明天想去滑雪場。", correction: "", encouragement: "這個話題很適合練 〜たいです。" },
        grammarTip: showTip ? { title: "〜たいです", body: "表示「想做某事」。", example: "行きたいです。" } : {},
        nextOptions: [option("スノーボードをしたいです", "スノーボードをしたいです。", "我想滑雪板。"), option("ウェアをレンタルしたいです", "ウェアをレンタルしたいです。", "我想租雪衣。"), option("友達と行きたいです", "友達と行きたいです。", "我想和朋友去。")],
        topicState: topicState("ski", "talk_about_plans", "〜たいです"),
      };
    }

    if (/累|疲れ|しんどい|疲勞/.test(text) || lower.includes("tired")) {
      return {
        source: "local",
        coachMessage: { ja: "疲れたんですね。今日はゆっくり休みましょう。", reading: "", zh: "你累了對吧。今天好好休息吧。", tone: "gentle", speakText: "疲れたんですね。今日はゆっくり休みましょう。" },
        userAssist: { understoodAs: "我有點累。", suggestedReplyJa: "少し疲れました。", suggestedReplyZh: "我有點累。", correction: "", encouragement: "這句很自然，也很適合日常對話。" },
        grammarTip: showTip ? { title: "少し〜ました", body: "少し 表示「有點」。可以讓語氣更柔和。", example: "少し疲れました。" } : {},
        nextOptions: [option("少し疲れました", "少し疲れました。", "我有點累。"), option("今日は早く寝ます", "今日は早く寝ます。", "我今天早點睡。"), option("でも楽しかったです", "でも楽しかったです。", "但是很開心。")],
        topicState: topicState("tired", "share_feeling", "少し〜ました"),
      };
    }

    return {
      source: "local",
      coachMessage: { ja: "いいですね。もう少し教えてください。", reading: "", zh: "不錯耶。再多告訴我一點。", tone: "gentle", speakText: "いいですね。もう少し教えてください。" },
      userAssist: { understoodAs: text, suggestedReplyJa: "今日は何をしましたか。", suggestedReplyZh: "今天做了什麼？", correction: "", encouragement: "先用很短的一句也可以。" },
      grammarTip: {},
      nextOptions: [option("今日は何をしましたか", "今日は何をしましたか。", "今天做了什麼？"), option("何が好きですか", "何が好きですか。", "你喜歡什麼？"), option("明日、何をしたいですか", "明日、何をしたいですか。", "明天想做什麼？")],
      topicState: topicState("unknown", "continue_conversation", "simple_question"),
    };
  }

  function normalizeTurn(result) {
    const coach = result?.coachMessage || {};
    const assist = result?.userAssist || {};
    return {
      role: "coach",
      ja: String(coach.ja || "いいですね。今日は何をしましたか。"),
      reading: String(coach.reading || ""),
      zh: String(coach.zh || "不錯耶。今天做了什麼？"),
      tone: String(coach.tone || "gentle"),
      speakText: String(coach.speakText || coach.ja || ""),
      userAssist: {
        understoodAs: String(assist.understoodAs || ""),
        suggestedReplyJa: String(assist.suggestedReplyJa || ""),
        suggestedReplyZh: String(assist.suggestedReplyZh || ""),
        correction: String(assist.correction || ""),
        encouragement: String(assist.encouragement || ""),
      },
      grammarTip: {
        title: String(result?.grammarTip?.title || ""),
        body: String(result?.grammarTip?.body || ""),
        example: String(result?.grammarTip?.example || ""),
      },
      nextOptions: Array.isArray(result?.nextOptions) ? result.nextOptions.map((item) => ({ label: String(item.label || item.ja || ""), ja: String(item.ja || ""), zh: String(item.zh || "") })).filter((item) => item.ja).slice(0, 3) : [],
      topicState: result?.topicState || {},
      createdAt: new Date().toISOString(),
    };
  }

  function renderHistory() {
    if (!messages) return;
    messages.innerHTML = "";
    if (!history.length) {
      const empty = document.createElement("div");
      empty.className = "coach-empty";
      empty.textContent = "可以先說一句中文，也可以直接試一句日文。";
      messages.append(empty);
    }
    history.forEach((turn) => messages.append(renderTurn(turn)));
    messages.scrollTop = messages.scrollHeight;
  }

  function renderTurn(turn) {
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
    if (turn.reading) article.append(textNode("coach-reading", turn.reading));
    if (showTranslation && turn.zh) article.append(textNode("coach-zh", turn.zh));
    if (turn.userAssist?.correction) article.append(textNode("coach-correction", turn.userAssist.correction));
    if (turn.userAssist?.suggestedReplyJa) article.append(renderSuggested(turn.userAssist));
    if (showGrammar && turn.grammarTip?.title && turn.grammarTip?.body) article.append(renderGrammar(turn.grammarTip));
    if (turn.nextOptions?.length) article.append(renderOptions(turn.nextOptions));
    return article;
  }

  function textNode(className, text) {
    const node = document.createElement("div");
    node.className = className;
    node.textContent = text;
    return node;
  }

  function renderSuggested(assist) {
    const wrap = document.createElement("div");
    wrap.className = "coach-suggested-reply";
    const label = textNode("coach-small-label", "你可以這樣回");
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

  function renderGrammar(tip) {
    const card = document.createElement("div");
    card.className = "coach-grammar-tip";
    const title = document.createElement("strong");
    title.textContent = tip.title;
    const body = document.createElement("p");
    body.textContent = tip.body;
    card.append(title, body);
    if (tip.example) card.append(textNode("coach-grammar-example", `例：${tip.example}`));
    return card;
  }

  function renderOptions(options) {
    const wrap = document.createElement("div");
    wrap.className = "coach-option-chips";
    options.forEach((item) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "coach-option-chip";
      chip.textContent = item.label || item.ja;
      chip.title = showTranslation && item.zh ? `${item.ja} / ${item.zh}` : item.ja;
      chip.addEventListener("click", () => sendCoachMessage(item.ja));
      wrap.append(chip);
    });
    return wrap;
  }

  function renderLoading() {
    removeLoading();
    const node = document.createElement("div");
    node.className = "coach-loading";
    node.textContent = showGrammar ? "正在幫你把回覆變得更自然…" : "教練正在想一句剛剛好的日文…";
    messages.append(node);
    messages.scrollTop = messages.scrollHeight;
  }

  function removeLoading() {
    messages?.querySelectorAll(".coach-loading").forEach((node) => node.remove());
  }

  function toggleTranslation() {
    showTranslation = !showTranslation;
    localStorage.setItem(TRANSLATION_KEY, showTranslation ? "1" : "0");
    updateToggleLabels();
    renderHistory();
  }

  function toggleGrammar() {
    showGrammar = !showGrammar;
    localStorage.setItem(GRAMMAR_KEY, showGrammar ? "1" : "0");
    updateToggleLabels();
    renderHistory();
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

  function clearHistory() {
    if (!history.length) return;
    if (!confirm("清空 AI 教練對話？")) return;
    history = [];
    saveHistory();
    renderHistory();
  }

  function voiceButton(text) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-button coach-voice";
    button.textContent = "♪";
    button.title = "播放日文";
    button.setAttribute("aria-label", "播放日文");
    button.addEventListener("click", () => playVoice(text));
    return button;
  }

  function playVoice(text) {
    if (!text || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  window.KotohaCoach = { initCoach, sendCoachMessage, renderCoachHistory: renderHistory, localCoachFallback, clearCoachHistory: clearHistory };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCoach, { once: true });
  } else {
    initCoach();
  }
})();
