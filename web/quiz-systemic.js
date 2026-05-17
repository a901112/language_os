(() => {
  const SESSION_KEY = "kotoha-quiz-session-v1";
  const LAST_SESSION_KEY = "kotoha-quiz-last-session-questions-v1";

  clearFreshSession();
  patchQuizStart();
  document.addEventListener?.("DOMContentLoaded", () => {
    clearFreshSession();
    patchQuizStart();
  });

  function patchQuizStart() {
    const api = window.KotohaQuiz;
    if (!api || api.__kotohaSystemicQuiz) return;
    const originalStart = api.startSession.bind(api);
    api.startSession = function systemicStartSession(options = {}) {
      if (!options.forceNew) clearFreshSession();
      return originalStart(options);
    };
    api.__kotohaSystemicQuiz = true;
  }

  function clearFreshSession() {
    const saved = readSession();
    if (!saved?.questions?.length) return;
    if ((saved.currentIndex || 0) === 0) {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    const questionIds = saved.questions.map((question) => question.id);
    const previous = safeJson(localStorage.getItem(LAST_SESSION_KEY), []);
    const overlap = questionIds.filter((id) => previous.includes(id)).length;
    if (overlap >= Math.ceil(questionIds.length * 0.8)) sessionStorage.removeItem(SESSION_KEY);
  }

  function readSession() {
    return safeJson(sessionStorage.getItem(SESSION_KEY), null);
  }

  function safeJson(value, fallback) {
    try {
      return JSON.parse(value || "");
    } catch {
      return fallback;
    }
  }
})();
