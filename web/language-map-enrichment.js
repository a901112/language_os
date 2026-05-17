(() => {
  if (window.__kotohaLanguageMapEnrichmentLoaded) return;
  window.__kotohaLanguageMapEnrichmentLoaded = true;

  const EXTRA_GRAPH = {
    travel: {
      id: "travel",
      labelZh: "旅行",
      labelJa: "旅行",
      sectionTitle: "旅行時常用的詞",
      completedText: "常見旅行詞你已經很熟了。",
      defaultDisplayLimit: 5,
      items: [
        { id: "travel_train", zh: "電車", ja: "電車", reading: "でんしゃ", rank: 1, category: "object" },
        { id: "travel_bus", zh: "公車", ja: "バス", reading: "ばす", rank: 2, category: "object" },
        { id: "travel_taxi", zh: "計程車", ja: "タクシー", reading: "たくしー", rank: 3, category: "object" },
        { id: "travel_ticket", zh: "票", ja: "切符", reading: "きっぷ", rank: 4, category: "object" },
        { id: "travel_map", zh: "地圖", ja: "地図", reading: "ちず", rank: 5, category: "object" },
        { id: "travel_reservation", zh: "預約", ja: "予約", reading: "よやく", rank: 6, category: "object" },
      ],
    },
    shopping: {
      id: "shopping",
      labelZh: "購物",
      labelJa: "買い物",
      sectionTitle: "買東西時常用的詞",
      completedText: "常見購物詞你已經很熟了。",
      defaultDisplayLimit: 5,
      items: [
        { id: "shopping_price", zh: "價格", ja: "値段", reading: "ねだん", rank: 1, category: "object" },
        { id: "shopping_cash", zh: "現金", ja: "現金", reading: "げんきん", rank: 2, category: "object" },
        { id: "shopping_card", zh: "信用卡", ja: "カード", reading: "かーど", rank: 3, category: "object" },
        { id: "shopping_bag", zh: "袋子", ja: "袋", reading: "ふくろ", rank: 4, category: "object" },
        { id: "shopping_receipt", zh: "收據", ja: "レシート", reading: "れしーと", rank: 5, category: "object" },
        { id: "shopping_register", zh: "收銀台", ja: "レジ", reading: "れじ", rank: 6, category: "place" },
      ],
    },
    object: {
      id: "object",
      labelZh: "常用物品",
      labelJa: "物",
      sectionTitle: "可以一起學的常用物品",
      completedText: "常見物品詞你已經很熟了。",
      defaultDisplayLimit: 5,
      items: [
        { id: "object_phone", zh: "手機", ja: "スマホ", reading: "すまほ", rank: 1, category: "object" },
        { id: "object_bag", zh: "包包", ja: "かばん", reading: "かばん", rank: 2, category: "object" },
        { id: "object_umbrella", zh: "傘", ja: "傘", reading: "かさ", rank: 3, category: "object" },
        { id: "object_key", zh: "鑰匙", ja: "鍵", reading: "かぎ", rank: 4, category: "object" },
        { id: "object_ticket", zh: "票", ja: "チケット", reading: "ちけっと", rank: 5, category: "object" },
        { id: "object_passport", zh: "護照", ja: "パスポート", reading: "ぱすぽーと", rank: 6, category: "object" },
      ],
    },
    action: {
      id: "action",
      labelZh: "動作",
      labelJa: "動作",
      sectionTitle: "可以一起學的動作",
      completedText: "常見動作詞你已經很熟了。",
      defaultDisplayLimit: 5,
      items: [
        { id: "action_go", zh: "去", ja: "行く", reading: "いく", rank: 1, category: "action" },
        { id: "action_eat", zh: "吃", ja: "食べる", reading: "たべる", rank: 2, category: "action" },
        { id: "action_drink", zh: "喝", ja: "飲む", reading: "のむ", rank: 3, category: "action" },
        { id: "action_buy", zh: "買", ja: "買う", reading: "かう", rank: 4, category: "action" },
        { id: "action_see", zh: "看", ja: "見る", reading: "みる", rank: 5, category: "action" },
        { id: "action_speak", zh: "說", ja: "話す", reading: "はなす", rank: 6, category: "action" },
        { id: "action_use", zh: "使用", ja: "使う", reading: "つかう", rank: 7, category: "action" },
      ],
    },
  };

  const CATEGORY_LABELS = {
    animal: "動物",
    time: "時間",
    food: "食物",
    place: "地點",
    travel: "旅行",
    shopping: "購物",
    rental: "租借",
    object: "常用物品",
    action: "動作",
  };

  const CATEGORY_RULES = [
    { id: "animal", terms: ["貓", "猫", "ねこ", "狗", "犬", "いぬ", "兔", "うさぎ", "鳥", "とり", "魚", "さかな", "動物"] },
    { id: "food", terms: ["飯", "ご飯", "拉麵", "ラーメン", "壽司", "寿司", "すし", "咖啡", "コーヒー", "水", "お茶", "食べ", "吃", "喝", "飲む", "お腹", "飽", "餓"] },
    { id: "time", terms: ["今天", "今日", "きょう", "明天", "明日", "あした", "後天", "明後日", "昨天", "昨日", "今年", "来週", "下週", "時間"] },
    { id: "place", terms: ["車站", "駅", "えき", "餐廳", "レストラン", "飯店", "ホテル", "便利商店", "コンビニ", "機場", "空港", "滑雪場", "スキー場", "哪裡", "どこ"] },
    { id: "rental", terms: ["租", "租借", "租板", "借り", "レンタル", "スノーボード", "ボード", "ブーツ", "ウェア", "ヘルメット", "ゴーグル"] },
    { id: "shopping", terms: ["買", "買う", "買い物", "購物", "多少錢", "いくら", "價格", "値段", "現金", "カード", "信用卡", "レジ", "袋"] },
    { id: "travel", terms: ["旅行", "旅遊", "去", "行く", "行きたい", "電車", "バス", "タクシー", "計程車", "切符", "票", "地図", "予約", "空港", "ホテル"] },
    { id: "action", terms: ["去", "行く", "吃", "食べる", "喝", "飲む", "買", "買う", "看", "見る", "說", "話す", "用", "使う", "做", "する", "想"] },
    { id: "object", terms: ["手機", "スマホ", "包包", "かばん", "傘", "鍵", "チケット", "護照", "パスポート", "票", "水"] },
  ];

  const PATTERN_RULES = [
    { id: "ga_suki_desu", label: "〜が好きです", meaning: "表示「喜歡～」。", example: "猫が好きです。", terms: ["喜歡", "喜欢", "好き", "like"] },
    { id: "want_to_rent", label: "〜をレンタルしたいです", meaning: "表示「想租～」。", example: "スノーボードをレンタルしたいです。", terms: ["想租", "租", "租借", "借りたい", "レンタルしたい"] },
    { id: "want_to_go", label: "〜に行きたいです", meaning: "表示「想去～」。", example: "駅に行きたいです。", terms: ["想去", "想要去", "去", "行きたい", "行く"] },
    { id: "wa_doko_desu", label: "〜はどこですか", meaning: "詢問某個地方或東西在哪裡。", example: "駅はどこですか。", terms: ["在哪", "在哪裡", "哪裡", "哪里", "どこ", "where"] },
    { id: "price_ikura_desu", label: "〜はいくらですか", meaning: "詢問價格。", example: "これはいくらですか。", terms: ["多少錢", "多少钱", "價格", "値段", "いくら", "how much"] },
    { id: "object_wo_kudasai", label: "〜をください", meaning: "表示「請給我～」。", example: "水をください。", terms: ["請給", "给我", "給我", "我要", "ください", "お願いします"] },
    { id: "time_kara_made", label: "〜から〜まで", meaning: "表示「從～到～」。", example: "今日から明日までです。", terms: ["從", "到", "から", "まで", "from", "until"] },
    { id: "i_adjective_desu", label: "い形容詞 + です", meaning: "描述狀態或感受。", example: "おいしいです。", terms: ["好吃", "おいしい", "かわいい", "可愛", "高い", "安い", "大きい", "小さい", "難しい", "つらい", "辛苦"] },
    { id: "na_adjective_desu", label: "な形容詞 + です", meaning: "描述性質或狀態。", example: "便利です。", terms: ["漂亮", "きれい", "便利", "元気", "靜か", "静か", "簡單", "簡単"] },
    { id: "past_mashita", label: "〜ました", meaning: "表示過去做過的事。", example: "ラーメンを食べました。", terms: ["吃了", "去了", "買了", "看了", "食べました", "行きました", "買いました", "見ました"] },
  ];

  const GRAMMAR_NOTES = {
    ga_suki_desu: { title: "〜が好きです", short: "表示「喜歡～」。日文裡喜歡的對象通常用 が。", example: "猫が好きです。" },
    want_to_rent: { title: "〜たい", short: "表示「想做某事」。レンタルしたい 就是「想租」。", example: "ブーツをレンタルしたいです。" },
    want_to_go: { title: "〜に行きたいです", short: "表示「想去某地」。地點前面常用 に。", example: "駅に行きたいです。" },
    wa_doko_desu: { title: "〜はどこですか", short: "用來問位置。「〜は」先提出你要問的東西。", example: "ホテルはどこですか。" },
    price_ikura_desu: { title: "いくらですか", short: "詢問價格時很常用，前面可放 これ 或 この〜。", example: "これはいくらですか。" },
    object_wo_kudasai: { title: "〜をください", short: "表示「請給我～」。點餐或購物時很常用。", example: "水をください。" },
    time_kara_made: { title: "〜から〜まで", short: "から 表示起點，まで 表示終點。", example: "今日から明日までです。" },
    i_adjective_desu: { title: "い形容詞 + です", short: "い形容詞可以直接接 です，語氣比較完整。", example: "おいしいです。" },
    na_adjective_desu: { title: "な形容詞 + です", short: "な形容詞接名詞用 な，句尾可直接用 です。", example: "便利です。" },
    past_mashita: { title: "〜ました", short: "表示過去做過的事，比 〜た 更禮貌一點。", example: "ラーメンを食べました。" },
  };

  extendVocabularyGraph();
  patchAnalyzeFetch();

  function extendVocabularyGraph() {
    const graph = window.KOTOHA_VOCABULARY_GRAPH;
    if (!graph) return;
    Object.entries(EXTRA_GRAPH).forEach(([id, category]) => {
      if (!graph[id]) graph[id] = category;
    });
  }

  function patchAnalyzeFetch() {
    if (window.__kotohaAnalyzeFetchEnriched || typeof window.fetch !== "function") return;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const response = await originalFetch(input, init);
      if (!isAnalyzeRequest(input) || !response.ok) return response;
      try {
        const requestText = analyzeRequestText(init);
        const data = await response.clone().json();
        const enriched = enrichLanguageMap(data, requestText);
        if (enriched === data) return response;
        const headers = new Headers(response.headers);
        headers.set("Content-Type", "application/json; charset=utf-8");
        return new Response(JSON.stringify(enriched), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (error) {
        console.warn("Language map enrichment skipped.", error);
        return response;
      }
    };
    window.__kotohaAnalyzeFetchEnriched = true;
  }

  function isAnalyzeRequest(input) {
    const url = typeof input === "string" ? input : input?.url || "";
    return /\/api\/analyze(?:$|[?#])/.test(url);
  }

  function analyzeRequestText(init) {
    try {
      const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
      return String(body.text || "");
    } catch {
      return "";
    }
  }

  function enrichLanguageMap(result, requestText = "") {
    if (!result || Number(result.version || 0) < 3 || !result.sentence || !Array.isArray(result.coreItems)) return result;
    const clone = JSON.parse(JSON.stringify(result));
    const context = buildContext(clone, requestText);
    const categories = [...cleanArray(clone.detectedCategories), ...inferCategories(clone, context)];
    const patterns = [...cleanArray(clone.detectedPatterns), ...inferPatterns(context)];
    clone.detectedCategories = uniqueBy(categories.filter((item) => item.id), "id").slice(0, 5);
    clone.detectedPatterns = uniqueBy(patterns.filter((item) => item.id), "id").slice(0, 3);
    clone.grammarNotes = uniqueBy([...cleanArray(clone.grammarNotes), ...grammarNotesForPatterns(clone.detectedPatterns)], "title").slice(0, 4);
    return clone;
  }

  function buildContext(result, requestText) {
    const sentence = result.sentence || {};
    const pieces = [
      requestText,
      sentence.target,
      sentence.source,
      sentence.literal,
      ...cleanArray(result.coreItems).flatMap((item) => [item.term, item.reading, item.meaning, item.sourceText]),
      ...cleanArray(result.cards).flatMap((item) => [item.term, item.reading, item.meaning, item.note]),
    ].filter(Boolean);
    const text = pieces.join(" ");
    return { text, normalized: normalize(text) };
  }

  function inferCategories(result, context) {
    const inferred = [];
    CATEGORY_RULES.forEach((rule) => {
      const sourceTerm = firstMatch(context.normalized, rule.terms);
      if (sourceTerm) inferred.push(category(rule.id, sourceTerm, 0.68));
    });
    inferred.push(...inferCategoriesFromGraph(context));

    const specificIds = new Set(inferred.map((item) => item.id).filter((id) => !["object", "action"].includes(id)));
    cleanArray(result.coreItems).forEach((item) => {
      if (item.category === "time") inferred.push(category("time", item.term, 0.62));
      if (item.category === "place") inferred.push(category("place", item.term, 0.62));
      if (item.category === "action") inferred.push(category("action", item.term, 0.58));
      if (item.category === "object" && !specificIds.size) inferred.push(category("object", item.term, 0.52));
    });
    return uniqueBy(inferred, "id");
  }

  function inferCategoriesFromGraph(context) {
    const graph = window.KOTOHA_VOCABULARY_GRAPH || {};
    return Object.values(graph)
      .map((graphCategory) => {
        const match = cleanArray(graphCategory.items).find((item) => [item.zh, item.ja, item.reading].some((term) => includes(context.normalized, term)));
        return match ? category(graphCategory.id, match.ja || match.zh, 0.72) : null;
      })
      .filter(Boolean);
  }

  function inferPatterns(context) {
    return PATTERN_RULES.filter((rule) => firstMatch(context.normalized, rule.terms)).map((rule) => ({
      id: rule.id,
      label: rule.label,
      meaning: rule.meaning,
      example: rule.example,
    }));
  }

  function grammarNotesForPatterns(patterns) {
    return cleanArray(patterns)
      .map((pattern) => {
        const note = GRAMMAR_NOTES[pattern.id];
        if (!note) return null;
        return {
          patternId: pattern.id,
          title: note.title,
          short: note.short,
          example: pattern.example || note.example,
          level: "beginner",
        };
      })
      .filter(Boolean);
  }

  function category(id, sourceTerm = "", confidence = 0.6) {
    return {
      id,
      label: window.KotohaVocab?.getCategory?.(id)?.labelZh || CATEGORY_LABELS[id] || id,
      sourceTerm,
      confidence,
    };
  }

  function firstMatch(normalizedText, terms) {
    return terms.find((term) => includes(normalizedText, term)) || "";
  }

  function includes(normalizedText, term) {
    const normalizedTerm = normalize(term);
    return Boolean(normalizedText && normalizedTerm && normalizedText.includes(normalizedTerm));
  }

  function normalize(value) {
    return String(value || "").toLocaleLowerCase().replace(/[\s，。！？、,.!?「」『』（）()・]/g, "");
  }

  function cleanArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function uniqueBy(items, key) {
    const seen = new Set();
    return items.filter((item) => {
      const value = item?.[key];
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }
})();
