(() => {
  const PROGRESS_KEY = "kotoha-learning-progress-v1";
  const MASTERED_THRESHOLD = 65;
  const LEARNED_MASTERY = 100;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const CATEGORY_LABELS = {
    animal: "動物", time: "時間", food: "食物", place: "地點", rental: "租借",
    action: "動作", pattern: "句型", object: "物品", travel: "旅行",
    shopping: "購物", daily: "日常", describe: "描述", grammar: "文法",
  };

  patchProgress();
  window.addEventListener?.("kotoha-progress-changed", renderSystemicMap);
  window.addEventListener?.("kotoha-learned-changed", () => {
    window.KotohaProgress?.ensureProgressForItems?.();
    renderSystemicMap();
  });
  document.addEventListener?.("DOMContentLoaded", () => {
    patchProgress();
    renderSystemicMap();
  });

  function patchProgress() {
    const api = window.KotohaProgress;
    if (!api || api.__kotohaSystemicLearning) return;
    const originalGetKnowledgeItems = api.getKnowledgeItems.bind(api);
    const originalEnsure = api.ensureProgressForItems.bind(api);

    api.getKnowledgeItems = function systemicKnowledgeItems() {
      return uniqueItems([...originalGetKnowledgeItems(), ...curriculumItems()]);
    };

    api.ensureProgressForItems = function systemicEnsureProgress(progress = api.loadProgress()) {
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
        const before = `${existing.unitId}|${existing.level}|${existing.label}|${existing.learned}|${existing.mastery}`;
        const base = baseRecord(item, learned ? LEARNED_MASTERY : existing.mastery || 8);
        Object.assign(existing, {
          id: base.id,
          type: base.type,
          categoryId: base.categoryId,
          unitId: base.unitId,
          unitTitle: base.unitTitle,
          lesson: base.lesson,
          skill: base.skill,
          level: base.level,
          label: base.label,
          zh: base.zh,
          learned,
        });
        if (learned) lockLearnedRecord(existing);
        const after = `${existing.unitId}|${existing.level}|${existing.label}|${existing.learned}|${existing.mastery}`;
        if (before !== after) changed = true;
      });
      if (changed) api.saveProgress(result);
      return result;
    };

    api.getSummary = getSystemicSummary;
    api.renderLearningMap = renderSystemicMap;
    api.CATEGORY_LABELS = { ...(api.CATEGORY_LABELS || {}), ...CATEGORY_LABELS };
    api.__kotohaSystemicLearning = true;
  }

  function curriculumItems() {
    const curriculum = window.KOTOHA_CURRICULUM;
    if (!curriculum || !Array.isArray(curriculum.items)) return [];
    const unitLookup = Object.fromEntries((curriculum.units || []).map((unit) => [unit.id, unit]));
    return curriculum.items.map((item) => ({
      ...item,
      source: "curriculum",
      unitTitle: unitLookup[item.unitId]?.title || unitTitle(item.unitId),
      lesson: item.lesson || unitLookup[item.unitId]?.subtitle || CATEGORY_LABELS[item.categoryId] || "",
      skill: item.skill || (item.type === "pattern" ? "pattern" : "vocabulary"),
    }));
  }

  function getSystemicSummary() {
    const api = window.KotohaProgress;
    const progress = api.ensureProgressForItems(api.loadProgress());
    const records = Object.values(progress);
    const answered = records.reduce((sum, item) => sum + (item.askedCount || 0), 0);
    const mastered = records.filter((item) => item.learned || (item.mastery || 0) >= MASTERED_THRESHOLD).length;
    const reviewing = records.filter((item) => !item.learned && ((item.wrongStreak || 0) > 0 || isDue(item))).length;
    const average = records.length ? Math.round(records.reduce((sum, item) => sum + (item.mastery || 0), 0) / records.length) : 0;
    const units = groupByUnit(records);
    const activeUnit = Object.entries(units).find(([, unitRecords]) => unitRecords.some((item) => !item.learned && (item.mastery || 0) < MASTERED_THRESHOLD));
    return { progress, records, answered, mastered, reviewing, average, units, activeUnitId: activeUnit?.[0] || "" };
  }

  function renderSystemicMap() {
    const body = document.querySelector("#learning-map-body");
    if (!body || !window.KotohaProgress) return;
    const summary = getSystemicSummary();
    body.innerHTML = "";
    body.append(renderOverview(summary));
    Object.entries(summary.units).forEach(([unitId, records]) => body.append(renderUnit(unitId, records)));
  }

  function renderOverview(summary) {
    const panel = document.createElement("section");
    panel.className = "learning-overview";
    const focus = summary.activeUnitId ? `目前焦點：${unitTitle(summary.activeUnitId)}。` : "全部單元都很穩。";
    panel.innerHTML = `
      <div>
        <span class="section-kicker">你的系統學習地圖</span>
        <h2>已掌握 ${summary.mastered} 個學習點</h2>
        <p>平均熟練度 ${summary.average}%，已做過 ${summary.answered} 題。${focus}</p>
      </div>
      <div class="map-stat-grid">
        <div><strong>${summary.mastered}</strong><span>已熟悉</span></div>
        <div><strong>${summary.reviewing}</strong><span>待複習</span></div>
        <div><strong>${summary.records.length}</strong><span>課綱節點</span></div>
      </div>
    `;
    return panel;
  }

  function renderUnit(unitId, records) {
    const section = document.createElement("section");
    section.className = "learning-map-section";
    const sorted = [...records].sort((a, b) => (a.level || 1) - (b.level || 1) || (b.wrongStreak || 0) - (a.wrongStreak || 0) || (a.mastery || 0) - (b.mastery || 0));
    const known = sorted.filter((item) => item.learned || (item.mastery || 0) >= MASTERED_THRESHOLD).length;
    const unit = (window.KOTOHA_CURRICULUM?.units || []).find((item) => item.id === unitId);
    section.innerHTML = `
      <div class="learning-section-head">
        <div>
          <h3>${unit?.title || unitTitle(unitId)}</h3>
          <p>${unit?.subtitle || "從常用句型慢慢累積。"} ${known} / ${sorted.length} 個已經進入熟悉區。</p>
        </div>
      </div>
    `;
    const list = document.createElement("div");
    list.className = "learning-node-list";
    sorted.slice(0, 24).forEach((record) => list.append(renderNode(record)));
    if (sorted.length > 24) {
      const more = document.createElement("div");
      more.className = "learning-more";
      more.textContent = `還有 ${sorted.length - 24} 個學習點會隨測驗進度出現。`;
      list.append(more);
    }
    section.append(list);
    return section;
  }

  function renderNode(record) {
    const row = document.createElement("article");
    row.className = "learning-node";
    const mastery = Math.round(record.mastery || 0);
    row.innerHTML = `
      <div>
        <h4>${record.label || record.id}</h4>
        <p>${record.zh || CATEGORY_LABELS[record.categoryId] || ""}</p>
        <small>${CATEGORY_LABELS[record.categoryId] || record.categoryId || "練習"} · Lv.${record.level || 1}</small>
      </div>
      <div class="learning-meter" aria-label="熟練度 ${mastery}%"><span style="width:${mastery}%"></span></div>
      <strong>${masteryState(record)}</strong>
    `;
    return row;
  }

  function baseRecord(item, mastery = 8) {
    return {
      id: item.id,
      type: item.type,
      categoryId: item.categoryId,
      unitId: item.unitId || unitForCategory(item.categoryId),
      unitTitle: item.unitTitle || unitTitle(item.unitId || unitForCategory(item.categoryId)),
      lesson: item.lesson || "",
      skill: item.skill || item.type,
      level: item.level || 1,
      label: item.label || item.ja,
      zh: item.zh || "",
      mastery,
      seenCount: 0,
      askedCount: 0,
      correctCount: 0,
      wrongCount: 0,
      correctStreak: 0,
      wrongStreak: 0,
      lastAskedAt: "",
      nextDueAt: "",
      recentQuestionIds: [],
      lastQuestionType: "",
    };
  }

  function lockLearnedRecord(record) {
    record.mastery = LEARNED_MASTERY;
    record.wrongStreak = 0;
    record.correctStreak = Math.max(record.correctStreak || 0, 3);
    record.nextDueAt = new Date(Date.now() + 365 * DAY_MS).toISOString();
  }

  function groupByUnit(records) {
    const order = Object.fromEntries((window.KOTOHA_CURRICULUM?.units || []).map((unit) => [unit.id, unit.order || 999]));
    const grouped = records.reduce((groups, record) => {
      const key = record.unitId || unitForCategory(record.categoryId);
      if (!groups[key]) groups[key] = [];
      groups[key].push(record);
      return groups;
    }, {});
    return Object.fromEntries(Object.entries(grouped).sort(([a], [b]) => (order[a] || 999) - (order[b] || 999)));
  }

  function unitForCategory(categoryId) {
    if (categoryId === "food" || categoryId === "shopping") return "u4_food_shop";
    if (categoryId === "place" || categoryId === "travel" || categoryId === "rental") return "u3_travel";
    if (categoryId === "object" || categoryId === "daily") return "u2_daily";
    if (categoryId === "describe") return "u5_describe";
    if (categoryId === "grammar") return "u6_particles";
    return "u1_core";
  }

  function unitTitle(unitId) {
    const unit = (window.KOTOHA_CURRICULUM?.units || []).find((item) => item.id === unitId);
    return unit?.title || "核心日文";
  }

  function masteryState(record) {
    if (record.learned) return "已學會";
    if ((record.wrongStreak || 0) >= 2) return "需要回來練";
    if ((record.mastery || 0) >= 80) return "很穩";
    if ((record.mastery || 0) >= MASTERED_THRESHOLD) return "熟悉";
    if ((record.mastery || 0) >= 30) return "練習中";
    return "剛開始";
  }

  function isDue(record) {
    if (!record.nextDueAt) return true;
    return new Date(record.nextDueAt).getTime() <= Date.now();
  }

  function uniqueItems(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = item.id || `${item.type}|${item.ja}|${item.promptZh || item.zh}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
})();
