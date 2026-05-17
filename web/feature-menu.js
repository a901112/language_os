(() => {
  const KOTOHA_ACTIVE_FEATURE_KEY = "kotoha-active-feature";

  const openButton = document.querySelector("#feature-menu-open");
  const closeButton = document.querySelector("#feature-menu-close");
  const drawer = document.querySelector("#feature-drawer");
  const backdrop = document.querySelector("#feature-backdrop");
  const navItems = [...document.querySelectorAll(".feature-nav-item")];
  const home = document.querySelector("#home");
  const brand = document.querySelector(".brand");
  const mapForm = document.querySelector("#lesson-form");
  const game = document.querySelector("#game");
  const coachShell = document.querySelector("#coach-shell");
  const quizShell = document.querySelector("#quiz-shell");
  const learningMapShell = document.querySelector("#learning-map-shell");
  const learnedPanel = document.querySelector("#learned-panel");
  const sentenceInput = document.querySelector("#sentence-input");
  const coachInput = document.querySelector("#coach-input");

  if (!openButton || !drawer || !backdrop || !home || !coachShell) return;

  const hashFeature = location.hash ? location.hash.replace("#", "") : "";
  let activeFeature = ["map", "coach", "quiz", "learning-map"].includes(hashFeature)
    ? hashFeature
    : localStorage.getItem(KOTOHA_ACTIVE_FEATURE_KEY) || "map";
  if (!["map", "coach", "quiz", "learning-map"].includes(activeFeature)) activeFeature = "map";
  if (!hashFeature && activeFeature !== "coach") activeFeature = "map";

  openButton.addEventListener("click", openDrawer);
  closeButton?.addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDrawer();
  });

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const feature = item.dataset.feature;
      if (feature === "learned") {
        setFeature("map");
        openLearnedPanel(false);
      } else if (feature === "about") {
        setFeature("map");
        openLearnedPanel(true);
      } else {
        setFeature(feature || "map");
      }
      closeDrawer();
    });
  });

  setFeature(activeFeature, { focus: false });

  function openDrawer() {
    drawer.hidden = false;
    backdrop.hidden = false;
    openButton.setAttribute("aria-expanded", "true");
    window.setTimeout(() => drawer.classList.add("open"), 0);
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    drawer.hidden = true;
    backdrop.hidden = true;
    openButton.setAttribute("aria-expanded", "false");
  }

  function setFeature(feature, options = {}) {
    activeFeature = ["map", "coach", "quiz", "learning-map"].includes(feature) ? feature : "map";
    localStorage.setItem(KOTOHA_ACTIVE_FEATURE_KEY, activeFeature);
    home.dataset.feature = activeFeature;

    const showMap = activeFeature === "map";
    const showCoach = activeFeature === "coach";
    const showQuiz = activeFeature === "quiz";
    const showLearningMap = activeFeature === "learning-map";
    [brand, mapForm, game].forEach((node) => {
      if (node) node.hidden = !showMap;
    });
    if (coachShell) coachShell.hidden = !showCoach;
    if (quizShell) quizShell.hidden = !showQuiz;
    if (learningMapShell) learningMapShell.hidden = !showLearningMap;
    navItems.forEach((item) => item.classList.toggle("active", item.dataset.feature === activeFeature));

    if (showMap) {
      window.KotohaCoach?.renderCoachHistory?.();
      if (sentenceInput) {
        sentenceInput.disabled = false;
        sentenceInput.readOnly = false;
        sentenceInput.removeAttribute("disabled");
        sentenceInput.removeAttribute("readonly");
      }
      if (options.focus !== false) sentenceInput?.focus();
    } else if (showCoach) {
      learnedPanel.hidden = true;
      window.KotohaCoach?.renderCoachHistory?.();
      if (options.focus !== false) coachInput?.focus();
    } else if (showQuiz) {
      learnedPanel.hidden = true;
      window.KotohaQuiz?.startSession?.();
    } else if (showLearningMap) {
      learnedPanel.hidden = true;
      window.KotohaProgress?.renderLearningMap?.();
    }
  }

  function openLearnedPanel(scrollToAbout) {
    if (learnedPanel) {
      home.classList.add("started");
      learnedPanel.hidden = false;
      if (typeof window.renderLearnedPanel === "function") window.renderLearnedPanel();
      if (scrollToAbout) {
        learnedPanel.querySelector(".about-kotoha")?.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    }
  }

  window.KotohaFeature = {
    get activeFeature() {
      return activeFeature;
    },
    setFeature,
    openDrawer,
    closeDrawer,
  };
})();
