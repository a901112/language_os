(() => {
  const graph = {
    animal: {
      id: "animal",
      labelZh: "動物",
      labelJa: "動物",
      sectionTitle: "可以一起學的動物",
      completedText: "常見動物你已經很熟了。",
      defaultDisplayLimit: 5,
      items: [
        { id: "animal_cat", zh: "貓", ja: "猫", reading: "ねこ", rank: 1, category: "object" },
        { id: "animal_dog", zh: "狗", ja: "犬", reading: "いぬ", rank: 2, category: "object" },
        { id: "animal_rabbit", zh: "兔子", ja: "うさぎ", reading: "うさぎ", rank: 3, category: "object" },
        { id: "animal_bird", zh: "鳥", ja: "鳥", reading: "とり", rank: 4, category: "object" },
        { id: "animal_fish", zh: "魚", ja: "魚", reading: "さかな", rank: 5, category: "object" },
        { id: "animal_hamster", zh: "倉鼠", ja: "ハムスター", reading: "はむすたー", rank: 6, category: "object" },
        { id: "animal_horse", zh: "馬", ja: "馬", reading: "うま", rank: 7, category: "object" },
        { id: "animal_cow", zh: "牛", ja: "牛", reading: "うし", rank: 8, category: "object" },
        { id: "animal_pig", zh: "豬", ja: "豚", reading: "ぶた", rank: 9, category: "object" },
        { id: "animal_sheep", zh: "羊", ja: "羊", reading: "ひつじ", rank: 10, category: "object" },
        { id: "animal_monkey", zh: "猴子", ja: "猿", reading: "さる", rank: 11, category: "object" },
        { id: "animal_bear", zh: "熊", ja: "熊", reading: "くま", rank: 12, category: "object" },
        { id: "animal_deer", zh: "鹿", ja: "鹿", reading: "しか", rank: 13, category: "object" },
      ],
    },
    time: {
      id: "time",
      labelZh: "時間",
      labelJa: "時間",
      sectionTitle: "可以一起學的時間詞",
      completedText: "常見時間詞你已經很熟了。",
      defaultDisplayLimit: 5,
      items: [
        { id: "time_today", zh: "今天", ja: "今日", reading: "きょう", rank: 1, category: "time" },
        { id: "time_tomorrow", zh: "明天", ja: "明日", reading: "あした", rank: 2, category: "time" },
        { id: "time_day_after_tomorrow", zh: "後天", ja: "明後日", reading: "あさって", rank: 3, category: "time" },
        { id: "time_yesterday", zh: "昨天", ja: "昨日", reading: "きのう", rank: 4, category: "time" },
        { id: "time_this_year", zh: "今年", ja: "今年", reading: "ことし", rank: 5, category: "time" },
        { id: "time_next_week", zh: "下週", ja: "来週", reading: "らいしゅう", rank: 6, category: "time" },
      ],
    },
    food: {
      id: "food",
      labelZh: "食物",
      labelJa: "食べ物",
      sectionTitle: "可以一起學的食物",
      completedText: "常見食物詞你已經很熟了。",
      defaultDisplayLimit: 5,
      items: [
        { id: "food_rice", zh: "飯", ja: "ご飯", reading: "ごはん", rank: 1, category: "object" },
        { id: "food_ramen", zh: "拉麵", ja: "ラーメン", reading: "らーめん", rank: 2, category: "object" },
        { id: "food_sushi", zh: "壽司", ja: "寿司", reading: "すし", rank: 3, category: "object" },
        { id: "food_coffee", zh: "咖啡", ja: "コーヒー", reading: "こーひー", rank: 4, category: "object" },
        { id: "food_water", zh: "水", ja: "水", reading: "みず", rank: 5, category: "object" },
        { id: "food_tea", zh: "茶", ja: "お茶", reading: "おちゃ", rank: 6, category: "object" },
      ],
    },
    place: {
      id: "place",
      labelZh: "地點",
      labelJa: "場所",
      sectionTitle: "可以一起學的地點",
      completedText: "常見地點詞你已經很熟了。",
      defaultDisplayLimit: 5,
      items: [
        { id: "place_station", zh: "車站", ja: "駅", reading: "えき", rank: 1, category: "place" },
        { id: "place_restaurant", zh: "餐廳", ja: "レストラン", reading: "れすとらん", rank: 2, category: "place" },
        { id: "place_hotel", zh: "飯店", ja: "ホテル", reading: "ほてる", rank: 3, category: "place" },
        { id: "place_convenience_store", zh: "便利商店", ja: "コンビニ", reading: "こんびに", rank: 4, category: "place" },
        { id: "place_ski_resort", zh: "滑雪場", ja: "スキー場", reading: "すきーじょう", rank: 5, category: "place" },
        { id: "place_airport", zh: "機場", ja: "空港", reading: "くうこう", rank: 6, category: "place" },
      ],
    },
    rental: {
      id: "rental",
      labelZh: "租借",
      labelJa: "レンタル",
      sectionTitle: "租借時常用的物品",
      completedText: "常見租借詞你已經很熟了。",
      defaultDisplayLimit: 5,
      items: [
        { id: "rental_snowboard", zh: "滑雪板", ja: "スノーボード", reading: "すのーぼーど", rank: 1, category: "object" },
        { id: "rental_boots", zh: "靴子", ja: "ブーツ", reading: "ぶーつ", rank: 2, category: "object" },
        { id: "rental_wear", zh: "雪衣", ja: "ウェア", reading: "うぇあ", rank: 3, category: "object" },
        { id: "rental_helmet", zh: "安全帽", ja: "ヘルメット", reading: "へるめっと", rank: 4, category: "object" },
        { id: "rental_goggles", zh: "雪鏡", ja: "ゴーグル", reading: "ごーぐる", rank: 5, category: "object" },
      ],
    },
  };

  const normalizeTerm = (value) => String(value || "").trim().toLocaleLowerCase().replace(/[\s，。！？、,.!?「」『』（）()]/g, "");

  function getCategory(categoryId) {
    return graph[categoryId] || null;
  }

  function vocabLearnedKey(item, mode = "ja") {
    return `vocab|${mode === "en" ? "en" : "ja"}|${item.id}`.toLowerCase();
  }

  function legacyLearnedKey(item, mode = "ja") {
    const term = mode === "en" ? item.en || item.zh : item.ja;
    return [mode === "en" ? "en" : "ja", item.category || "object", term].join("|").toLowerCase();
  }

  function isVocabItemLearned(item, learned = {}, mode = "ja") {
    if (!item || !item.id) return false;
    return Boolean(learned[vocabLearnedKey(item, mode)] || learned[legacyLearnedKey(item, mode)]);
  }

  function isExcluded(item, excludeTerms = []) {
    if (!excludeTerms.length) return false;
    const own = [item.id, item.zh, item.ja, item.reading].map(normalizeTerm).filter(Boolean);
    return excludeTerms.map(normalizeTerm).filter(Boolean).some((term) => own.includes(term));
  }

  function getExpansionItems(categoryId, learned = {}, options = {}) {
    const category = getCategory(categoryId);
    if (!category) return { category: null, items: [], completed: true };
    const limit = Number(options.limit || category.defaultDisplayLimit || 5);
    const excludeTerms = Array.isArray(options.excludeTerms) ? options.excludeTerms : [];
    const mode = options.mode === "en" ? "en" : "ja";
    const items = [...category.items]
      .sort((a, b) => Number(a.rank || 999) - Number(b.rank || 999))
      .filter((item) => !isVocabItemLearned(item, learned, mode))
      .filter((item) => !isExcluded(item, excludeTerms))
      .slice(0, limit);
    return { category, items, completed: items.length === 0 };
  }

  function toCard(item, mode = "ja", categoryId = "") {
    return {
      source: "vocabularyGraph",
      mode: mode === "en" ? "en" : "ja",
      vocabId: item.id,
      graphCategoryId: categoryId,
      term: mode === "en" ? item.en || item.zh : item.ja,
      reading: item.reading || "",
      meaning: item.zh || "",
      note: item.zh || "",
      category: item.category || "object",
      difficulty: 1,
      rawItem: item,
    };
  }

  window.KOTOHA_VOCABULARY_GRAPH = graph;
  window.KotohaVocab = { getCategory, getExpansionItems, vocabLearnedKey, isVocabItemLearned, toCard };
})();
