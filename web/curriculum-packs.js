(() => {
  const LEVEL_TARGETS = {
    N5: { vocabulary: 800, grammar: 30, label: "N5 基礎" },
    N4: { vocabulary: 1500, grammar: 80, label: "N4 初中級" },
    N3: { vocabulary: 3750, grammar: 180, label: "N3 中級" },
  };

  const SCENARIOS = {
    self_intro: "自我介紹", daily_chat: "日常聊天", food: "餐飲", travel: "旅行移動", shopping: "購物付款",
    home: "居家生活", school_work: "學校與工作", health: "身體狀態", feelings: "感受想法", society: "社會生活", keigo: "敬語與口語",
  };

  const VOCAB_PACKS = [
    pack("N5", "u1_core", "daily", "pronoun", "self_intro", "polite", [["私","わたし","我"],["あなた","あなた","你"],["彼","かれ","他"],["彼女","かのじょ","她"],["人","ひと","人"],["名前","なまえ","名字"],["国","くに","國家"],["台湾","たいわん","台灣"],["日本","にほん","日本"],["学生","がくせい","學生"],["先生","せんせい","老師"],["友達","ともだち","朋友"]]),
    pack("N5", "u2_daily", "time", "noun", "daily_chat", "neutral", [["今日","きょう","今天"],["明日","あした","明天"],["昨日","きのう","昨天"],["朝","あさ","早上"],["昼","ひる","中午"],["夜","よる","晚上"],["今","いま","現在"],["毎日","まいにち","每天"],["週末","しゅうまつ","週末"],["来週","らいしゅう","下週"],["今年","ことし","今年"],["時間","じかん","時間"]]),
    pack("N5", "u2_daily", "food", "noun", "food", "neutral", [["水","みず","水"],["お茶","おちゃ","茶"],["ご飯","ごはん","飯"],["パン","パン","麵包"],["肉","にく","肉"],["魚","さかな","魚"],["野菜","やさい","蔬菜"],["果物","くだもの","水果"],["牛乳","ぎゅうにゅう","牛奶"],["卵","たまご","蛋"],["ラーメン","ラーメン","拉麵"],["寿司","すし","壽司"]]),
    pack("N5", "u3_travel", "place", "noun", "travel", "neutral", [["駅","えき","車站"],["空港","くうこう","機場"],["学校","がっこう","學校"],["会社","かいしゃ","公司"],["家","いえ","家"],["店","みせ","店"],["病院","びょういん","醫院"],["銀行","ぎんこう","銀行"],["郵便局","ゆうびんきょく","郵局"],["図書館","としょかん","圖書館"],["公園","こうえん","公園"],["トイレ","トイレ","廁所"]]),
    pack("N5", "u1_core", "action", "verb", "daily_chat", "polite", [["行きます","いきます","去"],["来ます","きます","來"],["帰ります","かえります","回去"],["食べます","たべます","吃"],["飲みます","のみます","喝"],["見ます","みます","看"],["聞きます","ききます","聽、問"],["話します","はなします","說"],["買います","かいます","買"],["読みます","よみます","讀"],["書きます","かきます","寫"],["休みます","やすみます","休息"]]),
    pack("N5", "u5_describe", "describe", "adjective", "feelings", "neutral", [["いい","いい","好"],["悪い","わるい","不好"],["大きい","おおきい","大"],["小さい","ちいさい","小"],["新しい","あたらしい","新"],["古い","ふるい","舊"],["高い","たかい","高、貴"],["安い","やすい","便宜"],["楽しい","たのしい","開心"],["忙しい","いそがしい","忙"],["おいしい","おいしい","好吃"],["かわいい","かわいい","可愛"]]),
    pack("N4", "u2_daily", "daily", "noun", "home", "neutral", [["生活","せいかつ","生活"],["料理","りょうり","料理"],["洗濯","せんたく","洗衣"],["掃除","そうじ","打掃"],["部屋","へや","房間"],["台所","だいどころ","廚房"],["玄関","げんかん","玄關"],["近所","きんじょ","附近"],["予定","よてい","預定"],["用事","ようじ","事情、事務"],["約束","やくそく","約定"],["連絡","れんらく","聯絡"]]),
    pack("N4", "u3_travel", "travel", "noun", "travel", "neutral", [["電車","でんしゃ","電車"],["地下鉄","ちかてつ","地下鐵"],["新幹線","しんかんせん","新幹線"],["切符","きっぷ","票"],["乗り換え","のりかえ","轉乘"],["出口","でぐち","出口"],["入口","いりぐち","入口"],["案内","あんない","導覽、帶路"],["地図","ちず","地圖"],["荷物","にもつ","行李"],["予約","よやく","預約"],["受付","うけつけ","櫃台、受理"]]),
    pack("N4", "u4_food_shop", "shopping", "noun", "shopping", "polite", [["値段","ねだん","價格"],["会計","かいけい","結帳"],["現金","げんきん","現金"],["カード","カード","卡片"],["袋","ふくろ","袋子"],["領収書","りょうしゅうしょ","收據"],["割引","わりびき","折扣"],["売り場","うりば","賣場"],["商品","しょうひん","商品"],["店員","てんいん","店員"],["注文","ちゅうもん","點餐、訂購"],["おすすめ","おすすめ","推薦"]]),
    pack("N4", "u1_core", "action", "verb", "daily_chat", "polite", [["始めます","はじめます","開始"],["終わります","おわります","結束"],["使います","つかいます","使用"],["作ります","つくります","做、製作"],["手伝います","てつだいます","幫忙"],["待ちます","まちます","等待"],["急ぎます","いそぎます","趕、急"],["選びます","えらびます","選擇"],["調べます","しらべます","查"],["覚えます","おぼえます","記住"],["忘れます","わすれます","忘記"],["説明します","せつめいします","說明"]]),
    pack("N4", "u5_describe", "describe", "adjective", "feelings", "neutral", [["便利","べんり","方便"],["不便","ふべん","不方便"],["簡単","かんたん","簡單"],["複雑","ふくざつ","複雜"],["安全","あんぜん","安全"],["危ない","あぶない","危險"],["静か","しずか","安靜"],["にぎやか","にぎやか","熱鬧"],["必要","ひつよう","必要"],["大切","たいせつ","重要、珍惜"],["残念","ざんねん","可惜"],["心配","しんぱい","擔心"]]),
    pack("N3", "u2_daily", "society", "noun", "society", "neutral", [["経験","けいけん","經驗"],["意見","いけん","意見"],["理由","りゆう","理由"],["原因","げんいん","原因"],["結果","けっか","結果"],["目的","もくてき","目的"],["方法","ほうほう","方法"],["場合","ばあい","場合"],["関係","かんけい","關係"],["問題","もんだい","問題"],["機会","きかい","機會"],["準備","じゅんび","準備"]]),
    pack("N3", "u1_core", "action", "verb", "school_work", "polite", [["確認します","かくにんします","確認"],["相談します","そうだんします","商量"],["報告します","ほうこくします","報告"],["参加します","さんかします","參加"],["利用します","りようします","利用"],["比較します","ひかくします","比較"],["改善します","かいぜんします","改善"],["理解します","りかいします","理解"],["失敗します","しっぱいします","失敗"],["成功します","せいこうします","成功"],["遅刻します","ちこくします","遲到"],["連絡します","れんらくします","聯絡"]]),
    pack("N3", "u5_describe", "describe", "adjective", "feelings", "neutral", [["正しい","ただしい","正確"],["詳しい","くわしい","詳細、熟悉"],["厳しい","きびしい","嚴格"],["眠い","ねむい","想睡"],["恥ずかしい","はずかしい","害羞、丟臉"],["珍しい","めずらしい","稀奇"],["複雑","ふくざつ","複雜"],["自然","しぜん","自然"],["普通","ふつう","普通"],["十分","じゅうぶん","足夠"],["不安","ふあん","不安"],["積極的","せっきょくてき","積極"]]),
    pack("N3", "u6_particles", "grammar", "adverb", "daily_chat", "neutral", [["実は","じつは","其實"],["特に","とくに","特別是"],["だんだん","だんだん","漸漸"],["もし","もし","如果"],["たぶん","たぶん","大概"],["必ず","かならず","一定"],["なるべく","なるべく","盡量"],["もちろん","もちろん","當然"],["しかし","しかし","但是"],["つまり","つまり","也就是說"],["例えば","たとえば","例如"],["それに","それに","而且"]]),
    pack("N4", "u6_particles", "grammar", "particle", "daily_chat", "neutral", [["だけ","だけ","只有"],["しか","しか","只、除了"],["より","より","比"],["ほど","ほど","程度"],["くらい","くらい","大約"],["まで","まで","到～為止"],["から","から","從、因為"],["ので","ので","因為"],["ても","ても","即使"],["ながら","ながら","一邊～一邊"],["たり","たり","列舉動作"],["ずつ","ずつ","各自、每次"]]),
    pack("N3", "u6_particles", "grammar", "register", "keigo", "formal", [["です","です","丁寧語結尾"],["ます","ます","丁寧語動詞結尾"],["いらっしゃいます","いらっしゃいます","在、去、來的尊敬語"],["召し上がります","めしあがります","吃、喝的尊敬語"],["ご覧になります","ごらんになります","看的尊敬語"],["伺います","うかがいます","去、問、拜訪的謙讓語"],["いただきます","いただきます","得到、吃喝的謙讓語"],["申します","もうします","說、叫作的謙讓語"],["いたします","いたします","する 的謙讓語"],["ございます","ございます","あります 的丁寧語"]]),
  ];

  const GRAMMAR_ROWS = [
    ["g_n5_desu","N5","u1_core","〜です","是～","私は学生です。","わたしはがくせいです。","我是學生。","私は学生＿。","です","polite"],
    ["g_n5_masu","N5","u1_core","〜ます","禮貌動詞句","水を飲みます。","みずをのみます。","我喝水。","水を飲み＿。","ます","polite"],
    ["g_n5_wa","N5","u6_particles","〜は","提出主題","今日は休みです。","きょうはやすみです。","今天休息。","今日＿休みです。","は","neutral"],
    ["g_n5_ga","N5","u6_particles","〜が","主語或喜歡對象","猫が好きです。","ねこがすきです。","我喜歡貓。","猫＿好きです。","が","neutral"],
    ["g_n5_wo","N5","u6_particles","〜を","動作對象","ご飯を食べます。","ごはんをたべます。","我吃飯。","ご飯＿食べます。","を","neutral"],
    ["g_n5_ni","N5","u6_particles","〜に","方向或時間點","駅に行きます。","えきにいきます。","我去車站。","駅＿行きます。","に","neutral"],
    ["g_n5_de","N5","u6_particles","〜で","場所或手段","電車で行きます。","でんしゃでいきます。","我搭電車去。","電車＿行きます。","で","neutral"],
    ["g_n5_tai","N5","u1_core","〜たいです","想做～","ラーメンを食べたいです。","ラーメンをたべたいです。","我想吃拉麵。","ラーメンを食べ＿です。","たい","polite"],
    ["g_n5_kudasai","N5","u4_food_shop","〜てください","請做～","少し待ってください。","すこしまってください。","請稍等。","少し待って＿。","ください","polite"],
    ["g_n5_mashita","N5","u1_core","〜ました","過去動作","寿司を食べました。","すしをたべました。","我吃了壽司。","寿司を食べ＿。","ました","polite"],
    ["g_n4_teiru","N4","u2_daily","〜ています","正在～、狀態持續","日本語を勉強しています。","にほんごをべんきょうしています。","我正在學日文。","日本語を勉強し＿。","ています","polite"],
    ["g_n4_koto","N4","u1_core","〜ことができます","能夠做～","日本語を読むことができます。","にほんごをよむことができます。","我能讀日文。","日本語を読む＿ができます。","こと","polite"],
    ["g_n4_nagara","N4","u2_daily","〜ながら","一邊～一邊～","音楽を聞きながら勉強します。","おんがくをききながらべんきょうします。","一邊聽音樂一邊讀書。","音楽を聞き＿勉強します。","ながら","neutral"],
    ["g_n4_to_omou","N4","u5_describe","〜と思います","我覺得～","明日は雨だと思います。","あしたはあめだとおもいます。","我覺得明天會下雨。","雨だ＿思います。","と","polite"],
    ["g_n4_node","N4","u6_particles","〜ので","因為～所以","忙しいので行けません。","いそがしいのでいけません。","因為忙所以不能去。","忙しい＿行けません。","ので","neutral"],
    ["g_n4_tara","N4","u6_particles","〜たら","如果～、當～","時間があったら行きます。","じかんがあったらいきます。","如果有時間就去。","時間があっ＿行きます。","たら","neutral"],
    ["g_n4_mitai","N4","u5_describe","〜みたいです","好像～","この店は有名みたいです。","このみせはゆうめいみたいです。","這家店好像很有名。","有名＿です。","みたい","neutral"],
    ["g_n4_sou","N4","u5_describe","〜そうです","看起來～","この料理はおいしそうです。","このりょうりはおいしそうです。","這道菜看起來很好吃。","おいし＿です。","そう","neutral"],
    ["g_n4_yasui","N4","u1_core","〜やすい","容易～","この説明はわかりやすいです。","このせつめいはわかりやすいです。","這個說明很容易懂。","わかり＿です。","やすい","neutral"],
    ["g_n4_nikui","N4","u1_core","〜にくい","難以～","この漢字は覚えにくいです。","このかんじはおぼえにくいです。","這個漢字很難記。","覚え＿です。","にくい","neutral"],
    ["g_n3_tame","N3","u6_particles","〜ために","為了～","日本で働くために勉強しています。","にほんではたらくためにべんきょうしています。","為了在日本工作而學習。","働く＿勉強しています。","ために","formal"],
    ["g_n3_youni","N3","u6_particles","〜ように","為了能～、變得～","忘れないようにメモします。","わすれないようにメモします。","為了不忘記而做筆記。","忘れない＿メモします。","ように","neutral"],
    ["g_n3_hazu","N3","u5_describe","〜はずです","照理說應該～","彼はもう着いたはずです。","かれはもうついたはずです。","他應該已經到了。","着いた＿です。","はず","neutral"],
    ["g_n3_wake","N3","u6_particles","〜わけです","也就是說～","だから人気があるわけです。","だからにんきがあるわけです。","所以才會有人氣。","人気がある＿です。","わけ","formal"],
    ["g_n3_baai","N3","u6_particles","〜場合","在～情況下","遅れる場合は連絡してください。","おくれるばあいはれんらくしてください。","如果會遲到請聯絡。","遅れる＿は連絡してください。","場合","formal"],
    ["g_n3_tokoro","N3","u2_daily","〜ところです","正要、正在、剛剛","今から出かけるところです。","いまからでかけるところです。","我正要出門。","出かける＿です。","ところ","neutral"],
    ["g_n3_kanou","N3","u1_core","可能形","能夠做～","日本語で注文できます。","にほんごでちゅうもんできます。","可以用日文點餐。","注文＿ます。","でき","polite"],
    ["g_n3_passive","N3","u6_particles","受身形","被～","先生にほめられました。","せんせいにほめられました。","被老師稱讚了。","ほめ＿ました。","られ","formal"],
    ["g_n3_keigo_teinei","N3","u6_particles","丁寧語","禮貌說法","少しお待ちください。","すこしおまちください。","請稍等。","少しお待ち＿。","ください","polite"],
    ["g_n3_keigo_sonkei","N3","u6_particles","尊敬語","抬高對方動作","先生がいらっしゃいます。","せんせいがいらっしゃいます。","老師在。","先生が＿。","いらっしゃいます","formal"],
    ["g_n3_keigo_kenjou","N3","u6_particles","謙譲語","降低自己動作","あとで伺います。","あとでうかがいます。","我稍後拜訪。","あとで＿。","伺います","formal"],
  ];

  const GRAMMAR_PATTERNS = GRAMMAR_ROWS.map(([id, jlptLevel, unitId, label, zh, ja, reading, promptZh, blank, blankAnswer, register]) => grammar(id, jlptLevel, unitId, label, zh, ja, reading, promptZh, blank, blankAnswer, register));
  const REGISTER_PAIRS = [
    { id: "reg_like", title: "喜歡", polite: "猫が好きです。", plain: "猫が好きだ。", casual: "猫好き。", honorific: "", humble: "", zh: "我喜歡貓。", note: "學習時先用丁寧語；朋友間才用更短的口語。" },
    { id: "reg_go", title: "想去", polite: "駅に行きたいです。", plain: "駅に行きたい。", casual: "駅行きたい。", honorific: "", humble: "", zh: "我想去車站。", note: "口語常省略助詞，但初學者先把助詞說穩。" },
    { id: "reg_wait", title: "請稍等", polite: "少し待ってください。", plain: "少し待って。", casual: "ちょっと待って。", honorific: "少々お待ちください。", humble: "", zh: "請稍等。", note: "對店員或正式場合使用更禮貌的 お待ちください。" },
    { id: "reg_visit", title: "拜訪/去", polite: "明日行きます。", plain: "明日行く。", casual: "明日行くね。", honorific: "明日いらっしゃいます。", humble: "明日伺います。", zh: "明天去。", note: "說對方去/來用尊敬語，說自己拜訪對方用謙讓語。" },
  ];

  function pack(level, unitId, categoryId, pos, scenario, register, rows) { return { level, unitId, categoryId, pos, scenario, register, rows }; }
  function levelNumber(level) { return { N5: 1, N4: 2, N3: 3 }[level] || 1; }
  function grammar(id, jlptLevel, unitId, label, zh, ja, reading, promptZh, blank, blankAnswer, register = "neutral") {
    return { id, type: "pattern", source: "curriculumPack", jlptLevel, unitId, categoryId: "grammar", label, zh, ja, reading, promptZh, answer: ja, blank, blankReading: blank, blankAnswer, essential: [label], level: levelNumber(jlptLevel), pos: "grammar", scenario: "grammar", register, skill: "grammar" };
  }
  function normalizeId(value) { return String(value || "").toLowerCase().replace(/[^\w\u3040-\u30ff\u3400-\u9fff]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 42); }
  function vocabItems() {
    return VOCAB_PACKS.flatMap((packItem) => packItem.rows.map(([ja, reading, zh], index) => ({
      id: `pack_${packItem.level.toLowerCase()}_${packItem.scenario}_${normalizeId(ja)}_${index}`,
      type: "vocab", source: "curriculumPack", sourceId: `pack_${packItem.level}_${packItem.scenario}_${index}`,
      jlptLevel: packItem.level, unitId: packItem.unitId, categoryId: packItem.categoryId, label: ja, ja, reading, zh,
      promptZh: zh, answer: ja, essential: [ja], level: levelNumber(packItem.level), pos: packItem.pos, scenario: packItem.scenario,
      scenarioLabel: SCENARIOS[packItem.scenario] || packItem.scenario, register: packItem.register, skill: "vocabulary",
      rawItem: { id: `pack_${packItem.level.toLowerCase()}_${packItem.scenario}_${normalizeId(ja)}_${index}`, zh, ja, reading, rank: index + 1, category: packItem.categoryId, jlptLevel: packItem.level, pos: packItem.pos, scenario: packItem.scenario, register: packItem.register },
    })));
  }
  function toItems() { return [...vocabItems(), ...GRAMMAR_PATTERNS]; }
  function stats() {
    const items = toItems();
    return { targets: LEVEL_TARGETS, levels: Object.fromEntries(Object.keys(LEVEL_TARGETS).map((level) => [level, items.filter((item) => item.jlptLevel === level).length])), scenarios: SCENARIOS, total: items.length };
  }
  function extendVocabularyGraph() {
    const graph = window.KOTOHA_VOCABULARY_GRAPH;
    if (!graph) return;
    const byCategory = {};
    vocabItems().filter((item) => !["grammar", "pattern"].includes(item.categoryId)).forEach((item) => {
      const key = item.categoryId || "daily";
      if (!byCategory[key]) byCategory[key] = [];
      byCategory[key].push({ id: item.rawItem.id, zh: item.zh, ja: item.ja, reading: item.reading, rank: 40 + byCategory[key].length, category: item.categoryId === "place" ? "place" : "object", jlptLevel: item.jlptLevel, pos: item.pos, scenario: item.scenario, register: item.register });
    });
    Object.entries(byCategory).forEach(([id, items]) => {
      if (!graph[id]) graph[id] = { id, labelZh: categoryLabel(id), labelJa: categoryLabel(id), sectionTitle: `可以一起學的${categoryLabel(id)}`, completedText: `${categoryLabel(id)}常用詞你已經很熟了。`, defaultDisplayLimit: 5, items: [] };
      const seen = new Set(graph[id].items.map((item) => `${item.ja}|${item.zh}`));
      items.forEach((item) => { const key = `${item.ja}|${item.zh}`; if (!seen.has(key)) { graph[id].items.push(item); seen.add(key); } });
    });
  }
  function categoryLabel(id) { return { animal: "動物", time: "時間", food: "食物", place: "地點", rental: "租借", travel: "旅行", shopping: "購物", daily: "日常", action: "動作", describe: "描述詞", society: "社會詞" }[id] || "詞彙"; }

  window.KOTOHA_CURRICULUM_PACKS = { targets: LEVEL_TARGETS, scenarios: SCENARIOS, vocabPacks: VOCAB_PACKS, grammarPatterns: GRAMMAR_PATTERNS, registerPairs: REGISTER_PAIRS };
  window.KotohaCurriculumPacks = { toItems, stats, extendVocabularyGraph };
  extendVocabularyGraph();
})();
