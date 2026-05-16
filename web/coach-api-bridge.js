(() => {
  if (window.KotohaCoachApiBridgeLoaded) return;
  window.KotohaCoachApiBridgeLoaded = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = async function kotohaCoachFetch(input, init) {
    const url = typeof input === "string" ? input : input?.url || "";
    if (!String(url).includes("/api/coach")) return nativeFetch(input, init);

    const response = await nativeFetch(input, init);
    if (response.ok || response.status !== 404) return response;

    const request = parseCoachRequest(init);
    const message = String(request.message || "").trim();

    if (isLocalTopic(message)) return response;

    try {
      const bridged = await buildFromAnalyze(message, request.settings || {});
      return bridged ? jsonResponse(bridged) : response;
    } catch (error) {
      console.warn("Kotoha coach bridge failed.", error);
      return response;
    }
  };

  function parseCoachRequest(init) {
    try {
      return JSON.parse(typeof init?.body === "string" ? init.body : "{}");
    } catch {
      return {};
    }
  }

  function isLocalTopic(message) {
    return /[\u5403\u98fd\u9913\u98ef]|\u62c9\u9eb5|\u58fd\u53f8|\u304a\u8179|\u98df\u3079|\u4f60\u89ba\u5f97|\u731c|\u8c93|\u732b|\u306d\u3053|\u6ed1\u96ea|\u30b9\u30ad\u30fc|\u7d2f|\u75b2\u308c/.test(message);
  }

  async function buildFromAnalyze(message, settings) {
    const response = await nativeFetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message, mode: "ja" }),
    });
    if (!response.ok) return null;

    const analysis = await response.json();
    const sentence = analysis?.sentence || {};
    const target = clean(sentence.target || firstCardTerm(analysis));
    const source = clean(sentence.source || message);
    if (!target || target === message) return null;

    const asksQuestion = /[?？]$|か。$/.test(target);
    const ja = asksQuestion ? `いい質問ですね。${target}` : `まずは「${target}」と言えます。`;

    return {
      version: 1,
      source: analysis?.source === "ai" ? "ai" : "local",
      coachMessage: {
        ja,
        reading: "",
        zh: asksQuestion ? `可以這樣問：${source}` : `可以先這樣說：${source}`,
        tone: "gentle",
        speakText: target,
      },
      userAssist: {
        understoodAs: source,
        suggestedReplyJa: target,
        suggestedReplyZh: source,
        correction: correctionFor(message, target),
        encouragement: "\u5148\u7528\u9019\u53e5\u8aaa\u51fa\u4f86\u5c31\u5f88\u597d\u3002",
      },
      grammarTip: grammarTipFromAnalysis(analysis, settings),
      nextOptions: [
        option("\u518d\u8aaa\u4e00\u6b21", target, source),
        option("\u6162\u6162\u8aaa", "\u3086\u3063\u304f\u308a\u8a00\u3063\u3066\u304f\u3060\u3055\u3044\u3002", "\u8acb\u6162\u6162\u8aaa\u3002"),
        option("\u63db\u500b\u8aaa\u6cd5", "\u5225\u306e\u8a00\u3044\u65b9\u3082\u77e5\u308a\u305f\u3044\u3067\u3059\u3002", "\u6211\u4e5f\u60f3\u77e5\u9053\u5225\u7684\u8aaa\u6cd5\u3002"),
      ],
      topicState: {
        topic: "analysis",
        detectedIntent: asksQuestion ? "ask_question" : "practice_sentence",
        recommendedPattern: clean(analysis?.detectedPatterns?.[0]?.label || analysis?.grammarNotes?.[0]?.title || "simple_sentence"),
      },
    };
  }

  function grammarTipFromAnalysis(analysis, settings) {
    if (!settings?.showGrammar) return emptyTip();
    const note = analysis?.grammarNotes?.[0];
    if (note) return { title: clean(note.title), body: clean(note.short), example: clean(note.example) };
    const grammarCard = (analysis?.cards || []).find((card) => card.category === "grammar");
    if (grammarCard) return { title: clean(grammarCard.term), body: clean(grammarCard.note), example: clean(grammarCard.term) };
    return emptyTip();
  }

  function correctionFor(message, target) {
    return /[\u3040-\u30ff]/.test(message) && message !== target ? `${message} \u2192 ${target}` : "";
  }

  function firstCardTerm(analysis) {
    return clean((analysis?.cards || [])[0]?.term || "");
  }

  function option(label, ja, zh) {
    return { label, ja, zh };
  }

  function emptyTip() {
    return { title: "", body: "", example: "" };
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function jsonResponse(payload) {
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
})();
