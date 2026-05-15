const MODE_KEY = "language-os-mode";
const LEARNED_KEY = "language-os-learned-v1";

const $ = (selector) => document.querySelector(selector);

const home = $("#home");
const form = $("#lesson-form");
const input = $("#sentence-input");
const gameHeader = $("#game-header");
const resultsList = $("#results-list");
const learnedOpen = $("#learned-open");
const learnedPanel = $("#learned-panel");
const learnedSummary = $("#learned-summary");
const learnedList = $("#learned-list");
const learnedClose = $("#learned-close");
const learnedExport = $("#learned-export");
const learnedImport = $("#learned-import");
const learnedClear = $("#learned-clear");
const learnedFile = $("#learned-file");
const modeButtons = [...document.querySelectorAll(".mode-button")];

let mode = localStorage.getItem(MODE_KEY) || "ja";
let learned = loadLearned();
let lastCards = [];
let requestId = 0;
let voices = [];

loadVoices();
setMode(mode, false);
updateLearnedOpen();
input.focus();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  startGame(input.value);
});

input.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.isComposing) return;
  event.preventDefault();
  startGame(input.value);
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

learnedOpen.addEventListener("click", () => {
  learnedPanel.hidden = !learnedPanel.hidden;
  renderLearnedPanel();
});

learnedClose.addEventListener("click", () => {
  learnedPanel.hidden = true;
  input.focus();
});

learnedExport.addEventListener("click", exportLearnedFile);
learnedImport.addEventListener("click", () => learnedFile.click());
learnedClear.addEventListener("click", clearLearned);
learnedFile.addEventListener("change", importLearnedFile);

if ("speechSynthesis" in window) {
  window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
}

function setMode(nextMode, rerun = true) {
  mode = nextMode === "en" ? "en" : "ja";
  localStorage.setItem(MODE_KEY, mode);
  modeButtons.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  input.focus();
  if (rerun && home.classList.contains("started")) startGame(input.value);
}

async function startGame(rawText) {
  const text = rawText.trim();
  if (!text) return;

  home.classList.add("started");
  learnedPanel.hidden = true;
  updateLearnedOpen();

  const currentRequest = ++requestId;
  gameHeader.textContent = mode === "ja" ? "判斷中..." : "Thinking...";
  resultsList.innerHTML = "";

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, mode }),
    });
    if (!response.ok) throw new Error(`Analyze failed: ${response.status}`);

    const analysis = await response.json();
    if (currentRequest !== requestId) return;
    if (Array.isArray(analysis.cards) && analysis.cards.length) {
      gameHeader.textContent = analysis.message || `找到 ${analysis.cards.length} 個練習點。`;
      renderCards(analysis.cards);
      return;
    }
  } catch (error) {
    console.warn("Analyze failed.", error);
  }

  if (currentRequest !== requestId) return;
  gameHeader.textContent = mode === "ja" ? "暫時無法分析，請再試一次。" : "Could not analyze yet. Try again.";
  resultsList.innerHTML = '<div class="empty">API 暫時沒有回應。</div>';
}

function renderCards(cards) {
  lastCards = cards.map((card) => normalizeCard(card, mode));
  resultsList.innerHTML = "";

  lastCards.forEach((card) => {
    const key = learnedKey(card);
    const isDone = Boolean(learned[key]);
    const article = document.createElement("article");
    article.className = `card${isDone ? " learned" : ""}`;

    const copy = document.createElement("div");
    const term = document.createElement("h2");
    term.className = "term";
    term.textContent = card.term;
    const reading = document.createElement("p");
    reading.className = "reading";
    reading.textContent = card.reading || "";
    copy.append(term, reading);

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const speakButton = document.createElement("button");
    speakButton.className = "icon-button";
    speakButton.type = "button";
    speakButton.textContent = "♪";
    speakButton.title = "播放發音";
    speakButton.setAttribute("aria-label", `播放 ${card.term}`);
    speakButton.addEventListener("click", () => speakCard(card));

    const learnButton = document.createElement("button");
    learnButton.className = `learn-button${isDone ? " done" : ""}`;
    learnButton.type = "button";
    learnButton.textContent = isDone ? "已學會" : "我已學會";
    learnButton.addEventListener("click", () => toggleLearned(card));
    actions.append(speakButton, learnButton);

    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = categoryLabel(card.category);

    const note = document.createElement("p");
    note.className = "note";
    note.textContent = card.note || "";

    article.append(copy, actions, pill, note);
    resultsList.append(article);
  });
}

function normalizeCard(card, cardMode) {
  return {
    mode: card.mode === "en" || card.mode === "ja" ? card.mode : cardMode,
    term: String(card.term || "").trim(),
    reading: String(card.reading || "").trim(),
    note: String(card.note || "").trim(),
    category: String(card.category || "phrase").trim(),
    difficulty: Number(card.difficulty || 1),
    source: String(card.source || "ai"),
  };
}

