const MODE_KEY = "language-os-mode";
const LEARNED_KEY = "language-os-learned-v1";
const HIDE_LEARNED_KEY = "language-os-hide-learned";

const $ = (selector) => document.querySelector(selector);

const home = $("#home");
const form = $("#lesson-form");
const input = $("#sentence-input");
const gameHeader = $("#game-header");
const lessonShell = $("#lesson-shell");
const structurePanel = $("#structure-panel");
const categoryTabs = $("#category-tabs");
const resultsList = $("#results-list");
const practicePanel = $("#practice-panel");
const learnedOpen = $("#learned-open");
const hideLearnedButton = $("#hide-learned");
const learnedPanel = $("#learned-panel");
const learnedSummary = $("#learned-summary");
const learnedList = $("#learned-list");
const learnedClose = $("#learned-close");
const learnedExport = $("#learned-export");
const learnedImport = $("#learned-import");
const learnedClear = $("#learned-clear");
const learnedFile = $("#learned-file");
const modeButtons = [...document.querySelectorAll(".mode-button")];

const CATEGORY_ORDER = ["time", "place", "action", "object", "grammar", "phrase"];
const CATEGORY_META = {
  time: { ja: "時間詞", en: "time", mark: "時" },
  place: { ja: "地點", en: "place", mark: "地" },
  action: { ja: "動作", en: "action", mark: "動" },
  object: { ja: "名詞", en: "noun", mark: "名" },
  grammar: { ja: "文法句型", en: "pattern", mark: "文" },
  phrase: { ja: "常用句", en: "phrase", mark: "句" },
};

const EXTENSIONS = {
  ja: {
    "明日": {
      related: [r("今日", "きょう", "今天"), r("昨日", "きのう", "昨天"), r("あさって", "あさって", "後天")],
      examples: ["明日、スキー場に行きたいです。", "あさって、駅に行きたいです。"],
    },
    "行きたい": {
      related: [r("行く", "いく", "去"), r("行きたくない", "いきたくない", "不想去"), r("行きます", "いきます", "去的禮貌形")],
      examples: ["明日、東京に行きたいです。", "今日は行きたくないです。"],
    },
    "スキー場": {
      related: [r("駅", "えき", "車站"), r("映画館", "えいがかん", "電影院"), r("レストラン", "れすとらん", "餐廳")],
      examples: ["スキー場はどこですか。", "スキー場でレンタルできますか。"],
    },
    "レンタルする": {
      related: [r("借りる", "かりる", "借用"), r("返す", "かえす", "歸還"), r("予約する", "よやくする", "預約")],
      examples: ["スノーボードをレンタルしたいです。", "ウェアもレンタルできますか。"],
    },
    "スノーボード": {
      related: [r("ボード", "ぼーど", "板子"), r("スキー板", "すきーいた", "雙板"), r("ブーツ", "ぶーつ", "靴子")],
      examples: ["スノーボードをレンタルしたいです。", "このボードはいくらですか。"],
    },
    "〜たい": {
      related: [r("〜たくない", "たくない", "不想做"), r("〜たいです", "たいです", "想做的禮貌說法"), r("〜たがる", "たがる", "第三人稱想做")],
      examples: ["行きたいです。", "レンタルしたくないです。"],
    },
  },
  en: {
    tomorrow: {
      related: [r("today", "tuh-DAY", "今天"), r("yesterday", "YES-ter-day", "昨天"), r("the day after tomorrow", "", "後天")],
      examples: ["Tomorrow I want to go to the ski resort.", "The day after tomorrow, I want to go shopping."],
    },
    "want to go": {
      related: [r("go", "goh", "去"), r("don't want to go", "", "不想去"), r("would like to go", "", "較禮貌")],
      examples: ["I want to go to the station.", "I would like to go to the ski resort."],
    },
    "ski resort": {
      related: [r("station", "STAY-shun", "車站"), r("movie theater", "", "電影院"), r("restaurant", "", "餐廳")],
      examples: ["Where is the ski resort?", "Can I rent a snowboard at the ski resort?"],
    },
    rent: {
      related: [r("borrow", "", "借用"), r("return", "", "歸還"), r("reserve", "", "預約")],
      examples: ["I want to rent a snowboard.", "Can I rent boots too?"],
    },
    snowboard: {
      related: [r("board", "", "板子"), r("skis", "", "雙板"), r("boots", "", "靴子")],
      examples: ["I want to rent a snowboard.", "How much is this snowboard?"],
    },
  },
};

let mode = localStorage.getItem(MODE_KEY) || "ja";
let learned = loadLearned();
let lastAnalysis = null;
let lastCards = [];
let activeCategory = "all";
let hideLearned = localStorage.getItem(HIDE_LEARNED_KEY) === "1";
let requestId = 0;
let voices = [];

loadVoices();
setMode(mode, false);
updateToolbar();
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

modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));

hideLearnedButton.addEventListener("click", () => {
  hideLearned = !hideLearned;
  localStorage.setItem(HIDE_LEARNED_KEY, hideLearned ? "1" : "0");
  updateToolbar();
  renderCategoryTabs();
  renderCategoryCards();
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

function r(term, reading, note) {
  return { term, reading, note };
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
  lessonShell.hidden = true;
  learnedPanel.hidden = true;
  updateToolbar();

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
      activeCategory = "all";
      renderAnalysis(analysis, text);
      return;
    }
  } catch (error) {
    console.warn("Analyze failed.", error);
  }

  if (currentRequest !== requestId) return;
  gameHeader.textContent = mode === "ja" ? "暫時無法分析，請再試一次。" : "Could not analyze yet. Try again.";
  lessonShell.hidden = false;
  structurePanel.innerHTML = "";
  categoryTabs.innerHTML = "";
  practicePanel.innerHTML = "";
  resultsList.innerHTML = '<div class="empty">API 暫時沒有回應。</div>';
}

function renderAnalysis(analysis, userText) {
  lastCards = analysis.cards.map((card) => normalizeCard(card, mode)).map(enrichCard);
  lastAnalysis = {
    userText,
    cards: lastCards,
    tokens: buildTokens(analysis, lastCards),
    practice: buildPractice(analysis, lastCards),
  };
  lessonShell.hidden = false;
  renderStructure();
  renderCategoryTabs();
  renderCategoryCards();
  renderPractice();
}

function normalizeCard(card, cardMode) {
  return {
    mode: card.mode === "en" || card.mode === "ja" ? card.mode : cardMode,
    term: String(card.term || "").trim(),
    reading: String(card.reading || "").trim(),
    note: String(card.note || "").trim(),
    category: validCategory(card.category),
    difficulty: clamp(Number(card.difficulty || 1), 1, 3),
    source: String(card.source || "ai"),
    related: normalizeRelated(card.related),
    examples: normalizeStringList(card.examples),
  };
}

function enrichCard(card) {
  const extension = findExtension(card);
  return {
    ...card,
    related: card.related.length ? card.related : extension.related,
    examples: card.examples.length ? card.examples : extension.examples,
  };
}

function findExtension(card) {
  const bank = EXTENSIONS[card.mode] || {};
  const direct = bank[card.term] || bank[card.term.toLowerCase()];
  if (direct) return direct;

  const lower = card.term.toLowerCase();
  const fuzzyKey = Object.keys(bank).find((key) => lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower));
  if (fuzzyKey) return bank[fuzzyKey];

  return genericExtension(card);
}

function genericExtension(card) {
  if (card.mode === "en") {
    if (card.category === "place") return { related: [r("station", "", "車站"), r("restaurant", "", "餐廳")], examples: [`I want to go to the ${card.term}.`] };
    if (card.category === "action") return { related: [r("want to", "", "想要"), r("can", "", "可以")], examples: [`I want to ${card.term}.`] };
    return { related: [], examples: [] };
  }
  if (card.category === "place") return { related: [r("駅", "えき", "車站"), r("レストラン", "れすとらん", "餐廳")], examples: [`${card.term}はどこですか。`] };
  if (card.category === "action") return { related: [r("〜たい", "たい", "想做"), r("できます", "できます", "可以做")], examples: [`${toJapaneseWantForm(card.term)}です。`] };
  if (card.category === "grammar") return { related: [r("〜たくない", "たくない", "不想做")], examples: ["行きたいです。", "行きたくないです。"] };
  return { related: [], examples: [] };
}

function buildTokens(analysis, cards) {
  if (Array.isArray(analysis.tokens) && analysis.tokens.length) {
    return analysis.tokens
      .map((token) => ({
        surface: String(token.surface || token.term || "").trim(),
        reading: String(token.reading || "").trim(),
        role: String(token.role || token.pos || "").trim(),
        note: String(token.note || token.function || "").trim(),
      }))
      .filter((token) => token.surface);
  }

  return cards.map((card) => ({
    surface: card.term,
    reading: card.reading,
    role: categoryLabel(card.category),
    note: structureNote(card),
  }));
}

