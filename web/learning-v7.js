(() => {
  const MASTERED_THRESHOLD = 65;
  const LEARNED_MASTERY = 100;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const FILTER_KEY = "kotoha-learning-v7-filter";
  const LABELS = { animal: "動物", time: "時間", food: "食物", place: "地點", rental: "租借", action: "動作", pattern: "句型", object: "物品", travel: "旅行", shopping: "購物", daily: "日常", describe: "描述", grammar: "文法", society: "社會" };

  patchV7Progress();
  document.addEventListener?.("DOMContentLoaded", () => { patchV7Progress(); renderV7Map(); });
  window.addEventListener?.("kotoha-progress-changed", renderV7Map);
  window.addEventListener?.("kotoha-learned-changed", () => { window.KotohaProgress?.ensureProgressForItems?.(); renderV7Map(); });

  function patchV7Progress() {
    const api = window.KotohaProgress;
    if (!api || api.__kotohaV7Learning) return;
    const originalGetKnowledgeItems = api.getKnowledgeItems.bind(api);
    const originalEnsure = api.ensureProgressForItems.bind(api);

    api.getKnowledgeItems = function v7KnowledgeItems() {
      return mergeItems([...originalGetKnowledgeItems(), ...packItems()]);
    };

    api.ensureProgressForItems = function v7EnsureProgress(progress = api.loadProgress()) {
      const result = originalEnsure(progress);
      let changed = false;
      api.getKnowledgeItems().forEach((item) => {
        const existing = result[item.id];
        const learned = api.isItemLearned?.(item) || false;
        if (!existing) {
          result[item.id] = baseRecord(item, learned ? LEARNED_MASTERY : 8);
          result[item.id].learned = learned;
          if (learned) lockLearnedRecord(result[item.id]);
          changed = true;
          return;
        }
        const before = JSON.stringify(pickMeta(existing));
        const base = baseRecord(item, learned ? LEARNED_MASTERY : existing.mastery || 8);
        Object.assign(existing, {
          id: base.id, type: base.type, categoryId: base.categoryId, unitId: base.unitId, unitTitle: base.unitTitle,
          lesson: base.lesson, skill: base.skill, level: base.level, label: base.label, zh: base.zh,
          jlptLevel: base.jlptLevel, pos: base.pos, scenario: base.scenario, scenarioLabel: base.scenarioLabel,
          register: base.register, learned,
        });
        if (learned) lockLearnedRecord(existing);
        if (JSON.stringify(pickMeta(existing)) !== before) changed = true;
      });
      if (changed) api.saveProgress(result);
      return result;
    };

    api.getSummary = getV7Summary;
    api.renderLearningMap = renderV7Map;
    api.CATEGORY_LABELS = { ...(api.CATEGORY_LABELS || {}), ...LABELS };
    api.__kotohaV7Learning = true;
  }

  function packItems() { return window.KotohaCurriculumPacks?.toItems?.() || []; }
  function mergeItems(items) {
    const map = new Map();
    items.filter(Boolean).forEach((item) => {
      const key = itemKey(item);
      const previous = map.get(key);
      map.set(key, normalizeItem(previous ? { ...previous, ...item, rawItem: item.rawItem || previous.rawItem } : item));
    });
    return [...map.values()];
  }
  function normalizeItem(item) {
    const raw = item.rawItem || {};
    const jlptLevel = item.jlptLevel || raw.jlptLevel || inferJlpt(item);
    const scenario = item.scenario || raw.scenario || inferScenario(item);
    return { ...item, jlptLevel, pos: item.pos || raw.pos || inferPos(item), scenario, scenarioLabel: item.scenarioLabel || scenarioLabel(scenario), register: item.register || raw.register || "neutral", level: item.level || ({ N5: 1, N4: 2, N3: 3 }[jlptLevel] || 1), skill: item.skill || (item.type === "pattern" ? "pattern" : "vocabulary") };
  }
  function itemKey(item) { return item.type === "pattern" ? `p|${item.label || item.ja}|${item.promptZh || item.zh || ""}` : `v|${item.ja || item.label}|${item.zh || ""}`; }
  function baseRecord(item, mastery = 8) {
    const n = normalizeItem(item);
    return { id: n.id, type: n.type, categoryId: n.categoryId || "daily", unitId: n.unitId || unitForCategory(n.categoryId), unitTitle: n.unitTitle || unitTitle(n.unitId || unitForCategory(n.categoryId)), lesson: n.lesson || "", skill: n.skill || n.type, level: n.level || 1, label: n.label || n.ja, zh: n.zh || "", jlptLevel: n.jlptLevel, pos: n.pos, scenario: n.scenario, scenarioLabel: n.scenarioLabel, register: n.register, mastery, seenCount: 0, askedCount: 0, correctCount: 0, wrongCount: 0, correctStreak: 0, wrongStreak: 0, lastAskedAt: "", nextDueAt: "", recentQuestionIds: [], lastQuestionType: "" };
  }
  function getV7Summary() {
    const api = window.KotohaProgress;
    const progress = api.ensureProgressForItems(api.loadProgress());
    const records = Object.values(progress).map(normalizeRecord);
    const answered = records.reduce((sum, item) => sum + (item.askedCount || 0), 0);
    const mastered = records.filter(isMastered).length;
    const reviewing = records.filter((item) => !item.learned && ((item.wrongStreak || 0) > 0 || isDue(item))).length;
    const average = records.length ? Math.round(records.reduce((sum, item) => sum + (item.mastery || 0), 0) / records.length) : 0;
    const levelStats = groupStats(records, "jlptLevel", ["N5", "N4", "N3"]);
    const scenarioStats = groupStats(records, "scenario");
    const posStats = groupStats(records, "pos");
    const unitStats = groupByUnit(records);
    const activeUnit = Object.entries(unitStats).find(([, unitRecords]) => unitRecords.some((item) => !isMastered(item)));
    return { progress, records, answered, mastered, reviewing, average, levelStats, scenarioStats, posStats, unitStats, activeUnitId: activeUnit?.[0] || "" };
  }
  function renderV7Map() {
    const body = document.querySelector("#learning-map-body");
    if (!body || !window.KotohaProgress) return;
    const summary = getV7Summary();
    const filtered = filterRecords(summary.records, currentFilter());
    body.innerHTML = "";
    body.append(renderOverview(summary), renderFilterTabs(currentFilter()), renderScopePanel(summary), renderRegisterPanel());
    Object.entries(groupByUnit(filtered)).forEach(([unitId, records]) => body.append(renderUnit(unitId, records)));
  }
  function renderOverview(summary) {
    const targets = window.KOTOHA_CURRICULUM_PACKS?.targets || {};
    const targetCount = Object.values(targets).reduce((sum, target) => sum + (target.vocabulary || 0), 0);
    const panel = document.createElement("section");
    panel.className = "learning-overview v7-overview";
    panel.innerHTML = `<div><span class="section-kicker">V7 系統課綱地圖</span><h2>目前載入 ${summary.records.length} 個學習節點</h2><p>先以可驗證的種子課綱運作；資料模型已按 JLPT、詞性、情境、敬語層級設計，可繼續匯入完整 N4/N3 詞庫。</p><small>參考目標：N5/N4/N3 詞彙池約 ${targetCount.toLocaleString()} 詞；目前先載入核心種子與使用者語言地圖詞彙。</small></div><div class="map-stat-grid"><div><strong>${summary.mastered}</strong><span>已熟悉</span></div><div><strong>${summary.reviewing}</strong><span>待複習</span></div><div><strong>${summary.answered}</strong><span>已作答</span></div></div>`;
    return panel;
  }
  function renderFilterTabs(activeFilter) {
    const filters = [["all", "全部"], ["N5", "N5"], ["N4", "N4"], ["N3", "N3"], ["grammar", "文法"], ["keigo", "敬語/口語"], ["weak", "待複習"]];
    const nav = document.createElement("nav");
    nav.className = "learning-filter-tabs";
    nav.setAttribute("aria-label", "學習地圖篩選");
    filters.forEach(([id, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `learning-filter ${activeFilter === id ? "active" : ""}`;
      button.textContent = label;
      button.addEventListener("click", () => { localStorage.setItem(FILTER_KEY, id); renderV7Map(); });
      nav.append(button);
    });
    return nav;
  }
  function renderScopePanel(summary) {
    const panel = document.createElement("section");
    panel.className = "v7-scope-panel";
    const levelCards = ["N5", "N4", "N3"].map((level) => {
      const target = window.KOTOHA_CURRICULUM_PACKS?.targets?.[level] || {};
      const stats = summary.levelStats[level] || { total: 0, mastered: 0 };
      return `<article class="v7-scope-card"><span>${target.label || level}</span><strong>${stats.mastered} / ${stats.total}</strong><small>目標詞彙池 ${target.vocabulary || "?"}，文法 ${target.grammar || "?"}</small></article>`;
    }).join("");
    const scenarios = Object.entries(summary.scenarioStats).sort((a, b) => b[1].total - a[1].total).slice(0, 6).map(([scenario, stats]) => `<span>${scenarioLabel(scenario)} ${stats.mastered}/${stats.total}</span>`).join("");
    panel.innerHTML = `<div class="v7-scope-grid">${levelCards}</div><div class="v7-scenario-strip">${scenarios}</div>`;
    return panel;
  }
  function renderRegisterPanel() {
    const pairs = window.KOTOHA_CURRICULUM_PACKS?.registerPairs || [];
    const section = document.createElement("section");
    section.className = "learning-map-section v7-register-panel";
    section.innerHTML = `<div class="learning-section-head"><div><h3>敬語 vs 口語</h3><p>同一句話在丁寧語、普通體、口語、尊敬語、謙讓語裡的差異。初學者先把丁寧語說穩，再逐步解鎖。</p></div></div><div class="v7-register-grid">${pairs.slice(0, 4).map((pair) => `<article class="v7-register-card"><strong>${pair.title}</strong><p>${pair.zh}</p><dl><div><dt>丁寧語</dt><dd>${pair.polite || ""}</dd></div><div><dt>普通體</dt><dd>${pair.plain || ""}</dd></div><div><dt>口語</dt><dd>${pair.casual || ""}</dd></div>${pair.honorific ? `<div><dt>尊敬語</dt><dd>${pair.honorific}</dd></div>` : ""}${pair.humble ? `<div><dt>謙讓語</dt><dd>${pair.humble}</dd></div>` : ""}</dl><small>${pair.note}</small></article>`).join("")}</div>`;
    return section;
  }
  function renderUnit(unitId, records) {
    const sorted = [...records].sort((a, b) => (a.level || 1) - (b.level || 1) || (b.wrongStreak || 0) - (a.wrongStreak || 0) || (a.mastery || 0) - (b.mastery || 0));
    const known = sorted.filter(isMastered).length;
    const unit = (window.KOTOHA_CURRICULUM?.units || []).find((item) => item.id === unitId);
    const section = document.createElement("section");
    section.className = "learning-map-section";
    section.innerHTML = `<div class="learning-section-head"><div><h3>${unit?.title || unitTitle(unitId)}</h3><p>${unit?.subtitle || "依照情境、詞性和熟練度逐步練。"} ${known} / ${sorted.length} 個進入熟悉區。</p></div></div>`;
    const list = document.createElement("div");
    list.className = "learning-node-list";
    sorted.slice(0, 36).forEach((record) => list.append(renderNode(record)));
    if (sorted.length > 36) {
      const more = document.createElement("div");
      more.className = "learning-more";
      more.textContent = `還有 ${sorted.length - 36} 個學習點會依測驗進度輪替出現。`;
      list.append(more);
    }
    section.append(list);
    return section;
  }
  function renderNode(record) {
    const row = document.createElement("article");
    row.className = "learning-node";
    const mastery = Math.round(record.mastery || 0);
    row.innerHTML = `<div><h4>${record.label || record.id}</h4><p>${record.zh || LABELS[record.categoryId] || ""}</p><small>${record.jlptLevel || "Core"} · ${posLabel(record.pos)} · ${scenarioLabel(record.scenario)} · ${registerLabel(record.register)}</small></div><div class="learning-meter" aria-label="熟練度 ${mastery}%"><span style="width:${mastery}%"></span></div><strong>${masteryState(record)}</strong>`;
    return row;
  }
  function filterRecords(records, filter) {
    if (filter === "all") return records;
    if (["N5", "N4", "N3"].includes(filter)) return records.filter((record) => record.jlptLevel === filter);
    if (filter === "grammar") return records.filter((record) => record.type === "pattern" || record.categoryId === "grammar" || record.pos === "grammar");
    if (filter === "keigo") return records.filter((record) => ["formal", "polite", "casual"].includes(record.register) || record.scenario === "keigo");
    if (filter === "weak") return records.filter((record) => !record.learned && ((record.wrongStreak || 0) > 0 || isDue(record)));
    return records;
  }
  function currentFilter() { const value = localStorage.getItem(FILTER_KEY) || "all"; return ["all", "N5", "N4", "N3", "grammar", "keigo", "weak"].includes(value) ? value : "all"; }
  function groupStats(records, key, preferred = []) {
    const stats = {};
    records.forEach((record) => { const value = record[key] || "unknown"; if (!stats[value]) stats[value] = { total: 0, mastered: 0, reviewing: 0 }; stats[value].total += 1; if (isMastered(record)) stats[value].mastered += 1; if (!record.learned && ((record.wrongStreak || 0) > 0 || isDue(record))) stats[value].reviewing += 1; });
    preferred.forEach((value) => { if (!stats[value]) stats[value] = { total: 0, mastered: 0, reviewing: 0 }; });
    return stats;
  }
  function groupByUnit(records) {
    const order = Object.fromEntries((window.KOTOHA_CURRICULUM?.units || []).map((unit) => [unit.id, unit.order || 999]));
    const grouped = records.reduce((groups, record) => { const key = record.unitId || unitForCategory(record.categoryId); if (!groups[key]) groups[key] = []; groups[key].push(record); return groups; }, {});
    return Object.fromEntries(Object.entries(grouped).sort(([a], [b]) => (order[a] || 999) - (order[b] || 999)));
  }
  function normalizeRecord(record) { return { ...record, jlptLevel: record.jlptLevel || inferJlpt(record), pos: record.pos || inferPos(record), scenario: record.scenario || inferScenario(record), scenarioLabel: record.scenarioLabel || scenarioLabel(record.scenario || inferScenario(record)), register: record.register || "neutral" }; }
  function pickMeta(record) { return { id: record.id, label: record.label, unitId: record.unitId, jlptLevel: record.jlptLevel, pos: record.pos, scenario: record.scenario, register: record.register, learned: record.learned, mastery: record.mastery }; }
  function isMastered(record) { return record.learned || (record.mastery || 0) >= MASTERED_THRESHOLD; }
  function lockLearnedRecord(record) { record.mastery = LEARNED_MASTERY; record.wrongStreak = 0; record.correctStreak = Math.max(record.correctStreak || 0, 3); record.nextDueAt = new Date(Date.now() + 365 * DAY_MS).toISOString(); }
  function isDue(record) { if (!record.nextDueAt) return true; return new Date(record.nextDueAt).getTime() <= Date.now(); }
  function masteryState(record) { if (record.learned) return "已學會"; if ((record.wrongStreak || 0) >= 2) return "需要回來練"; if ((record.mastery || 0) >= 80) return "很穩"; if ((record.mastery || 0) >= MASTERED_THRESHOLD) return "熟悉"; if ((record.mastery || 0) >= 30) return "練習中"; return "剛開始"; }
  function inferJlpt(item) { if ((item.level || 1) >= 3) return "N3"; if ((item.level || 1) === 2) return "N4"; return "N5"; }
  function inferPos(item) { if (item.type === "pattern" || item.categoryId === "grammar") return "grammar"; if (item.categoryId === "action") return "verb"; if (item.categoryId === "describe") return "adjective"; return "noun"; }
  function inferScenario(item) { if (item.categoryId === "food" || item.categoryId === "shopping") return item.categoryId; if (item.categoryId === "place" || item.categoryId === "travel" || item.categoryId === "rental") return "travel"; if (item.categoryId === "grammar" || item.type === "pattern") return "grammar"; if (item.categoryId === "describe") return "feelings"; return "daily_chat"; }
  function unitForCategory(categoryId) { if (categoryId === "food" || categoryId === "shopping") return "u4_food_shop"; if (categoryId === "place" || categoryId === "travel" || categoryId === "rental") return "u3_travel"; if (categoryId === "describe") return "u5_describe"; if (categoryId === "grammar") return "u6_particles"; return "u1_core"; }
  function unitTitle(unitId) { const unit = (window.KOTOHA_CURRICULUM?.units || []).find((item) => item.id === unitId); return unit?.title || "核心日文"; }
  function scenarioLabel(id) { return window.KOTOHA_CURRICULUM_PACKS?.scenarios?.[id] || { grammar: "文法", daily_chat: "日常聊天", food: "餐飲", travel: "旅行移動", shopping: "購物付款", feelings: "感受想法" }[id] || "一般"; }
  function posLabel(pos) { return { noun: "名詞", verb: "動詞", adjective: "形容詞", adverb: "副詞", particle: "助詞", pronoun: "代名詞", grammar: "文法", register: "語氣" }[pos] || "詞彙"; }
  function registerLabel(register) { return { polite: "丁寧語", formal: "正式", casual: "口語", neutral: "一般" }[register] || "一般"; }

  window.KotohaLearningV7 = { renderV7Map, getV7Summary };
})();
