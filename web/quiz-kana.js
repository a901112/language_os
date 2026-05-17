(() => {
  const SESSION_KEY = "kotoha-quiz-session-v1";
  const QUIZ_SPEECH_RATE = 0.72;
  const JAPANESE_RE = /[\u3040-\u30ff\u3400-\u9fff]/;
  const PATTERN_READINGS = {
    pattern_ga_suki_desu: {
      reading: "ねこがすきです。",
      blankReading: "ねこ＿すきです。",
    },
    pattern_wo_tabemashita: {
      reading: "ラーメンをたべました。",
      blankReading: "ラーメン＿たべました。",
    },
    pattern_tai_desu: {
      reading: "スキーじょうにいきたいです。",
      blankReading: "スキーじょうにいき＿です。",
    },
    pattern_rental_tai: {
      reading: "ブーツをレンタルしたいです。",
      blankReading: "ブーツ＿レンタルしたいです。",
    },
  };

  injectKanaStyle();
  patchQuizSpeech();
  wrapQuizApi();

  document.addEventListener("DOMContentLoaded", () => {
    wrapQuizApi();
    window.setTimeout(enhanceQuizKana, 80);
  });

  document.addEventListener(
    "click",
    (event) => {
      if (event.target?.closest?.("#quiz-shell")) window.setTimeout(enhanceQuizKana, 80);
    },
    true
  );

  function patchQuizSpeech() {
    if (!("speechSynthesis" in window) || window.__kotohaQuizSpeechPatched) return;
    const originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = (utterance) => {
      if (utterance?.lang === "ja-JP" && document.querySelector("#home")?.dataset.feature === "quiz") {
        utterance.rate = QUIZ_SPEECH_RATE;
      }
      return originalSpeak(utterance);
    };
    window.__kotohaQuizSpeechPatched = true;
  }

  function wrapQuizApi() {
    const api = window.KotohaQuiz;
    if (!api || api.__kanaWrapped) return;
    ["startSession", "renderQuiz"].forEach((name) => {
      const original = api[name];
      if (typeof original !== "function") return;
      api[name] = function wrappedQuizMethod(...args) {
        const result = original.apply(this, args);
        window.setTimeout(enhanceQuizKana, 80);
        return result;
      };
    });
    api.__kanaWrapped = true;
  }

  function enhanceQuizKana() {
    const question = currentQuestion();
    if (!question) return;

    const prompt = document.querySelector("#quiz-body .quiz-prompt");
    const hint = promptReading(question);
    if (prompt && hint && JAPANESE_RE.test(prompt.textContent || "") && !document.querySelector("#quiz-body .quiz-kana-hint")) {
      const row = document.createElement("div");
      row.className = "quiz-kana-hint";
      row.textContent = `假名：${hint}`;
      prompt.insertAdjacentElement("afterend", row);
    }

    const feedback = document.querySelector("#quiz-body .quiz-feedback:not([hidden])");
    const answerHint = answerReading(question);
    if (feedback && answerHint && JAPANESE_RE.test(question.answer || "") && !feedback.querySelector(".quiz-answer-kana")) {
      const row = document.createElement("p");
      row.className = "quiz-answer-kana";
      row.textContent = `假名：${answerHint}`;
      feedback.append(row);
    }
  }

  function currentQuestion() {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "{}");
      return session.questions?.[session.currentIndex || 0] || null;
    } catch {
      return null;
    }
  }

  function promptReading(question) {
    if (question.kanaHint) return question.kanaHint;
    if (question.type === "fill_blank" && patternReading(question.itemId, "blankReading")) return patternReading(question.itemId, "blankReading");
    return question.item?.reading || patternReading(question.itemId, "reading") || "";
  }

  function answerReading(question) {
    if (question.answerKana) return question.answerKana;
    return question.item?.reading || patternReading(question.itemId, "reading") || "";
  }

  function patternReading(itemId, key) {
    return PATTERN_READINGS[itemId]?.[key] || "";
  }

  function injectKanaStyle() {
    if (document.querySelector("#kotoha-quiz-kana-style")) return;
    const style = document.createElement("style");
    style.id = "kotoha-quiz-kana-style";
    style.textContent = `
      .quiz-kana-hint {
        display: inline-flex;
        width: fit-content;
        max-width: 100%;
        margin: -6px 0 14px;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.58);
        color: #35676a;
        font-size: 13px;
        line-height: 1.5;
        opacity: 0.78;
      }
      .quiz-answer-kana {
        font-size: 13px;
        color: #35676a !important;
        opacity: 0.82;
      }
    `;
    document.head.append(style);
  }
})();
