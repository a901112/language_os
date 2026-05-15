(() => {
  const objectAction = (objectText) => {
    if (/スノーボード|ボード|ブーツ|ウェア|板/.test(objectText)) return "レンタルしたい";
    if (/切符|チケット|水|ラーメン|券/.test(objectText)) return "買いたい";
    return "使いたい";
  };

  const polishPractice = () => {
    document.querySelectorAll(".practice-card p").forEach((node) => {
      const text = node.textContent || "";
      const match = text.match(/^(.+で)(.+)を行きたいです。$/);
      if (!match) return;
      node.textContent = `${match[1]}${match[2]}を${objectAction(match[2])}です。`;
    });
  };

  const polishRelatedChips = () => {
    document.querySelectorAll(".word-chip").forEach((node) => {
      const meaning = (node.getAttribute("title") || "").trim();
      const current = (node.textContent || "").trim();
      const parts = current.split("・").map((part) => part.trim()).filter(Boolean);
      const term = parts[0];
      if (!term) return;

      if (!meaning || meaning === "播放發音") {
        if (parts.length > 1 && parts[0] === parts[1]) node.textContent = term;
        return;
      }

      if (meaning === term) return;
      node.textContent = `${term}・${meaning}`;
      node.setAttribute("aria-label", `${term}，${meaning}`);
    });
  };

  const polish = () => {
    polishPractice();
    polishRelatedChips();
  };

  polish();
  new MutationObserver(polish).observe(document.body, { childList: true, subtree: true });
})();