function buildPractice(analysis, cards) {
  if (Array.isArray(analysis.practice) && analysis.practice.length) {
    return analysis.practice
      .map((item) => (typeof item === "string" ? { title: "練習", text: item } : { title: String(item.title || "練習"), text: String(item.text || item.sentence || "") }))
      .filter((item) => item.text);
  }

  const by = (category) => cards.find((card) => card.category === category);
  const time = by("time");
  const place = by("place");
  const action = by("action");
  const object = by("object");

  if (mode === "en") {
    const placeText = place?.term || "the station";
    const objectText = object?.term || "a ticket";
    return [
      { title: "替換時間", text: `${time?.term || "Tomorrow"} I want to go to ${placeText}.` },
      { title: "替換地點", text: `I want to go to ${placeText}.` },
      { title: "替換物品", text: `I want to rent ${objectText}.` },
    ];
  }

  const timeText = time?.term || "明日";
  const placeText = place?.term || "駅";
  const objectText = object?.term || "切符";
  const actionText = toJapaneseWantForm(action?.term || "レンタルする");
  return [
    { title: "替換時間", text: `${timeText}、${placeText}に行きたいです。` },
    { title: "替換地點", text: `${placeText}で${objectText}を${actionText}です。` },
    { title: "否定練習", text: `${timeText}は${actionText.replace("たい", "たくない")}です。` },
  ];
}

function renderStructure() {
  const tokens = lastAnalysis?.tokens || [];
  if (!tokens.length) {
    structurePanel.innerHTML = "";
    structurePanel.hidden = true;
    return;
  }
  structurePanel.hidden = false;
  structurePanel.innerHTML = "";
  const title = document.createElement("div");
  title.className = "panel-title";
  const copy = document.createElement("div");
  const heading = document.createElement("h2");
  heading.textContent = "句子結構";
  const sub = document.createElement("p");
  sub.textContent = mode === "ja" ? "把句子拆成可運用的時間、地點、動作與句型。" : "A quick structure map for the sentence.";
  copy.append(heading, sub);
  title.append(copy);

  const grid = document.createElement("div");
  grid.className = "token-grid";
  tokens.forEach((token) => {
    const row = document.createElement("div");
    row.className = "token-row";
    row.append(tokenCell(token.surface, "token-term"), tokenCell(token.reading, "token-reading"), tokenCell(token.role, "token-role"), tokenCell(token.note, "token-note"));
    grid.append(row);
  });
  structurePanel.append(title, grid);
}

function tokenCell(text, className) {
  const cell = document.createElement("div");
  cell.className = className;
  cell.textContent = text || "";
  return cell;
}

function renderCategoryTabs() {
  categoryTabs.innerHTML = "";
  const counts = countCategories(lastCards);
  const total = visibleCards(lastCards, false).length;
  const tabs = [{ id: "all", label: mode === "ja" ? "全部" : "all", count: total }, ...CATEGORY_ORDER.filter((category) => counts[category]).map((category) => ({ id: category, label: categoryLabel(category), count: counts[category] }))];

  tabs.forEach((tab) => {
    const button = document.createElement("button");
    button.className = `tab-button${activeCategory === tab.id ? " active" : ""}`;
    button.type = "button";
    button.textContent = `${tab.label} ${tab.count}`;
    button.addEventListener("click", () => {
      activeCategory = tab.id;
      renderCategoryTabs();
      renderCategoryCards();
    });
    categoryTabs.append(button);
  });
}

function renderCategoryCards() {
  resultsList.innerHTML = "";
  const source = activeCategory === "all" ? lastCards : lastCards.filter((card) => card.category === activeCategory);
  const cards = visibleCards(source, hideLearned);
  if (!cards.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = hideLearned ? "已學會的卡片已隱藏。" : "這一類暫時沒有卡片。";
    resultsList.append(empty);
    return;
  }

  if (activeCategory !== "all") {
    resultsList.append(categorySection(activeCategory, cards));
    return;
  }

  CATEGORY_ORDER.forEach((category) => {
    const group = cards.filter((card) => card.category === category);
    if (group.length) resultsList.append(categorySection(category, group));
  });
}

function categorySection(category, cards) {
  const section = document.createElement("section");
  section.className = "category-section";
  const heading = document.createElement("div");
  heading.className = "category-heading";
  const h2 = document.createElement("h2");
  h2.textContent = categoryLabel(category);
  const count = document.createElement("div");
  count.className = "category-count";
  count.textContent = `${cards.length} 個`;
  heading.append(h2, count);
  section.append(heading, ...cards.map(createCard));
  return section;
}

function createCard(card) {
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

  const extra = cardExtra(card);
  if (extra) article.append(extra);
  return article;
}

function cardExtra(card) {
  if (!card.related.length && !card.examples.length) return null;
  const wrap = document.createElement("div");
  wrap.className = "card-extra";

  if (card.related.length) {
    const label = document.createElement("div");
    label.className = "extra-label";
    label.textContent = "相關詞";
    const row = document.createElement("div");
    row.className = "chip-row";
    card.related.forEach((item) => {
      const chip = document.createElement("button");
      chip.className = "word-chip";
      chip.type = "button";
      chip.textContent = item.reading ? `${item.term}・${item.reading}` : item.term;
      chip.title = item.note || "播放發音";
      chip.addEventListener("click", () => speakCard({ ...item, mode: card.mode }));
      row.append(chip);
    });
    wrap.append(label, row);
  }

  if (card.examples.length) {
    const label = document.createElement("div");
    label.className = "extra-label";
    label.textContent = "例句";
    const list = document.createElement("ul");
    list.className = "example-list";
    card.examples.slice(0, 2).forEach((example) => {
      const li = document.createElement("li");
      li.textContent = example;
      list.append(li);
    });
    wrap.append(label, list);
  }

  return wrap;
}

