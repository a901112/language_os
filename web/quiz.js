(() => {
  const SESSION_KEY = "kotoha-quiz-session-v1";
  const LAST_SESSION_KEY = "kotoha-quiz-last-session-questions-v1";
  const SESSION_SIZE = 6;
  const DAY_MS = 24 * 60 * 60 * 1000;
  let questions = [];
  let currentIndex = 0;
  let selectedChoice = "";
  let checked = false;
  let recognition = null;
  let transcript = "";

  const shell = () => document.querySelector("#quiz-shell");
  const body = () => document.querySelector("#quiz-body");
  const progressText = () => document.querySelector("#quiz-progress-text");
  const resetButton = () => document.querySelector("#quiz-new-session");

  function initQuiz() {
    resetButton()?.addEventListener("click", () => startSession({ forceNew: true }));
    window.addEventListener("kotoha-progress-changed", () => {
      if (!questions.length && !shell()?.hidden) startSession();
    });
    startSession();
  }

  function startSession(options = {}) {
    const saved = readSession();
    if (!options.forceNew && saved?.questions?.length && !isSessionExpired(saved)) {
      questions = saved.questions;
      currentIndex = clamp(saved.currentIndex || 0, 0, questions.length - 1);
    } else {
      questions = buildAdaptiveSession();
      currentIndex = 0;
      writeSession();
      localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(questions.map((q) => q.id)));
    }
    selectedChoice = "";
    checked = false;
    transcript = "";
    renderQuiz();
  }

  function buildAdaptiveSession() {
    const progressApi = window.KotohaProgress;
    if (!progressApi) return [];
    const progress = progressApi.ensureProgressForItems();
    const items = progressApi.getKnowledgeItems();
    const lastSessionIds = safeJson(localStorage.getItem(LAST_SESSION_KEY), []);
    const scored = items.map((item) => ({ item, record: progress[item.id] || {}, score: scoreItem(item, progress[item.id] || {}, lastSessionIds) })).sort((a, b) => b.score - a.score);
    const picked = [];
    const seenItems = new Set();
    for (const entry of scored) {
      if (picked.length >= SESSION_SIZE) break;
      if (seenItems.has(entry.item.id)) continue;
      const question = makeQuestion(entry.item, entry.record, picked.length);
      if (!question) continue;
      if ((entry.record.wrongStreak || 0) < 2 && lastSessionIds.includes(question.id)) continue;
      picked.push(question);
      seenItems.add(entry.item.id);
    }
    while (picked.length < SESSION_SIZE && items.length) {
      const item = items[picked.length % items.length];
      const question = makeQuestion(item, progress[item.id] || {}, picked.length + 9);
      if (question) picked.push(question);
      else break;
    }
    return picked;
  }

  function scoreItem(item, record, lastSessionIds) {
    const mastery = record.mastery ?? (item.type === "pattern" ? 18 : 8);
    const dueBonus = isDue(record) ? 28 : 0;
    const weakBonus = (record.wrongStreak || 0) * 32;
    const newBonus = (record.askedCount || 0) === 0 ? 18 : 0;
    const levelFit = mastery < 25 && item.level <= 2 ? 8 : 0;
    const recentPenalty = (record.recentQuestionIds || []).some((id) => lastSessionIds.includes(id)) && (record.wrongStreak || 0) < 2 ? 30 : 0;
    return dueBonus + weakBonus + newBonus + levelFit + (100 - mastery) * 0.35 - recentPenalty + Math.random() * 8;
  }

  function isDue(record) {
    if (!record.nextDueAt) return true;
    return new Date(record.nextDueAt).getTime() <= Date.now();
  }

  function makeQuestion(item, record, offset) {
    const mastery = record.mastery ?? 0;
    const types = allowedTypes(item, mastery, record);
    const type = types[(sessionSeed() + offset + (record.askedCount || 0)) % types.length];
    if (type === "multiple_choice") return makeMultipleChoice(item, record, offset);
    if (type === "fill_blank") return makeFillBlank(item, record);
    if (type === "ja_to_zh") return makeJaToZh(item, record);
    if (type === "zh_to_ja") return makeZhToJa(item, record);
    if (type === "listening") return makeListening(item, record, offset);
    if (type === "recording") return makeRecording(item, record);
    return makeMultipleChoice(item, record, offset);
  }

  function allowedTypes(item, mastery, record) {
    if ((record.wrongStreak || 0) >= 2) return item.type === "pattern" ? ["fill_blank", "multiple_choice"] : ["multiple_choice", "listening"];
    if (item.type === "pattern") {
      if (mastery < 25) return ["multiple_choice", "fill_blank"];
      if (mastery < 60) return ["fill_blank", "zh_to_ja", "ja_to_zh"];
      return ["zh_to_ja", "recording", "fill_blank"];
    }
    if (mastery < 25) return ["multiple_choice", "listening"];
    if (mastery < 60) return ["multiple_choice", "ja_to_zh", "listening"];
    return ["zh_to_ja", "recording", "listening"];
  }

  function makeMultipleChoice(item, record, offset) {
    const prompt = item.type === "pattern" ? `「${item.ja}」最接近哪個意思？` : `「${item.ja}」是什麼意思？`;
    const correct = item.zh;
    const choices = shuffle([correct, ...distractors(item, offset)]).slice(0, 4);
    if (!choices.includes(correct)) choices[0] = correct;
    return baseQuestion(item, record, "multiple_choice", { prompt, choices, answer: correct, accepted: [correct], instruction: "選一個最自然的答案。" });
  }

  function makeFillBlank(item, record) {
    if (item.type === "pattern" && item.blank) {
      return baseQuestion(item, record, "fill_blank", { prompt: item.blank, answer: item.blankAnswer, accepted: [item.blankAnswer], instruction: "把空格補起來。" });
    }
    return baseQuestion(item, record, "fill_blank", { prompt: `${item.reading || item.zh} = ＿＿`, answer: item.ja, accepted: [item.ja, item.reading].filter(Boolean), instruction: "填入日文。" });
  }

  function makeJaToZh(item, record) {
    return baseQuestion(item, record, "ja_to_zh", { prompt: item.ja, answer: item.zh, accepted: [item.zh], instruction: "翻成中文。" });
  }

  function makeZhToJa(item, record) {
    const prompt = item.type === "pattern" ? item.promptZh || item.zh : item.zh;
    return baseQuestion(item, record, "zh_to_ja", { prompt, answer: item.answer || item.ja, accepted: [item.answer || item.ja, item.ja].filter(Boolean), essentials: item.essential || [item.ja], instruction: "翻成日文。" });
  }

  function makeListening(item, record, offset) {
    const speakText = item.type === "pattern" ? item.ja : item.ja;
    const correct = item.zh;
    const choices = shuffle([correct, ...distractors(item, offset)]).slice(0, 4);
    if (!choices.includes(correct)) choices[0] = correct;
    return baseQuestion(item, record, "listening", { prompt: "聽音後選意思。", speakText, choices, answer: correct, accepted: [correct], instruction: "先按播放，再選答案。" });
  }

  function makeRecording(item, record) {
    const prompt = item.type === "pattern" ? item.promptZh || item.zh : item.zh;
    return baseQuestion(item, record, "recording", { prompt: `請用日文說：${prompt}`, answer: item.answer || item.ja, accepted: [item.answer || item.ja, item.ja].filter(Boolean), essentials: item.essential || [item.ja], instruction: "按錄音作答；不支援錄音時可直接打字。" });
  }

  function baseQuestion(item, record, type, config) {
    const variant = (record.askedCount || 0) + (record.wrongStreak || 0) * 3 + sessionSeed();
    return { id: `${item.id}|${type}|${variant % 9}`, itemId: item.id, item, type, title: typeLabel(type), masteryBefore: record.mastery || 0, ...config };
  }

  function distractors(item, offset) {
    const all = window.KotohaProgress?.getKnowledgeItems?.() || [];
    const sameCategory = all.filter((candidate) => candidate.id !== item.id && candidate.categoryId === item.categoryId && candidate.zh);
    const other = all.filter((candidate) => candidate.id !== item.id && candidate.categoryId !== item.categoryId && candidate.zh);
    return [...sameCategory, ...other].slice(offset % 3).map((candidate) => candidate.zh).filter(Boolean);
  }

  function renderQuiz() {
    const root = body();
    if (!root) return;
    if (!questions.length) {
      root.innerHTML = `<div class="quiz-empty">還沒有足夠資料可以出題，先到語言地圖學一句，或按「重新出題」。</div>`;
      return;
    }
    const question = questions[currentIndex];
    selectedChoice = "";
    checked = false;
    transcript = "";
    progressText().textContent = `${currentIndex + 1} / ${questions.length}`;
    root.innerHTML = "";
    root.append(renderQuestion(question));
  }

  function renderQuestion(question) {
    const card = document.createElement("article");
    card.className = `quiz-card quiz-${question.type}`;
    const head = document.createElement("div");
    head.className = "quiz-card-head";
    head.innerHTML = `<span>${question.title}</span><strong>${window.KotohaProgress?.CATEGORY_LABELS?.[question.item.categoryId] || "練習"}</strong>`;
    const prompt = document.createElement("div");
    prompt.className = "quiz-prompt";
    prompt.textContent = question.prompt;
    const instruction = document.createElement("p");
    instruction.className = "quiz-instruction";
    instruction.textContent = question.instruction || "";
    card.append(head, prompt, instruction);
    if (question.type === "multiple_choice" || question.type === "listening") {
      if (question.type === "listening") card.append(soundButton(question.speakText || question.item.ja));
      card.append(renderChoices(question));
    } else if (question.type === "recording") {
      card.append(renderRecording(question));
    } else {
      card.append(renderTextAnswer(question));
    }
    const feedback = document.createElement("div");
    feedback.className = "quiz-feedback";
    feedback.hidden = true;
    const actions = document.createElement("div");
    actions.className = "quiz-actions";
    const check = document.createElement("button");
    check.className = "coach-send";
    check.type = "button";
    check.textContent = "送出答案";
    check.addEventListener("click", () => checkAnswer(question, card, feedback, check));
    const next = document.createElement("button");
    next.className = "soft-button";
    next.type = "button";
    next.textContent = currentIndex === questions.length - 1 ? "看結果" : "下一題";
    next.hidden = true;
    next.addEventListener("click", () => {
      currentIndex += 1;
      if (currentIndex >= questions.length) finishSession();
      else { writeSession(); renderQuiz(); }
    });
    actions.append(check, next);
    card.append(feedback, actions);
    return card;
  }

  function renderChoices(question) {
    const list = document.createElement("div");
    list.className = "quiz-choice-list";
    question.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quiz-choice";
      button.textContent = choice;
      button.addEventListener("click", () => {
        selectedChoice = choice;
        list.querySelectorAll(".quiz-choice").forEach((node) => node.classList.toggle("selected", node === button));
      });
      list.append(button);
    });
    return list;
  }

  function renderTextAnswer(question) {
    const wrap = document.createElement("div");
    wrap.className = "quiz-answer-wrap";
    const input = document.createElement("input");
    input.className = "quiz-answer-input";
    input.autocomplete = "off";
    input.placeholder = question.type === "ja_to_zh" ? "輸入中文意思" : "輸入日文答案";
    input.dataset.answerInput = "true";
    wrap.append(input);
    setTimeout(() => input.focus(), 40);
    return wrap;
  }

  function renderRecording(question) {
    const wrap = document.createElement("div");
    wrap.className = "quiz-recording";
    const controls = document.createElement("div");
    controls.className = "quiz-recording-controls";
    const record = document.createElement("button");
    record.type = "button";
    record.className = "soft-button";
    record.textContent = "開始錄音";
    const input = document.createElement("input");
    input.className = "quiz-answer-input";
    input.autocomplete = "off";
    input.placeholder = "錄音後會出現辨識文字，也可以手動輸入";
    input.dataset.answerInput = "true";
    record.addEventListener("click", () => startRecording(record, input));
    controls.append(record, soundButton(question.answer));
    wrap.append(controls, input);
    return wrap;
  }

  function soundButton(text) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "soft-button quiz-sound";
    button.textContent = "播放";
    button.addEventListener("click", () => speak(text));
    return button;
  }

  function checkAnswer(question, card, feedback, checkButton) {
    if (checked) return;
    const answer = readAnswer(card, question);
    const result = gradeAnswer(question, answer);
    checked = true;
    const record = window.KotohaProgress.recordQuizResult(question, result.correct);
    feedback.hidden = false;
    feedback.classList.toggle("correct", result.correct);
    feedback.innerHTML = `<strong>${result.correct ? "答對了" : "再練一次就會更穩"}</strong><p>${result.message}</p><p>標準答案：<b>${question.answer}</b></p><small>熟練度：${Math.round(record.mastery || 0)}%</small>`;
    checkButton.hidden = true;
    card.querySelector(".quiz-actions .soft-button").hidden = false;
    writeSession();
  }

  function readAnswer(card, question) {
    if (question.type === "multiple_choice" || question.type === "listening") return selectedChoice;
    return card.querySelector("[data-answer-input]")?.value || transcript || "";
  }

  function gradeAnswer(question, rawAnswer) {
    const answer = String(rawAnswer || "").trim();
    if (!answer) return { correct: false, message: "還沒有作答。" };
    if (question.type === "multiple_choice" || question.type === "listening") {
      const correct = normalize(answer) === normalize(question.answer);
      return { correct, message: correct ? "你選到正確意思。" : "這題的意思先記成標準答案。" };
    }
    if (question.type === "ja_to_zh") {
      const correct = question.accepted.some((accepted) => normalize(answer).includes(normalize(accepted)) || normalize(accepted).includes(normalize(answer)));
      return { correct, message: correct ? "意思抓得很準。" : "意思還差一點，先對照標準答案。" };
    }
    const normalizedAnswer = normalize(answer);
    const exact = question.accepted.some((accepted) => normalize(accepted) === normalizedAnswer);
    const essentials = (question.essentials || []).filter(Boolean);
    const essentialHit = essentials.length ? essentials.every((part) => normalizedAnswer.includes(normalize(part))) : false;
    const correct = exact || essentialHit;
    return { correct, message: correct ? "這樣可以，句子的核心有出來。" : "核心還沒有完整出現，這題會再回來。" };
  }

  function finishSession() {
    sessionStorage.removeItem(SESSION_KEY);
    const root = body();
    const summary = window.KotohaProgress.getSummary();
    if (!root) return;
    progressText().textContent = "完成";
    root.innerHTML = `<section class="quiz-finish"><span class="section-kicker">本輪完成</span><h2>你的語言地圖更新了</h2><p>目前平均熟練度 ${summary.average}%，共有 ${summary.reviewing} 個重點需要回來複習。</p><div class="quiz-actions"><button class="coach-send" id="quiz-again" type="button">再來一組</button><button class="soft-button" id="quiz-map" type="button">看學習地圖</button></div></section>`;
    root.querySelector("#quiz-again")?.addEventListener("click", () => startSession({ forceNew: true }));
    root.querySelector("#quiz-map")?.addEventListener("click", () => window.KotohaFeature?.setFeature?.("learning-map"));
    window.KotohaProgress.renderLearningMap();
  }

  function startRecording(button, input) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      input.placeholder = "這個瀏覽器不支援錄音辨識，請直接輸入答案。";
      input.focus();
      return;
    }
    if (recognition) {
      recognition.stop();
      recognition = null;
      button.textContent = "開始錄音";
      return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    button.textContent = "錄音中…";
    recognition.onresult = (event) => {
      transcript = event.results?.[0]?.[0]?.transcript || "";
      input.value = transcript;
    };
    recognition.onend = () => {
      button.textContent = "重新錄音";
      recognition = null;
    };
    recognition.start();
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 0.88;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function readSession() { return safeJson(sessionStorage.getItem(SESSION_KEY), null); }
  function writeSession() { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ createdAt: new Date().toISOString(), currentIndex, questions })); }
  function isSessionExpired(session) { return !session?.createdAt || Date.now() - new Date(session.createdAt).getTime() > DAY_MS; }
  function sessionSeed() { const today = new Date().toISOString().slice(0, 10); let seed = 0; for (const char of today) seed += char.charCodeAt(0); return seed + Math.floor(performance.now()) % 17; }
  function shuffle(items) { return [...items].sort(() => Math.random() - 0.5); }
  function normalize(value) { return String(value || "").toLocaleLowerCase().replace(/[ \t\r\n，。！？、,.!?「」『』（）()]/g, ""); }
  function typeLabel(type) { return { multiple_choice: "選擇題", fill_blank: "填空題", zh_to_ja: "中翻日", ja_to_zh: "日翻中", listening: "聽力題", recording: "錄音作答" }[type] || "測驗"; }
  function safeJson(value, fallback) { try { return JSON.parse(value || ""); } catch { return fallback; } }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  window.KotohaQuiz = { initQuiz, startSession, renderQuiz };
  document.addEventListener("DOMContentLoaded", initQuiz);
})();
