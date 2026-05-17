(() => {
  const LEARNED_KEY = "language-os-learned-v1";
  const LEARNED_MASTERY = 100;
  const DAY_MS = 24 * 60 * 60 * 1000;

  if (!window.__kotohaLearnedEventBridge) {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function setItemWithLearnedEvent(key, value) {
      originalSetItem(key, value);
      if (key === LEARNED_KEY) {
        window.dispatchEvent(new CustomEvent("kotoha-learned-changed"));
      }
    };
    window.__kotohaLearnedEventBridge = true;
  }

  function loadLearned() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LEARNED_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function legacyKey(item) {
    if (!item?.rawItem) return "";
    return `ja|${item.rawItem.category || "object"}|${item.rawItem.ja}`.toLowerCase();
  }

  function vocabKey(item) {
    if (item?.rawItem && window.KotohaVocab) return window.KotohaVocab.vocabLearnedKey(item.rawItem, "ja");
    return "";
  }

  function lockLearnedRecord(record) {
    record.learned = true;
    record.mastery = LEARNED_MASTERY;
    record.wrongStreak = 0;
    record.correctStreak = Math.max(record.correctStreak || 0, 3);
    record.nextDueAt = new Date(Date.now() + 365 * DAY_MS).toISOString();
  }

  function patchProgress() {
    const api = window.KotohaProgress;
    if (!api || api.__kotohaV5Tuned) return;

    const originalEnsure = api.ensureProgressForItems.bind(api);
    const originalRecordQuizResult = api.recordQuizResult.bind(api);
    const originalGetKnowledgeItems = api.getKnowledgeItems.bind(api);

    api.isItemLearned = function isItemLearned(item, learned = loadLearned()) {
      return Boolean(learned[vocabKey(item)] || learned[legacyKey(item)]);
    };

    api.ensureProgressForItems = function tunedEnsureProgressForItems(progress) {
      const result = originalEnsure(progress);
      const learned = loadLearned();
      let changed = false;
      originalGetKnowledgeItems().forEach((item) => {
        if (!api.isItemLearned(item, learned)) return;
        const record = result[item.id];
        if (!record) return;
        const before = JSON.stringify(record);
        lockLearnedRecord(record);
        if (JSON.stringify(record) !== before) changed = true;
      });
      if (changed) api.saveProgress(result);
      return result;
    };

    api.recordQuizResult = function tunedRecordQuizResult(question, isCorrect) {
      const record = originalRecordQuizResult(question, isCorrect);
      if (!isCorrect || !record?.id) return record;
      const progress = api.loadProgress();
      const stored = progress[record.id] || record;
      const streak = Math.max(1, Math.min(stored.correctStreak || 1, 4));
      const floor = [0, 38, 65, 82, 95][streak];
      if ((stored.mastery || 0) < floor) {
        stored.mastery = floor;
        progress[stored.id] = stored;
        api.saveProgress(progress);
        Object.assign(record, stored);
      }
      return record;
    };

    api.getKnowledgeItems = function tunedGetKnowledgeItems() {
      const items = originalGetKnowledgeItems();
      const activeFeature = document.querySelector("#home")?.dataset.feature;
      if (activeFeature !== "quiz") return items;
      return items.filter((item) => !api.isItemLearned(item));
    };

    window.addEventListener("kotoha-learned-changed", () => {
      api.ensureProgressForItems(api.loadProgress());
    });
    api.__kotohaV5Tuned = true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", patchProgress);
  } else {
    patchProgress();
  }
})();
