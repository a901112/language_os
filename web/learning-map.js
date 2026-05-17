(() => {
  const PROGRESS_KEY = "kotoha-learning-progress-v1";
  const LEARNED_KEY = "language-os-learned-v1";
  const DAY_MS = 24 * 60 * 60 * 1000;
  const MASTERED_THRESHOLD = 65;
  const LEARNED_MASTERY = 100;

  const PATTERNS = [
    { id: "pattern_ga_suki_desu", type: "pattern", categoryId: "pattern", label: "〜が好きです", zh: "喜歡～", ja: "猫が好きです。", promptZh: "我喜歡貓。", answer: "猫が好きです。", blank: "猫＿好きです。", blankAnswer: "が", essential: ["猫", "好き"], level: 1 },
    { id: "pattern_wo_tabemashita", type: "pattern", categoryId: "food", label: "〜を食べました", zh: "吃了～", ja: "ラーメンを食べました。", promptZh: "我吃了拉麵。", answer: "ラーメンを食べました。", blank: "ラーメン＿食べました。", blankAnswer: "を", essential: ["ラーメン", "食べました"], level: 2 },
    { id: "pattern_tai_desu", type: "pattern", categoryId: "action", label: "〜たいです", zh: "想做某事", ja: "スキー場に行きたいです。", promptZh: "我想去滑雪場。", answer: "スキー場に行きたいです。", blank: "スキー場に行き＿です。", blankAnswer: "たい", essential: ["スキー場", "行きたい"], level: 2 },
    { id: "pattern_rental_tai", type: "pattern", categoryId: "rental", label: "〜をレンタルしたいです", zh: "想租～", ja: "ブーツをレンタルしたいです。", promptZh: "我想租靴子。", answer: "ブーツをレンタルしたいです。", blank: "ブーツ＿レンタルしたいです。", blankAnswer: "を", essential: ["ブーツ", "レンタルしたい"], level: 3 },
  ];

  const CATEGORY_LABELS = { animal: "動物", time: "時間", food: "食物", place: "地點", rental: "租借", action: "動作", pattern: "句型", object: "物品" };

  function loadJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function loadProgress() { return loadJSON(PROGRESS_KEY, {}); }
  function loadLearned() { return loadJSON(LEARNED_KEY, {}); }

  function saveProgress(progress) {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    window.dispatchEvent(new CustomEvent("kotoha-progress-changed"));
  }

  function getVocabItems() {
    const graph = window.KOTOHA_VOCABULARY_GRAPH || {};
    return Object.values(graph).flatMap((category) =>
      (category.items || []).map((item) => ({
        id: `vocab_${item.id}`,
        sourceId: item.id,
        type: "vocab",
        categoryId: category.id,
        label: item.ja,
        ja: item.ja,
        reading: item.reading || "",
        zh: item.zh,
        answer: item.ja,
        level: Math.max(1, Math.min(3, Math.ceil((item.rank || 1) / 4))),
        rawItem: item,
      }))
    );
  }

  function getKnowledgeItems() { return [...getVocabItems(), ...PATTERNS]; }

  function baseRecord(item, mastery = 8) {
    return { id: item.id, type: item.type, categoryId: item.categoryId, label: item.label || item.ja || item.id, zh: item.zh || "", mastery, learned: false, seenCount: 0, askedCount: 0, correctCount: 0, wrongCount: 0, correctStreak: 0, wrongStreak: 0, lastAskedAt: "", nextDueAt: "", recentQuestionIds: [], lastQuestionType: "" };
  }

  function learnedKeyForItem(item) {
    if (item.rawItem && window.KotohaVocab) return window.KotohaVocab.vocabLearnedKey(item.rawItem, "ja");
    return "";
  }

  function legacyLearnedKeyForItem(item) {
    if (!item.rawItem) return "";
    return `ja|${item.rawItem.category || "object"}|${item.rawItem.ja}`.toLowerCase();
  }

  function isItemLearned(item, learned = loadLearned()) {
    return Boolean(learned[learnedKeyForItem(item)] || learned[legacyLearnedKeyForItem(item)]);
  }

  function lockLearnedRecord(record) {
    record.learned = true;
    record.mastery = LEARNED_MASTERY;
    record.wrongStreak = 0;
    record.correctStreak = Math.max(record.correctStreak || 0, 3);
    record.nextDueAt = new Date(Date.now() + 365 * DAY_MS).toISOString();
  }

  function ensureProgressForItems(progress = loadProgress()) {
    const learned = loadLearned();
    let changed = false;
    getKnowledgeItems().forEach((item) => {
      const learnedHit = isItemLearned(item, learned);
      const seeded = baseRecord(item, learnedHit ? LEARNED_MASTERY : 8);
      if (!progress[item.id]) {
        progress[item.id] = seeded;
        if (learnedHit) lockLearnedRecord(progress[item.id]);
        changed = true;
      } else {
        const before = JSON.stringify(progress[item.id]);
        const next = { ...seeded, ...progress[item.id], learned: learnedHit };
        if (learnedHit) lockLearnedRecord(next);
        progress[item.id] = next;
        if (JSON.stringify(next) !== before) changed = true;
      }
    });
    if (changed) saveProgress(progress);
    return progress;
  }

  function recordQuizResult(question, isCorrect) {
    const progress = ensureProgressForItems(loadProgress());
    const record = progress[question.itemId] || baseRecord(question.item || { id: question.itemId, type: "unknown", label: question.title || question.itemId });
    const now = new Date();
    const weight = questionWeight(question.type);
    record.seenCount = (record.seenCount || 0) + 1;
    record.askedCount = (record.askedCount || 0) + 1;
    record.lastAskedAt = now.toISOString();
    record.lastQuestionType = question.type;
    record.recentQuestionIds = [question.id, ...(record.recentQuestionIds || []).filter((id) => id !== question.id)].slice(0, 8);
    if (isCorrect) {
      record.correctCount = (record.correctCount || 0) + 1;
      record.correctStreak = (record.correctStreak || 0) + 1;
      record.wrongStreak = 0;
      record.mastery = clamp((record.mastery || 0) + weight + Math.min(14, record.correctStreak * 5), 0, 100);
      record.nextDueAt = new Date(now.getTime() + dueDays(record.correctStreak) * DAY_MS).toISOString();
    } else {
      record.wrongCount = (record.wrongCount || 0) + 1;
      record.wrongStreak = (record.wrongStreak || 0) + 1;
      record.correctStreak = 0;
      record.mastery = clamp((record.mastery || 0) - Math.max(7, Math.floor(weight * 0.75)), 0, 100);
      record.nextDueAt = new Date(now.getTime() + (record.wrongStreak >= 2 ? 0 : 4 * 60 * 60 * 1000)).toISOString();
    }
    progress[record.id] = record;
    saveProgress(progress);
    return record;
  }

  function questionWeight(type) {
    return { multiple_choice: 18, fill_blank: 22, ja_to_zh: 20, zh_to_ja: 26, listening: 22, recording: 30 }[type] || 8;
  }

  function dueDays(streak) {
    if (streak >= 4) return 10;
    if (streak >= 3) return 5;
    if (streak >= 2) return 2;
    return 1;
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function getSummary() {
    const progress = ensureProgressForItems(loadProgress());
    const records = Object.values(progress);
    const answered = records.reduce((sum, item) => sum + (item.askedCount || 0), 0);
    const mastered = records.filter((item) => (item.mastery || 0) >= MASTERED_THRESHOLD || item.learned).length;
    const reviewing = records.filter((item) => !item.learned && ((item.wrongStreak || 0) > 0 || isDue(item))).length;
    const average = records.length ? Math.round(records.reduce((sum, item) => sum + (item.mastery || 0), 0) / records.length) : 0;
    return { progress, records, answered, mastered, reviewing, average };
  }

  function isDue(record) {
    if (!record.nextDueAt) return true;
    return new Date(record.nextDueAt).getTime() <= Date.now();
  }

  function masteryState(record) {
    if (record.learned) return "已學會";
    if ((record.wrongStreak || 0) >= 2) return "需要回來練";
    if ((record.mastery || 0) >= 80) return "很穩";
    if ((record.mastery || 0) >= MASTERED_THRESHOLD) return "熟悉";
    if ((record.mastery || 0) >= 30) return "練習中";
    return "剛開始";
  }

  function renderLearningMap() {
    const shell = document.querySelector("#learning-map-shell");
    if (!shell) return;
    const body = shell.querySelector("#learning-map-body");
    if (!body) return;
    const summary = getSummary();
    const groups = groupByCategory(summary.records);
    body.innerHTML = "";
    body.append(renderOverview(summary));
    Object.entries(groups).forEach(([categoryId, records]) => body.append(renderCategory(categoryId, records)));
  }

  function renderOverview(summary) {
    const panel = document.createElement("section");
    panel.className = "learning-overview";
    panel.innerHTML = `<div><span class="section-kicker">你的語言地圖</span><h2>已掌握 ${summary.mastered} 個重點</h2><p>平均熟練度 ${summary.average}%，已完成 ${summary.answered} 次作答。</p></div><div class="map-stat-grid"><div><strong>${summary.mastered}</strong><span>已掌握</span></div><div><strong>${summary.reviewing}</strong><span>待複習</span></div><div><strong>${summary.records.length}</strong><span>地圖節點</span></div></div>`;
    return panel;
  }

  function renderCategory(categoryId, records) {
    const section = document.createElement("section");
    section.className = "learning-map-section";
    const sorted = [...records].sort((a, b) => (b.mastery || 0) - (a.mastery || 0));
    const known = sorted.filter((item) => (item.mastery || 0) >= MASTERED_THRESHOLD || item.learned).length;
    section.innerHTML = `<div class="learning-section-head"><div><h3>${CATEGORY_LABELS[categoryId] || categoryId}</h3><p>${known} / ${sorted.length} 個已經進入熟悉區。</p></div></div>`;
    const list = document.createElement("div");
    list.className = "learning-node-list";
    sorted.slice(0, 10).forEach((record) => list.append(renderNode(record)));
    section.append(list);
    return section;
  }

  function renderNode(record) {
    const row = document.createElement("article");
    row.className = "learning-node";
    const mastery = Math.round(record.mastery || 0);
    row.innerHTML = `<div><h4>${record.label}</h4><p>${record.zh || CATEGORY_LABELS[record.categoryId] || ""}</p></div><div class="learning-meter" aria-label="熟練度 ${mastery}%"><span style="width:${mastery}%"></span></div><strong>${masteryState(record)}</strong>`;
    return row;
  }

  function groupByCategory(records) {
    return records.reduce((groups, record) => {
      const key = record.categoryId || "object";
      if (!groups[key]) groups[key] = [];
      groups[key].push(record);
      return groups;
    }, {});
  }

  window.KotohaProgress = { PROGRESS_KEY, PATTERNS, CATEGORY_LABELS, loadProgress, saveProgress, loadLearned, getKnowledgeItems, ensureProgressForItems, recordQuizResult, getSummary, isItemLearned, masteryState, isDue, renderLearningMap };
  window.addEventListener("kotoha-progress-changed", renderLearningMap);
  window.addEventListener("kotoha-learned-changed", () => { ensureProgressForItems(); renderLearningMap(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderLearningMap);
  else renderLearningMap();
})();