function renderPractice() {
  const practice = lastAnalysis?.practice || [];
  if (!practice.length) {
    practicePanel.innerHTML = "";
    practicePanel.hidden = true;
    return;
  }
  practicePanel.hidden = false;
  practicePanel.innerHTML = "";

  const title = document.createElement("div");
  title.className = "panel-title";
  const copy = document.createElement("div");
  const h2 = document.createElement("h2");
  h2.textContent = "句型練習";
  const p = document.createElement("p");
  p.textContent = "把同一個句型換時間、地點或物品，語感會長得比較快。";
  copy.append(h2, p);
  title.append(copy);

  const grid = document.createElement("div");
  grid.className = "practice-grid";
  practice.forEach((item) => {
    const card = document.createElement("div");
    card.className = "practice-card";
    const strong = document.createElement("strong");
    strong.textContent = item.title;
    const text = document.createElement("p");
    text.textContent = item.text;
    card.append(strong, text);
    grid.append(card);
  });
  practicePanel.append(title, grid);
}

function toggleLearned(card) {
  const key = learnedKey(card);
  if (learned[key]) {
    delete learned[key];
  } else {
    learned[key] = { ...card, id: key, learnedAt: new Date().toISOString() };
  }
  saveLearned();
  updateToolbar();
  renderCategoryTabs();
  renderCategoryCards();
  if (!learnedPanel.hidden) renderLearnedPanel();
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

function updateToolbar() {
  const started = home.classList.contains("started");
  const count = learnedItems().length;
  learnedOpen.textContent = `已學會 ${count}`;
  learnedOpen.hidden = !started;
  hideLearnedButton.hidden = !started;
  hideLearnedButton.classList.toggle("active", hideLearned);
  hideLearnedButton.textContent = hideLearned ? "顯示已學會" : "隱藏已學會";
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
      updateToolbar();
      renderLearnedPanel();
      renderCategoryTabs();
      renderCategoryCards();
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
    version: 2,
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
        const card = enrichCard(normalizeCard(word, word.mode || mode));
        if (!card.term) return;
        const key = word.id || learnedKey(card);
        learned[key] = { ...card, id: key, learnedAt: word.learnedAt || new Date().toISOString() };
      });
      saveLearned();
      updateToolbar();
      renderLearnedPanel();
      renderCategoryTabs();
      renderCategoryCards();
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
  updateToolbar();
  renderLearnedPanel();
  renderCategoryTabs();
  renderCategoryCards();
}

function normalizeRelated(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? { term: item, reading: "", note: "" } : { term: String(item.term || "").trim(), reading: String(item.reading || "").trim(), note: String(item.note || "").trim() }))
    .filter((item) => item.term)
    .slice(0, 4);
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3);
}

function visibleCards(cards, applyHide = true) {
  if (!applyHide) return cards;
  if (!hideLearned) return cards;
  return cards.filter((card) => !learned[learnedKey(card)]);
}

function countCategories(cards) {
  const counts = {};
  visibleCards(cards, hideLearned).forEach((card) => {
    counts[card.category] = (counts[card.category] || 0) + 1;
  });
  return counts;
}

function learnedKey(card) {
  return [card.mode, card.category || "phrase", card.term].join("|").toLowerCase();
}

function categoryLabel(category) {
  const meta = CATEGORY_META[category] || CATEGORY_META.phrase;
  return mode === "ja" ? meta.ja : meta.en;
}

function validCategory(category) {
  return CATEGORY_ORDER.includes(category) ? category : "phrase";
}

function structureNote(card) {
  if (card.category === "grammar") return "句型規則，決定整句怎麼變化。";
  if (card.category === "action") return "動作核心，可以替換成其他動詞。";
  if (card.category === "place") return "地點位置，常接 に 或 で。";
  if (card.category === "object") return "名詞物件，常接 を。";
  if (card.category === "time") return "時間提示，常放句首。";
  return "常用開口句或固定表達。";
}

function toJapaneseWantForm(term) {
  if (!term) return "したい";
  if (term.includes("レンタル")) return "レンタルしたい";
  if (term.includes("行きたい")) return "行きたい";
  if (term.endsWith("する")) return `${term.slice(0, -2)}したい`;
  if (term.endsWith("く")) return `${term.slice(0, -1)}きたい`;
  if (term.endsWith("る")) return `${term.slice(0, -1)}たい`;
  if (term.includes("たい")) return term;
  return `${term}したい`;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