function toggleLearned(card) {
  const key = learnedKey(card);
  if (learned[key]) {
    delete learned[key];
  } else {
    learned[key] = { ...card, id: key, learnedAt: new Date().toISOString() };
  }
  saveLearned();
  updateLearnedOpen();
  renderCards(lastCards);
  if (!learnedPanel.hidden) renderLearnedPanel();
}

function learnedKey(card) {
  return [card.mode, card.category || "phrase", card.term].join("|").toLocaleLowerCase();
}

function loadLearned() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEARNED_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveLearned() {
  localStorage.setItem(LEARNED_KEY, JSON.stringify(learned));
}

function learnedItems() {
  return Object.values(learned).sort((a, b) => String(b.learnedAt || "").localeCompare(String(a.learnedAt || "")));
}

function updateLearnedOpen() {
  const count = learnedItems().length;
  learnedOpen.textContent = `已學會 ${count}`;
  learnedOpen.hidden = !home.classList.contains("started");
}

function renderLearnedPanel() {
  const items = learnedItems();
  learnedSummary.textContent = items.length ? `共 ${items.length} 個單詞，存在這台瀏覽器。` : "還沒有記錄。";
  learnedList.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "看到想留下的卡片，就按「我已學會」。";
    learnedList.append(empty);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("article");
    row.className = "learned-item";

    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = item.term;
    const reading = document.createElement("p");
    reading.textContent = item.reading || item.note || "";
    const meta = document.createElement("div");
    meta.className = "learned-meta";
    meta.textContent = `${item.mode === "ja" ? "日文" : "英文"}・${categoryLabel(item.category)}`;
    copy.append(title, reading, meta);

    const actions = document.createElement("div");
    actions.className = "card-actions";
    const speakButton = document.createElement("button");
    speakButton.className = "icon-button";
    speakButton.type = "button";
    speakButton.textContent = "♪";
    speakButton.title = "播放發音";
    speakButton.setAttribute("aria-label", `播放 ${item.term}`);
    speakButton.addEventListener("click", () => speakCard(item));
    const removeButton = document.createElement("button");
    removeButton.className = "soft-button";
    removeButton.type = "button";
    removeButton.textContent = "移除";
    removeButton.addEventListener("click", () => {
      delete learned[item.id || learnedKey(item)];
      saveLearned();
      updateLearnedOpen();
      renderLearnedPanel();
      renderCards(lastCards);
    });
    actions.append(speakButton, removeButton);
    row.append(copy, actions);
    learnedList.append(row);
  });
}

function loadVoices() {
  if (!("speechSynthesis" in window)) return;
  voices = window.speechSynthesis.getVoices();
}

function speakCard(card) {
  const text = card.term || card.reading;
  if (!text) return;
  if (!("speechSynthesis" in window)) {
    gameHeader.textContent = "這個瀏覽器暫時不支援語音。";
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const targetMode = card.mode === "en" ? "en" : "ja";
  utterance.lang = targetMode === "ja" ? "ja-JP" : "en-US";
  utterance.rate = targetMode === "ja" ? 0.86 : 0.92;
  const voice = pickVoice(utterance.lang);
  if (voice) utterance.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function pickVoice(lang) {
  if (!voices.length) loadVoices();
  const exact = voices.find((voice) => voice.lang.toLowerCase() === lang.toLowerCase());
  if (exact) return exact;
  const prefix = lang.slice(0, 2).toLowerCase();
  return voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix)) || null;
}

function exportLearnedFile() {
  const payload = {
    app: "Little Lessons",
    version: 1,
    exportedAt: new Date().toISOString(),
    words: learnedItems(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `little-lessons-learned-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importLearnedFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      const words = Array.isArray(parsed) ? parsed : Array.isArray(parsed.words) ? parsed.words : [];
      words.forEach((word) => {
        const card = normalizeCard(word, word.mode || mode);
        if (!card.term) return;
        const key = word.id || learnedKey(card);
        learned[key] = { ...card, id: key, learnedAt: word.learnedAt || new Date().toISOString() };
      });
      saveLearned();
      updateLearnedOpen();
      renderLearnedPanel();
      renderCards(lastCards);
    } catch {
      gameHeader.textContent = "記錄檔格式讀不到。";
    } finally {
      learnedFile.value = "";
    }
  };
  reader.readAsText(file);
}

function clearLearned() {
  if (!learnedItems().length) return;
  if (!confirm("確定清空已學會記錄？")) return;
  learned = {};
  saveLearned();
  updateLearnedOpen();
  renderLearnedPanel();
  renderCards(lastCards);
}

function categoryLabel(category) {
  const map = {
    action: mode === "ja" ? "動作" : "action",
    grammar: mode === "ja" ? "文法" : "pattern",
    object: mode === "ja" ? "物品" : "thing",
    phrase: mode === "ja" ? "句型" : "phrase",
    place: mode === "ja" ? "地點" : "place",
    time: mode === "ja" ? "時間" : "time",
  };
  return map[category] || category;
}
