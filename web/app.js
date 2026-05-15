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
  time: { ja: "時間詞", en: "time" },
  place: { ja: "地點", en: "place" },
  action: { ja: "動作", en: "action" },
  object: { ja: "名詞", en: "noun" },
  grammar: { ja: "文法句型", en: "pattern" },
  phrase: { ja: "常用句", en: "phrase" },
};

let mode = localStorage.getItem(MODE_KEY) || "ja";
let learned = loadLearned();
let lastAnalysis = null;
let lastLanguageMap = null;
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
  handleLearnedChanged();
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
if ("speechSynthesis" in window) window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

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
  gameHeader.textContent = "";
  resultsList.innerHTML = "";
  structurePanel.innerHTML = "";
  practicePanel.innerHTML = "";
  categoryTabs.innerHTML = "";
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, mode }),
    });
    if (!response.ok) throw new Error(`Analyze failed: ${response.status}`);
    const analysis = await response.json();
    if (currentRequest !== requestId) return;
    if (isLanguageMapResult(analysis) || (Array.isArray(analysis.cards) && analysis.cards.length)) {
      gameHeader.textContent = analysis.message || "";
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
  if (isLanguageMapResult(analysis)) return renderLanguageMapAnalysis(analysis, userText);
  renderLegacyCardAnalysis(analysis, userText);
}
function isLanguageMapResult(analysis) {
  return Boolean(analysis && Number(analysis.version || 0) >= 3 && analysis.sentence && Array.isArray(analysis.coreItems));
}
function renderLanguageMapAnalysis(analysis, userText) {
  lastCards = [];
  lastAnalysis = null;
  lastLanguageMap = normalizeLanguageMapResult(analysis, userText);
  refreshLanguageMapDerivedData();
  lessonShell.hidden = false;
  renderLanguageMap();
}
function normalizeLanguageMapResult(analysis, userText) {
  const sentence = {
    target: String(analysis.sentence?.target || "").trim(),
    source: String(analysis.sentence?.source || userText || "").trim(),
    literal: String(analysis.sentence?.literal || "").trim(),
  };
  const coreItems = (Array.isArray(analysis.coreItems) ? analysis.coreItems : [])
    .map((item, index) => ({
      term: String(item.term || "").trim(),
      reading: String(item.reading || "").trim(),
      meaning: String(item.meaning || item.note || "").trim(),
      category: validCategory(item.category),
      sourceText: String(item.sourceText || "").trim(),
      importance: clamp(Number(item.importance || index + 1), 1, 5),
      mode,
    }))
    .filter((item) => item.term)
    .slice(0, 5);
  const detectedCategories = uniqueBy((Array.isArray(analysis.detectedCategories) ? analysis.detectedCategories : []).map((item) => ({ id: String(item.id || "").trim(), label: String(item.label || "").trim(), sourceTerm: String(item.sourceTerm || "").trim(), confidence: Number(item.confidence || 0) })).filter((item) => item.id), "id");
  const detectedPatterns = uniqueBy((Array.isArray(analysis.detectedPatterns) ? analysis.detectedPatterns : []).map((item) => ({ id: String(item.id || "").trim(), label: String(item.label || "").trim(), meaning: String(item.meaning || "").trim(), example: String(item.example || "").trim() })).filter((item) => item.id), "id").slice(0, 2);
  const grammarNotes = (Array.isArray(analysis.grammarNotes) ? analysis.grammarNotes : []).map((item) => ({ patternId: String(item.patternId || "").trim(), title: String(item.title || "").trim(), short: String(item.short || "").trim(), example: String(item.example || "").trim(), level: String(item.level || "beginner").trim() })).filter((item) => item.title && item.short).slice(0, 3);
  return { userText, sentence, coreItems, detectedCategories, expansionSections: [], detectedPatterns, patternPractice: [], grammarNotes, legacyCards: (Array.isArray(analysis.cards) ? analysis.cards : []).map((card) => normalizeCard(card, mode)) };
}
function buildExpansionSections(languageMap) {
  const vocab = window.KotohaVocab;
  if (!vocab) return [];
  const excludeTerms = languageMap.coreItems.flatMap((item) => [item.term, item.reading, item.meaning, item.sourceText]).filter(Boolean);
  return languageMap.detectedCategories.map((detected) => {
    const result = vocab.getExpansionItems(detected.id, learned, { mode, excludeTerms: [...excludeTerms, detected.sourceTerm] });
    if (!result.category) return null;
    return { id: detected.id, detected, category: result.category, completed: result.completed, items: result.items.map((item) => vocab.toCard(item, mode, detected.id)) };
  }).filter(Boolean);
}
function refreshLanguageMapDerivedData() {
  if (!lastLanguageMap) return;
  lastLanguageMap.expansionSections = buildExpansionSections(lastLanguageMap);
  lastLanguageMap.patternPractice = buildPatternPractice(lastLanguageMap);
}
function buildPatternPractice(languageMap) {
  return generatePatternPractice(languageMap.detectedPatterns, languageMap.expansionSections, mode);
}
function renderLanguageMap() {
  categoryTabs.innerHTML = "";
  renderSentenceAndCore();
  renderExpansionSections();
  renderPatternPracticeAndGrammar();
}
function renderSentenceAndCore() {
  if (!lastLanguageMap) return;
  structurePanel.hidden = false;
  structurePanel.classList.add("language-map");
  structurePanel.replaceChildren(createSentencePanel(lastLanguageMap.sentence), createCoreSection(lastLanguageMap.coreItems));
}
function createSentencePanel(sentence) {
  const section = document.createElement("section");
  section.className = "sentence-card";
  const copy = document.createElement("div");
  const kicker = document.createElement("div");
  kicker.className = "section-kicker";
  kicker.textContent = "這句話";
  const target = document.createElement("div");
  target.className = "sentence-target";
  target.textContent = sentence.target || "（還沒有整理出自然句）";
  const source = document.createElement("div");
  source.className = "sentence-source";
  source.textContent = sentence.source || "";
  copy.append(kicker, target, source);
  if (sentence.literal) {
    const literal = document.createElement("div");
    literal.className = "sentence-literal";
    literal.textContent = `直譯：${sentence.literal}`;
    copy.append(literal);
  }
  section.append(copy, iconButton("播放這句話", () => speakText(sentence.target, mode), "♪"));
  return section;
}
function createCoreSection(coreItems) {
  const section = document.createElement("section");
  section.className = "core-section";
  section.append(sectionHeader("這句的核心", "只放原句真的用到、最值得先抓住的部分。"));
  const grid = document.createElement("div");
  grid.className = "core-grid";
  coreItems.forEach((item) => grid.append(createCoreItemRow(item)));
  if (!coreItems.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "這句話暫時沒有拆出核心元素。";
    grid.append(empty);
  }
  section.append(grid);
  return section;
}
function createCoreItemRow(item) {
  const row = document.createElement("div");
  row.className = "core-token";
  row.append(textNode("strong", item.term), textNode("span", item.reading), textNode("span", item.meaning), textNode("span", categoryLabel(item.category)));
  return row;
}
function renderExpansionSections() {
  if (!lastLanguageMap) return;
  resultsList.innerHTML = "";
  resultsList.classList.add("language-map-results");
  if (!lastLanguageMap.expansionSections.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "這句話目前沒有需要延伸的同類詞。";
    resultsList.append(empty);
    return;
  }
  lastLanguageMap.expansionSections.forEach((section) => {
    const wrap = document.createElement("section");
    wrap.className = "expansion-section";
    wrap.append(sectionHeader(section.category.sectionTitle, "學會一個，就會補下一個。"));
    if (section.completed) {
      const done = document.createElement("div");
      done.className = "empty expansion-complete";
      done.textContent = section.category.completedText;
      wrap.append(done);
    } else {
      const grid = document.createElement("div");
      grid.className = "expansion-grid";
      section.items.forEach((itemCard) => grid.append(createExpansionCard(itemCard, section)));
      wrap.append(grid);
    }
    resultsList.append(wrap);
  });
}
function createExpansionCard(itemCard, section) {
  const card = createMiniItemCard(itemCard, { className: "expansion-card" });
  const actions = document.createElement("div");
  actions.className = "card-actions";
  actions.append(iconButton(`播放 ${itemCard.term}`, () => speakCard(itemCard), "♪"));
  const learnButton = document.createElement("button");
  learnButton.className = "learn-button";
  learnButton.type = "button";
  learnButton.textContent = "我已學會";
  learnButton.addEventListener("click", () => markVocabItemLearned(itemCard, section));
  actions.append(learnButton);
  card.append(actions);
  return card;
}
function createMiniItemCard(itemCard, options = {}) {
  const article = document.createElement("article");
  article.className = options.className || "mini-item-card";
  const copy = document.createElement("div");
  const term = document.createElement("h3");
  term.textContent = itemCard.term;
  const reading = document.createElement("p");
  reading.className = "reading";
  reading.textContent = itemCard.reading || "";
  const meaning = document.createElement("p");
  meaning.className = "mini-meaning";
  meaning.textContent = itemCard.meaning || itemCard.note || "";
  copy.append(term, reading, meaning);
  article.append(copy);
  return article;
}
function markVocabItemLearned(itemCard) {
  const key = learnedKey(itemCard);
  learned[key] = { ...itemCard, id: key, learnedAt: new Date().toISOString() };
  saveLearned();
  handleLearnedChanged();
}
function renderPatternPracticeAndGrammar() {
  if (!lastLanguageMap) return;
  const hasPractice = lastLanguageMap.patternPractice.length > 0;
  const hasNotes = lastLanguageMap.grammarNotes.length > 0;
  if (!hasPractice && !hasNotes) {
    practicePanel.innerHTML = "";
    practicePanel.hidden = true;
    return;
  }
  practicePanel.hidden = false;
  practicePanel.innerHTML = "";
  practicePanel.classList.add("practice-map");
  if (hasPractice) {
    const practice = document.createElement("section");
    practice.className = "practice-lines";
    practice.append(sectionHeader("換一個詞，也能這樣說", "同一句型換不同詞，語感會比較快長出來。"));
    lastLanguageMap.patternPractice.forEach((line) => {
      const row = document.createElement("div");
      row.className = "practice-line";
      const target = document.createElement("strong");
      target.textContent = line.target;
      const source = document.createElement("span");
      source.textContent = line.source || "";
      row.append(target, source);
      practice.append(row);
    });
    practicePanel.append(practice);
  }
  if (hasNotes) {
    const grammar = document.createElement("section");
    grammar.className = "grammar-notes";
    grammar.append(sectionHeader("文法小卡", "短短抓住這句話的用法。"));
    lastLanguageMap.grammarNotes.forEach((note) => {
      const card = document.createElement("article");
      card.className = "grammar-note-card";
      const title = document.createElement("h3");
      title.textContent = note.title;
      const short = document.createElement("p");
      short.textContent = note.short;
      card.append(title, short);
      if (note.example) {
        const example = document.createElement("div");
        example.className = "grammar-example";
        example.textContent = `例：${note.example}`;
        card.append(example);
      }
      grammar.append(card);
    });
    practicePanel.append(grammar);
  }
}
function generatePatternPractice(patterns, expansionSections, targetMode) {
  const sections = Object.fromEntries(expansionSections.map((section) => [section.id, section.items]));
  const lines = [];
  patterns.forEach((pattern) => {
    if (pattern.id === "ga_suki_desu") lines.push(...generateGaSukiPractice([...(sections.animal || []), ...(sections.food || [])]));
    if (pattern.id === "want_to_go") lines.push(...generateWantToGoPractice(sections.place || [], sections.time || []));
    if (pattern.id === "want_to_rent") lines.push(...generateWantToRentPractice(sections.rental || []));
    if (pattern.id === "wa_doko_desu") lines.push(...generateWherePractice(sections.place || []));
    if (pattern.id === "price_ikura_desu") lines.push(...generatePricePractice([...(sections.rental || []), ...(sections.food || [])]));
  });
  return lines.slice(0, targetMode === "ja" ? 5 : 4);
}
function generateGaSukiPractice(items) { return items.slice(0, 5).map((item) => ({ target: `${item.term}が好きです。`, source: `我喜歡${item.meaning}。` })); }
function generateWantToGoPractice(placeItems, timeItems = []) {
  const timeText = timeItems[0]?.term || coreTermByCategory("time") || "明日";
  const timeZh = timeItems[0]?.meaning || coreMeaningByCategory("time") || "明天";
  return placeItems.slice(0, 4).map((item) => ({ target: `${timeText}、${item.term}に行きたいです。`, source: `${timeZh}，我想去${item.meaning}。` }));
}
function generateWantToRentPractice(items) { return items.slice(0, 5).map((item) => ({ target: `${item.term}をレンタルしたいです。`, source: `我想租${item.meaning}。` })); }
function generateWherePractice(items) { return items.slice(0, 4).map((item) => ({ target: `${item.term}はどこですか。`, source: `${item.meaning}在哪裡？` })); }
function generatePricePractice(items) {
  const source = items.length ? items : [{ term: "これ", meaning: "這個" }];
  return source.slice(0, 4).map((item) => ({ target: item.term === "これ" ? "これはいくらですか。" : `この${item.term}はいくらですか。`, source: `${item.meaning}多少錢？` }));
}
function coreTermByCategory(category) { return lastLanguageMap?.coreItems.find((item) => item.category === category)?.term || ""; }
function coreMeaningByCategory(category) { return lastLanguageMap?.coreItems.find((item) => item.category === category)?.meaning || ""; }
function renderLegacyCardAnalysis(analysis, userText) {
  lastLanguageMap = null;
  structurePanel.classList.remove("language-map");
  resultsList.classList.remove("language-map-results");
  lastCards = (analysis.cards || []).map((card) => normalizeCard(card, mode)).map(enrichCard);
  lastAnalysis = { userText, cards: lastCards, tokens: buildTokens(analysis, lastCards), practice: buildPractice(analysis, lastCards) };
  lessonShell.hidden = false;
  renderStructure();
  renderCategoryTabs();
  renderCategoryCards();
  renderPractice();
}
function normalizeCard(card, cardMode) {
  return { mode: card.mode === "en" || card.mode === "ja" ? card.mode : cardMode, term: String(card.term || "").trim(), reading: String(card.reading || "").trim(), note: String(card.note || card.meaning || "").trim(), meaning: String(card.meaning || card.note || "").trim(), category: validCategory(card.category), difficulty: clamp(Number(card.difficulty || 1), 1, 3), source: String(card.source || "ai"), related: normalizeRelated(card.related), examples: normalizeStringList(card.examples), rawItem: card.rawItem || null, vocabId: card.vocabId || "" };
}
function enrichCard(card) { return { ...card, related: card.related.length ? card.related : genericExtension(card).related, examples: card.examples.length ? card.examples : genericExtension(card).examples }; }
function genericExtension(card) {
  if (card.mode === "en") {
    if (card.category === "place") return { related: [r("station", "", "車站"), r("restaurant", "", "餐廳")], examples: [`I want to go to ${card.term}.`] };
    if (card.category === "action") return { related: [r("want to", "", "想要"), r("can", "", "可以")], examples: [`I want to ${card.term}.`] };
    return { related: [], examples: [] };
  }
  if (card.category === "place") return { related: [r("駅", "えき", "車站"), r("レストラン", "れすとらん", "餐廳")], examples: [`${card.term}はどこですか。`] };
  if (card.category === "action") return { related: [r("〜たい", "たい", "想做"), r("できます", "できます", "可以做")], examples: [`${toJapaneseWantForm(card.term)}です。`] };
  if (card.category === "grammar") return { related: [r("〜たくない", "たくない", "不想做")], examples: ["行きたいです。", "行きたくないです。"] };
  return { related: [], examples: [] };
}
function r(term, reading, note) { return { term, reading, note }; }
function buildTokens(analysis, cards) {
  if (Array.isArray(analysis.tokens) && analysis.tokens.length) return analysis.tokens.map((token) => ({ surface: String(token.surface || token.term || "").trim(), reading: String(token.reading || "").trim(), role: String(token.role || token.pos || "").trim(), note: String(token.note || token.function || "").trim() })).filter((token) => token.surface);
  return cards.map((card) => ({ surface: card.term, reading: card.reading, role: categoryLabel(card.category), note: structureNote(card) }));
}
function buildPractice(analysis, cards) {
  if (Array.isArray(analysis.practice) && analysis.practice.length) return analysis.practice.map((item) => (typeof item === "string" ? { title: "練習", text: item } : { title: String(item.title || "練習"), text: String(item.text || item.sentence || "") })).filter((item) => item.text);
  const by = (category) => cards.find((card) => card.category === category);
  const time = by("time"), place = by("place"), action = by("action"), object = by("object");
  if (mode === "en") return [{ title: "替換時間", text: `${time?.term || "Tomorrow"} I want to go to ${place?.term || "the station"}.` }, { title: "替換地點", text: `I want to go to ${place?.term || "the station"}.` }, { title: "替換物品", text: `I want to rent ${object?.term || "a ticket"}.` }];
  const actionText = toJapaneseWantForm(action?.term || "レンタルする");
  return [{ title: "替換時間", text: `${time?.term || "明日"}、${place?.term || "駅"}に行きたいです。` }, { title: "替換地點", text: `${place?.term || "駅"}で${object?.term || "切符"}を${actionText}です。` }, { title: "否定練習", text: `${time?.term || "明日"}は${actionText.replace("たい", "たくない")}です。` }];
}
function renderStructure() {
  const tokens = lastAnalysis?.tokens || [];
  if (!tokens.length) { structurePanel.innerHTML = ""; structurePanel.hidden = true; return; }
  structurePanel.hidden = false; structurePanel.innerHTML = "";
  const title = sectionHeader("句子結構", mode === "ja" ? "把句子拆成可運用的時間、地點、動作與句型。" : "A quick structure map for the sentence.");
  const grid = document.createElement("div"); grid.className = "token-grid";
  tokens.forEach((token) => { const row = document.createElement("div"); row.className = "token-row"; row.append(tokenCell(token.surface, "token-term"), tokenCell(token.reading, "token-reading"), tokenCell(token.role, "token-role"), tokenCell(token.note, "token-note")); grid.append(row); });
  structurePanel.append(title, grid);
}
function tokenCell(text, className) { const cell = document.createElement("div"); cell.className = className; cell.textContent = text || ""; return cell; }
function renderCategoryTabs() {
  categoryTabs.innerHTML = "";
  const counts = countCategories(lastCards), total = visibleCards(lastCards, false).length;
  [{ id: "all", label: mode === "ja" ? "全部" : "all", count: total }, ...CATEGORY_ORDER.filter((category) => counts[category]).map((category) => ({ id: category, label: categoryLabel(category), count: counts[category] }))].forEach((tab) => {
    const button = document.createElement("button"); button.className = `tab-button${activeCategory === tab.id ? " active" : ""}`; button.type = "button"; button.textContent = `${tab.label} ${tab.count}`; button.addEventListener("click", () => { activeCategory = tab.id; renderCategoryTabs(); renderCategoryCards(); }); categoryTabs.append(button);
  });
}
function renderCategoryCards() {
  resultsList.classList.remove("language-map-results"); resultsList.innerHTML = "";
  const source = activeCategory === "all" ? lastCards : lastCards.filter((card) => card.category === activeCategory), cards = visibleCards(source, hideLearned);
  if (!cards.length) { const empty = document.createElement("div"); empty.className = "empty"; empty.textContent = hideLearned ? "已學會的卡片已隱藏。" : "這一類暫時沒有卡片。"; resultsList.append(empty); return; }
  if (activeCategory !== "all") { resultsList.append(categorySection(activeCategory, cards)); return; }
  CATEGORY_ORDER.forEach((category) => { const group = cards.filter((card) => card.category === category); if (group.length) resultsList.append(categorySection(category, group)); });
}
function categorySection(category, cards) {
  const section = document.createElement("section"); section.className = "category-section";
  const heading = document.createElement("div"); heading.className = "category-heading";
  const h2 = document.createElement("h2"); h2.textContent = categoryLabel(category);
  const count = document.createElement("div"); count.className = "category-count"; count.textContent = `${cards.length} 個`;
  heading.append(h2, count); section.append(heading, ...cards.map(createCard)); return section;
}
function createCard(card) {
  const isDone = isCardLearned(card), article = document.createElement("article"); article.className = `card${isDone ? " learned" : ""}`;
  const copy = document.createElement("div"), term = document.createElement("h2"), reading = document.createElement("p"); term.className = "term"; term.textContent = card.term; reading.className = "reading"; reading.textContent = card.reading || ""; copy.append(term, reading);
  const actions = document.createElement("div"); actions.className = "card-actions"; actions.append(iconButton(`播放 ${card.term}`, () => speakCard(card), "♪"));
  const learnButton = document.createElement("button"); learnButton.className = `learn-button${isDone ? " done" : ""}`; learnButton.type = "button"; learnButton.textContent = isDone ? "已學會" : "我已學會"; learnButton.addEventListener("click", () => toggleLearned(card)); actions.append(learnButton);
  const pill = document.createElement("span"); pill.className = "pill"; pill.textContent = categoryLabel(card.category);
  const note = document.createElement("p"); note.className = "note"; note.textContent = card.note || "";
  article.append(copy, actions, pill, note); const extra = cardExtra(card); if (extra) article.append(extra); return article;
}
function cardExtra(card) {
  if (!card.related.length && !card.examples.length) return null;
  const wrap = document.createElement("div"); wrap.className = "card-extra";
  if (card.related.length) { const label = document.createElement("div"); label.className = "extra-label"; label.textContent = "相關詞"; const row = document.createElement("div"); row.className = "chip-row"; card.related.forEach((item) => { const chip = document.createElement("button"); chip.className = "word-chip"; chip.type = "button"; chip.textContent = item.note ? `${item.term}・${item.note}` : item.reading && item.reading !== item.term ? `${item.term}・${item.reading}` : item.term; chip.title = item.note || "播放發音"; chip.addEventListener("click", () => speakCard({ ...item, mode: card.mode })); row.append(chip); }); wrap.append(label, row); }
  if (card.examples.length) { const label = document.createElement("div"); label.className = "extra-label"; label.textContent = "例句"; const list = document.createElement("ul"); list.className = "example-list"; card.examples.slice(0, 2).forEach((example) => { const li = document.createElement("li"); li.textContent = example; list.append(li); }); wrap.append(label, list); }
  return wrap;
}
function renderPractice() {
  const practice = lastAnalysis?.practice || [];
  if (!practice.length) { practicePanel.innerHTML = ""; practicePanel.hidden = true; return; }
  practicePanel.hidden = false; practicePanel.innerHTML = ""; practicePanel.classList.remove("practice-map"); practicePanel.append(sectionHeader("句型練習", "把同一個句型換時間、地點或物品，語感會長得比較快。"));
  const grid = document.createElement("div"); grid.className = "practice-grid"; practice.forEach((item) => { const card = document.createElement("div"); card.className = "practice-card"; const strong = document.createElement("strong"); strong.textContent = item.title; const text = document.createElement("p"); text.textContent = item.text; card.append(strong, text); grid.append(card); }); practicePanel.append(grid);
}
function toggleLearned(card) { const key = learnedKey(card); if (learned[key]) delete learned[key]; else learned[key] = { ...card, id: key, learnedAt: new Date().toISOString() }; saveLearned(); handleLearnedChanged(); }
function handleLearnedChanged() { updateToolbar(); if (lastLanguageMap) { refreshLanguageMapDerivedData(); renderExpansionSections(); renderPatternPracticeAndGrammar(); } else { renderCategoryTabs(); renderCategoryCards(); } if (!learnedPanel.hidden) renderLearnedPanel(); }
function loadLearned() { try { const parsed = JSON.parse(localStorage.getItem(LEARNED_KEY) || "{}"); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; } catch { return {}; } }
function saveLearned() { localStorage.setItem(LEARNED_KEY, JSON.stringify(learned)); }
function learnedItems() { return Object.values(learned).sort((a, b) => String(b.learnedAt || "").localeCompare(String(a.learnedAt || ""))); }
function updateToolbar() { const started = home.classList.contains("started"), count = learnedItems().length; learnedOpen.textContent = `已學會 ${count}`; learnedOpen.hidden = !started; hideLearnedButton.hidden = !started || Boolean(lastLanguageMap); hideLearnedButton.classList.toggle("active", hideLearned); hideLearnedButton.textContent = hideLearned ? "顯示已學會" : "隱藏已學會"; }
function renderLearnedPanel() {
  const items = learnedItems(); learnedSummary.textContent = items.length ? `共 ${items.length} 個單詞，存在這台瀏覽器。` : "還沒有記錄。"; learnedList.innerHTML = "";
  if (!items.length) { const empty = document.createElement("div"); empty.className = "empty"; empty.textContent = "看到想留下的卡片，就按「我已學會」。"; learnedList.append(empty); return; }
  items.forEach((item) => { const row = document.createElement("article"); row.className = "learned-item"; const copy = document.createElement("div"); const title = document.createElement("h3"); title.textContent = item.term; const reading = document.createElement("p"); reading.textContent = item.reading || item.meaning || item.note || ""; const meta = document.createElement("div"); meta.className = "learned-meta"; meta.textContent = `${item.mode === "en" ? "英文" : "日文"}・${categoryLabel(item.category)}`; copy.append(title, reading, meta); const actions = document.createElement("div"); actions.className = "card-actions"; actions.append(iconButton(`播放 ${item.term}`, () => speakCard(item), "♪")); const removeButton = document.createElement("button"); removeButton.className = "soft-button"; removeButton.type = "button"; removeButton.textContent = "移除"; removeButton.addEventListener("click", () => { delete learned[item.id || learnedKey(item)]; saveLearned(); handleLearnedChanged(); }); actions.append(removeButton); row.append(copy, actions); learnedList.append(row); });
}
function loadVoices() { if (!("speechSynthesis" in window)) return; voices = window.speechSynthesis.getVoices(); }
function speakText(text, cardMode = mode) { if (!text) return; if (!("speechSynthesis" in window)) { gameHeader.textContent = "這個瀏覽器暫時不支援語音。"; return; } const utterance = new SpeechSynthesisUtterance(text); const targetMode = cardMode === "en" ? "en" : "ja"; utterance.lang = targetMode === "ja" ? "ja-JP" : "en-US"; utterance.rate = targetMode === "ja" ? 0.86 : 0.92; const voice = pickVoice(utterance.lang); if (voice) utterance.voice = voice; window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance); }
function speakCard(card) { speakText(card.term || card.reading, card.mode || mode); }
function pickVoice(lang) { if (!voices.length) loadVoices(); const exact = voices.find((voice) => voice.lang.toLowerCase() === lang.toLowerCase()); if (exact) return exact; const prefix = lang.slice(0, 2).toLowerCase(); return voices.find((voice) => voice.lang.toLowerCase().startsWith(prefix)) || null; }
function exportLearnedFile() { const payload = { app: "Kotoha", version: 3, exportedAt: new Date().toISOString(), words: learnedItems() }; const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `kotoha-learned-${new Date().toISOString().slice(0, 10)}.json`; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url); }
function importLearnedFile(event) { const file = event.target.files && event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(String(reader.result || "{}")); const words = Array.isArray(parsed) ? parsed : Array.isArray(parsed.words) ? parsed.words : []; words.forEach((word) => { const item = word.source === "vocabularyGraph" ? { ...word } : enrichCard(normalizeCard(word, word.mode || mode)); if (!item.term) return; const key = word.id || learnedKey(item); learned[key] = { ...item, id: key, learnedAt: word.learnedAt || new Date().toISOString() }; }); saveLearned(); handleLearnedChanged(); } catch { gameHeader.textContent = "記錄檔格式讀不到。"; } finally { learnedFile.value = ""; } }; reader.readAsText(file); }
function clearLearned() { if (!learnedItems().length) return; if (!confirm("確定清空已學會記錄？")) return; learned = {}; saveLearned(); handleLearnedChanged(); }
function learnedKey(card) { if (card.source === "vocabularyGraph") { if (card.rawItem && window.KotohaVocab) return window.KotohaVocab.vocabLearnedKey(card.rawItem, card.mode || mode); if (card.vocabId) return `vocab|${card.mode || mode}|${card.vocabId}`.toLowerCase(); } return [card.mode || mode, card.category || "phrase", card.term].join("|").toLowerCase(); }
function isCardLearned(card) { if (card.source === "vocabularyGraph" && card.rawItem && window.KotohaVocab) return window.KotohaVocab.isVocabItemLearned(card.rawItem, learned, card.mode || mode); return Boolean(learned[learnedKey(card)]); }
function visibleCards(cards, applyHide = true) { if (!applyHide) return cards; if (!hideLearned) return cards; return cards.filter((card) => !isCardLearned(card)); }
function countCategories(cards) { const counts = {}; visibleCards(cards, hideLearned).forEach((card) => { counts[card.category] = (counts[card.category] || 0) + 1; }); return counts; }
function normalizeRelated(value) { if (!Array.isArray(value)) return []; return value.map((item) => (typeof item === "string" ? { term: item, reading: "", note: "" } : { term: String(item.term || "").trim(), reading: String(item.reading || "").trim(), note: String(item.note || item.meaning || "").trim() })).filter((item) => item.term).slice(0, 4); }
function normalizeStringList(value) { if (!Array.isArray(value)) return []; return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3); }
function categoryLabel(category) { const meta = CATEGORY_META[category] || CATEGORY_META.phrase; return mode === "ja" ? meta.ja : meta.en; }
function validCategory(category) { return CATEGORY_ORDER.includes(category) ? category : "phrase"; }
function structureNote(card) { if (card.category === "grammar") return "句型規則，決定整句怎麼變化。"; if (card.category === "action") return "動作核心，可以替換成其他動詞。"; if (card.category === "place") return "地點位置，常接 に 或 で。"; if (card.category === "object") return "名詞物件，常接 を。"; if (card.category === "time") return "時間提示，常放句首。"; return "常用開口句或固定表達。"; }
function toJapaneseWantForm(term) { if (!term) return "したい"; if (term.includes("レンタル")) return "レンタルしたい"; if (term.includes("行きたい")) return "行きたい"; if (term.endsWith("する")) return `${term.slice(0, -2)}したい`; if (term.endsWith("く")) return `${term.slice(0, -1)}きたい`; if (term.endsWith("る")) return `${term.slice(0, -1)}たい`; if (term.includes("たい")) return term; return `${term}したい`; }
function sectionHeader(title, subtitle = "") { const header = document.createElement("div"); header.className = "panel-title"; const copy = document.createElement("div"); const h2 = document.createElement("h2"); h2.textContent = title; copy.append(h2); if (subtitle) { const p = document.createElement("p"); p.className = "section-subtitle"; p.textContent = subtitle; copy.append(p); } header.append(copy); return header; }
function iconButton(label, onClick, text = "♪") { const button = document.createElement("button"); button.className = "icon-button"; button.type = "button"; button.textContent = text; button.title = label; button.setAttribute("aria-label", label); button.addEventListener("click", onClick); return button; }
function textNode(tag, text) { const node = document.createElement(tag); node.textContent = text || ""; return node; }
function uniqueBy(items, key) { const seen = new Set(); return items.filter((item) => { const value = item[key]; if (seen.has(value)) return false; seen.add(value); return true; }); }
function clamp(value, min, max) { if (!Number.isFinite(value)) return min; return Math.min(max, Math.max(min, value)); }
