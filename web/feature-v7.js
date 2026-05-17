(() => {
  const ACTIVE_KEY = "kotoha-active-feature";

  document.addEventListener("DOMContentLoaded", () => {
    restoreMapOnFreshLoad();
    keepMapInputUsable();
  });

  function restoreMapOnFreshLoad() {
    const saved = localStorage.getItem(ACTIVE_KEY);
    const shouldKeep = saved === "coach" || location.hash === "#coach";
    if (shouldKeep) return;
    window.setTimeout(() => {
      window.KotohaFeature?.setFeature?.("map", { focus: false });
      keepMapInputUsable();
    }, 0);
  }

  function keepMapInputUsable() {
    const input = document.querySelector("#sentence-input");
    if (!input) return;
    input.disabled = false;
    input.readOnly = false;
    input.removeAttribute("disabled");
    input.removeAttribute("readonly");
    input.setAttribute("placeholder", "今天你想用日文說什麼？");
    input.setAttribute("aria-label", "今天你想用日文說什麼？");
  }
})();
