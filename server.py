from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "web"
if not WEB_ROOT.exists() and (ROOT / "language_os" / "web").exists():
    WEB_ROOT = ROOT / "language_os" / "web"

APP_VERSION = "2026-05-15-kotoha-v3-language-map"
DEFAULT_MODEL = "gpt-5-mini"
MODEL_FALLBACKS = ["gpt-5.4-mini", "gpt-4.1-mini", "gpt-4o-mini"]
MAX_CARDS = 7
MAX_CORE_ITEMS = 5

VALID_CARD_CATEGORIES = {"time", "action", "place", "object", "phrase", "grammar"}
VALID_MAP_CATEGORIES = {"animal", "time", "food", "place", "travel", "shopping", "rental", "object", "action"}
VALID_PATTERNS = {"ga_suki_desu", "want_to_go", "want_to_rent", "wa_doko_desu", "price_ikura_desu", "time_kara_made", "object_wo_kudasai"}


def card(id_: str, keys: list[str], category: str, ja: tuple[str, str, str], en: tuple[str, str, str]) -> dict[str, Any]:
    return {"id": id_, "keys": keys, "category": category, "ja": ja, "en": en}


LOCAL_CARDS = [
    card("cat", ["貓", "猫", "cat", "ねこ"], "object", ("猫", "ねこ", "貓。"), ("cat", "kat", "貓。")),
    card("dog", ["狗", "犬", "dog", "いぬ"], "object", ("犬", "いぬ", "狗。"), ("dog", "dawg", "狗。")),
    card("like", ["喜歡", "喜欢", "like", "好き"], "grammar", ("好き", "すき", "喜歡。"), ("like", "like", "喜歡。")),
    card("tomorrow", ["明天", "明日", "tomorrow", "あした"], "time", ("明日", "あした", "日常口語常用的「明天」。"), ("tomorrow", "tuh-MOR-oh", "表示明天。")),
    card("today", ["今天", "今日", "today", "きょう"], "time", ("今日", "きょう", "今天。"), ("today", "tuh-DAY", "表示今天。")),
    card("want_to", ["想", "想要", "want", "たい"], "grammar", ("〜たい", "たい", "表示「想做某事」。"), ("want to", "wahnt to", "表示想做某事。")),
    card("want_go", ["想去", "want to go", "行きたい", "いきたい"], "action", ("行きたい", "いきたい", "想去。"), ("want to go", "wahnt to goh", "想去某個地方。")),
    card("go", ["去", "要去", "go", "行く", "行き"], "action", ("行く", "いく", "基本動詞：去。"), ("go", "goh", "去某個地方。")),
    card("station", ["車站", "车站", "station", "駅"], "place", ("駅", "えき", "車站。"), ("station", "STAY-shun", "車站。")),
    card("airport", ["機場", "机场", "airport", "空港"], "place", ("空港", "くうこう", "機場。"), ("airport", "AIR-port", "機場。")),
    card("restaurant", ["餐廳", "餐厅", "restaurant", "レストラン"], "place", ("レストラン", "れすとらん", "餐廳。"), ("restaurant", "RES-tuh-rahnt", "餐廳。")),
    card("hotel", ["飯店", "酒店", "旅館", "hotel", "ホテル"], "place", ("ホテル", "ほてる", "飯店、旅館。"), ("hotel", "hoh-TEL", "飯店、旅館。")),
    card("convenience_store", ["便利商店", "超商", "コンビニ"], "place", ("コンビニ", "こんびに", "便利商店。"), ("convenience store", "", "便利商店。")),
    card("ski_resort", ["滑雪場", "滑雪场", "ski resort", "スキー場", "スキー"], "place", ("スキー場", "すきーじょう", "滑雪場。"), ("ski resort", "skee ri-ZORT", "滑雪場。")),
    card("rent", ["租", "租借", "租板", "rent", "rental", "レンタル", "借りる"], "action", ("レンタルする", "れんたるする", "租借器材或用品時很自然。"), ("rent", "rent", "租借物品。")),
    card("snowboard", ["板子", "雪板", "滑雪板", "snowboard", "ボード", "スノーボード"], "object", ("スノーボード", "すのーぼーど", "滑雪板。"), ("snowboard", "SNOH-bord", "滑雪板。")),
    card("ticket", ["票", "車票", "车票", "ticket", "切符"], "object", ("切符", "きっぷ", "票、車票。"), ("ticket", "TIK-it", "票、車票。")),
    card("water", ["水", "water"], "object", ("水", "みず", "水。"), ("water", "WAH-ter", "水。")),
    card("ramen", ["拉麵", "拉面", "ramen", "ラーメン"], "object", ("ラーメン", "らーめん", "拉麵。"), ("ramen", "RAH-men", "拉麵。")),
    card("coffee", ["咖啡", "coffee", "コーヒー"], "object", ("コーヒー", "こーひー", "咖啡。"), ("coffee", "KAW-fee", "咖啡。")),
    card("how_much", ["多少錢", "多少钱", "how much", "いくら"], "phrase", ("いくらですか", "いくらですか", "詢問價格的簡單說法。"), ("how much is it?", "how much iz it", "詢問價格。")),
    card("where", ["在哪", "在哪裡", "在哪里", "哪裡", "哪里", "where", "どこ"], "phrase", ("どこですか", "どこですか", "問位置：在哪裡？"), ("where is it?", "wair iz it", "詢問某物或某地在哪裡。")),
    card("please", ["請", "请", "麻煩", "拜託", "please"], "phrase", ("お願いします", "おねがいします", "禮貌地請求對方協助。"), ("please", "pleez", "禮貌請求時使用。")),
    card("excuse", ["請問", "请问", "不好意思", "excuse me"], "phrase", ("すみません", "すみません", "開口問路或叫住店員時很常用。"), ("excuse me", "ik-SKYOOZ mee", "問路或吸引對方注意。")),
]


def normalize(value: str) -> str:
    ignored = set(" \t\r\n，。！？、,.!?「」『』（）()")
    return "".join(ch for ch in value.casefold() if ch not in ignored)


def clamp_int(value: Any, minimum: int, maximum: int, default: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    return min(maximum, max(minimum, number))


def clamp_float(value: Any, minimum: float, maximum: float, default: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return min(maximum, max(minimum, number))


def local_cards(text: str, mode: str) -> list[dict[str, Any]]:
    normalized = normalize(text)
    cards: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in LOCAL_CARDS:
        if any(normalize(key) in normalized for key in item["keys"]):
            term, reading, note = item[mode]
            key = f"{mode}|{item['category']}|{term}".lower()
            if key in seen:
                continue
            seen.add(key)
            cards.append({"term": term, "reading": reading, "note": note, "category": item["category"], "difficulty": 1, "source": "local"})
    return cards[:MAX_CARDS]


def fallback_cards(mode: str) -> list[dict[str, Any]]:
    preferred = {"excuse", "please", "where", "how_much"}
    cards: list[dict[str, Any]] = []
    for item in LOCAL_CARDS:
        if item["id"] not in preferred:
            continue
        term, reading, note = item[mode]
        cards.append({"term": term, "reading": reading, "note": note, "category": item["category"], "difficulty": 1, "source": "local"})
    return cards


def core_item(term: str, reading: str, meaning: str, category: str, source_text: str, importance: int = 1) -> dict[str, Any]:
    return {"term": term, "reading": reading, "meaning": meaning, "category": category if category in VALID_CARD_CATEGORIES else "phrase", "sourceText": source_text, "importance": clamp_int(importance, 1, 5, 1)}


def detected_category(id_: str, label: str, source_term: str, confidence: float = 0.8) -> dict[str, Any]:
    return {"id": id_, "label": label, "sourceTerm": source_term, "confidence": clamp_float(confidence, 0.0, 1.0, 0.8)}


def detected_pattern(id_: str, label: str, meaning: str, example: str) -> dict[str, Any]:
    return {"id": id_, "label": label, "meaning": meaning, "example": example}


def grammar_note(pattern_id: str, title: str, short: str, example: str, level: str = "beginner") -> dict[str, Any]:
    return {"patternId": pattern_id, "title": title, "short": short[:90], "example": example, "level": level}


def cards_from_core(core_items: list[dict[str, Any]], source: str) -> list[dict[str, Any]]:
    return [{"term": item.get("term", ""), "reading": item.get("reading", ""), "note": item.get("meaning", ""), "category": item.get("category", "phrase"), "difficulty": 1, "source": source} for item in core_items[:MAX_CARDS]]


def local_language_map(text: str, mode: str, cards: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    normalized = normalize(text)
    cards = cards or local_cards(text, mode)
    if mode == "ja" and ("喜歡" in text or "喜欢" in text or "好き" in text or "like" in normalized):
        if any(key in text for key in ["貓", "猫", "cat", "ねこ"]):
            core = [core_item("猫", "ねこ", "貓", "object", "貓", 1), core_item("好き", "すき", "喜歡", "grammar", "喜歡", 2)]
            return {"version": 3, "source": "local", "message": "這句話可以先抓住「喜歡的對象 + が好きです」。", "sentence": {"target": "猫が好きです。", "source": "我喜歡貓。", "literal": "貓是喜歡的。"}, "coreItems": core, "detectedCategories": [detected_category("animal", "動物", "猫", 0.95)], "detectedPatterns": [detected_pattern("ga_suki_desu", "〜が好きです", "表示「喜歡～」。", "猫が好きです。")], "grammarNotes": [grammar_note("ga_suki_desu", "〜が好きです", "表示「喜歡～」。日文裡喜歡的對象通常用 が。", "猫が好きです。")], "cards": cards_from_core(core, "local")}
    ski_like = any(key in normalized for key in ["滑雪場", "滑雪场", "skiresort", "スキー場", "スキー"])
    rent_like = any(key in normalized for key in ["租", "租借", "租板", "rent", "rental", "レンタル"])
    board_like = any(key in normalized for key in ["板子", "雪板", "滑雪板", "snowboard", "ボード", "スノーボード"])
    if mode == "ja" and (ski_like or rent_like or board_like):
        core = [core_item("明日", "あした", "明天", "time", "明天", 1), core_item("スキー場", "すきーじょう", "滑雪場", "place", "滑雪場", 1), core_item("スノーボード", "すのーぼーど", "滑雪板", "object", "板子", 1), core_item("レンタルしたい", "れんたるしたい", "想租借", "action", "想租", 1), core_item("〜たい", "たい", "想做某事", "grammar", "想", 2)]
        return {"version": 3, "source": "local", "message": "這句話的核心是「時間 + 地點 + 租借物品 + 想做」。", "sentence": {"target": "明日、スキー場でスノーボードをレンタルしたいです。", "source": text, "literal": "明天，在滑雪場，想租滑雪板。"}, "coreItems": core, "detectedCategories": [detected_category("time", "時間", "明日", 0.9), detected_category("place", "地點", "スキー場", 0.86), detected_category("rental", "租借", "スノーボード", 0.95)], "detectedPatterns": [detected_pattern("want_to_rent", "〜をレンタルしたいです", "表示想租借某個物品。", "スノーボードをレンタルしたいです。")], "grammarNotes": [grammar_note("want_to_rent", "〜たい", "表示「想做某事」。接在動詞變化後面。", "レンタルしたいです。")], "cards": cards_from_core(core, "local")}
    if not cards:
        cards = fallback_cards(mode)
    core = [core_item(card["term"], card.get("reading", ""), card.get("note", ""), card.get("category", "phrase"), card["term"], index + 1) for index, card in enumerate(cards[:MAX_CORE_ITEMS])]
    categories = []
    seen: set[str] = set()
    for card_ in cards:
        mapped = {"time": "time", "place": "place", "object": "object", "action": "action"}.get(card_.get("category"))
        if mapped and mapped not in seen:
            seen.add(mapped)
            categories.append(detected_category(mapped, {"time": "時間", "place": "地點", "object": "物品", "action": "動作"}[mapped], card_["term"], 0.55))
    return {"version": 3, "source": "local", "message": f"本地安全模式整理了 {len(core)} 個核心學習點。", "sentence": {"target": text if mode == "ja" else "", "source": text, "literal": ""}, "coreItems": core, "detectedCategories": categories, "detectedPatterns": [], "grammarNotes": [], "cards": cards}


def model_candidates() -> list[str]:
    configured = (os.environ.get("OPENAI_MODEL") or DEFAULT_MODEL).strip() or DEFAULT_MODEL
    models: list[str] = []
    for model in [configured, *MODEL_FALLBACKS]:
        if model and model not in models:
            models.append(model)
    return models


def is_reasoning_model(model: str) -> bool:
    return model.startswith("gpt-5") or model.startswith("o1") or model.startswith("o3") or model.startswith("o4")


def lesson_schema() -> dict[str, Any]:
    card_schema = {"type": "object", "additionalProperties": False, "required": ["term", "reading", "note", "category", "difficulty"], "properties": {"term": {"type": "string"}, "reading": {"type": "string"}, "note": {"type": "string"}, "category": {"type": "string", "enum": sorted(VALID_CARD_CATEGORIES)}, "difficulty": {"type": "integer"}}}
    return {"type": "object", "additionalProperties": False, "required": ["version", "message", "sentence", "coreItems", "detectedCategories", "detectedPatterns", "grammarNotes", "cards"], "properties": {"version": {"type": "integer"}, "message": {"type": "string"}, "sentence": {"type": "object", "additionalProperties": False, "required": ["target", "source", "literal"], "properties": {"target": {"type": "string"}, "source": {"type": "string"}, "literal": {"type": "string"}}}, "coreItems": {"type": "array", "maxItems": MAX_CORE_ITEMS, "items": {"type": "object", "additionalProperties": False, "required": ["term", "reading", "meaning", "category", "sourceText", "importance"], "properties": {"term": {"type": "string"}, "reading": {"type": "string"}, "meaning": {"type": "string"}, "category": {"type": "string", "enum": sorted(VALID_CARD_CATEGORIES)}, "sourceText": {"type": "string"}, "importance": {"type": "integer"}}}}, "detectedCategories": {"type": "array", "items": {"type": "object", "additionalProperties": False, "required": ["id", "label", "sourceTerm", "confidence"], "properties": {"id": {"type": "string", "enum": sorted(VALID_MAP_CATEGORIES)}, "label": {"type": "string"}, "sourceTerm": {"type": "string"}, "confidence": {"type": "number"}}}}, "detectedPatterns": {"type": "array", "maxItems": 2, "items": {"type": "object", "additionalProperties": False, "required": ["id", "label", "meaning", "example"], "properties": {"id": {"type": "string", "enum": sorted(VALID_PATTERNS)}, "label": {"type": "string"}, "meaning": {"type": "string"}, "example": {"type": "string"}}}}, "grammarNotes": {"type": "array", "items": {"type": "object", "additionalProperties": False, "required": ["patternId", "title", "short", "example", "level"], "properties": {"patternId": {"type": "string"}, "title": {"type": "string"}, "short": {"type": "string"}, "example": {"type": "string"}, "level": {"type": "string", "enum": ["beginner"]}}}}, "cards": {"type": "array", "items": card_schema}}}


def build_ai_payload(model: str, text: str, mode: str, candidates: list[dict[str, Any]], local_seed: dict[str, Any]) -> dict[str, Any]:
    prompt = {"user_text": text, "target_mode": mode, "local_candidates": candidates, "local_seed_if_relevant": local_seed, "rules": ["You are Kotoha's language map analyzer for Taiwanese Traditional Chinese users.", "The goal is to help beginners understand how this sentence is composed, not to fill the page.", "Return a Language Map Result. version must be 3.", "Pick only the 2 to 5 most important coreItems from the user's actual sentence.", "Use detectedCategories only to mark semantic pools suitable for local frontend expansion, such as animal/time/food/place/rental.", "Use only 1 to 2 detectedPatterns.", "grammarNotes must be short. Each short field must be no more than 60 Traditional Chinese characters.", "Do not put extension words such as dogs, rabbits, birds, or fish into coreItems unless they appear in the user's sentence.", "meaning, note, and grammar explanations must be Traditional Chinese.", "For ja mode, sentence.target must be natural beginner-friendly Japanese and not overly formal.", "If user_text means 'I like cats', prefer sentence.target='猫が好きです。', detectedCategories=animal, detectedPatterns=ga_suki_desu.", "If user_text means 'I want to go to a ski resort tomorrow to rent a board', prefer sentence.target='明日、スキー場でスノーボードをレンタルしたいです。', detectedCategories=time/place/rental, detectedPatterns=want_to_rent or want_to_go.", "Return JSON only, matching the provided schema."]}
    payload: dict[str, Any] = {"model": model, "input": [{"role": "developer", "content": "You analyze a sentence into Kotoha's Language Map Result. Be precise, small, stable, and beginner-friendly."}, {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)}], "text": {"format": {"type": "json_schema", "name": "kotoha_language_map_result", "strict": True, "schema": lesson_schema()}}, "max_output_tokens": 2600}
    if is_reasoning_model(model):
        payload["reasoning"] = {"effort": "low"}
    return payload


def call_openai(model: str, text: str, mode: str, candidates: list[dict[str, Any]], local_seed: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None, "OPENAI_API_KEY is not configured"
    request = urllib.request.Request("https://api.openai.com/v1/responses", data=json.dumps(build_ai_payload(model, text, mode, candidates, local_seed)).encode("utf-8"), headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json; charset=utf-8"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            return json.loads(response.read().decode("utf-8")), None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:700]
        return None, f"{model} HTTP {exc.code}: {detail}"
    except (OSError, urllib.error.URLError, TimeoutError) as exc:
        return None, f"{model} request failed: {exc}"


def extract_output_text(data: dict[str, Any]) -> str | None:
    direct = data.get("output_text")
    if isinstance(direct, str) and direct.strip():
        return direct
    for output in data.get("output", []):
        if not isinstance(output, dict):
            continue
        for content in output.get("content", []):
            if not isinstance(content, dict):
                continue
            text = content.get("text")
            if isinstance(text, str) and text.strip():
                return text
    return None


def clean_ai_cards(raw_cards: Any, source: str = "ai") -> list[dict[str, Any]]:
    if not isinstance(raw_cards, list):
        return []
    cleaned: list[dict[str, Any]] = []
    for raw in raw_cards[:MAX_CARDS]:
        if not isinstance(raw, dict):
            continue
        term = str(raw.get("term", "")).strip()
        if not term:
            continue
        category = str(raw.get("category") or "phrase").strip()
        if category not in VALID_CARD_CATEGORIES:
            category = "phrase"
        cleaned.append({"term": term, "reading": str(raw.get("reading", "")).strip(), "note": str(raw.get("note", "")).strip(), "category": category, "difficulty": clamp_int(raw.get("difficulty", 1), 1, 3, 1), "source": source})
    return cleaned


def clean_language_map_result(raw: dict[str, Any], text: str, mode: str) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    if int(raw.get("version") or 0) < 3 or not isinstance(raw.get("sentence"), dict) or not isinstance(raw.get("coreItems"), list):
        cards = clean_ai_cards(raw.get("cards"), "ai")
        if not cards:
            return None
        return {"source": "ai", "message": str(raw.get("message") or f"AI 找到 {len(cards)} 個練習點。"), "cards": cards}
    sentence_raw = raw.get("sentence") or {}
    sentence = {"target": str(sentence_raw.get("target", "")).strip(), "source": str(sentence_raw.get("source") or text).strip(), "literal": str(sentence_raw.get("literal", "")).strip()}
    core_items: list[dict[str, Any]] = []
    for item in raw.get("coreItems", [])[:MAX_CORE_ITEMS]:
        if not isinstance(item, dict):
            continue
        term = str(item.get("term", "")).strip()
        if not term:
            continue
        category = str(item.get("category") or "phrase").strip()
        core_items.append(core_item(term, str(item.get("reading", "")).strip(), str(item.get("meaning", "")).strip(), category if category in VALID_CARD_CATEGORIES else "phrase", str(item.get("sourceText", "")).strip(), clamp_int(item.get("importance", 1), 1, 5, 1)))
    detected_categories: list[dict[str, Any]] = []
    seen_categories: set[str] = set()
    for item in raw.get("detectedCategories", []):
        if not isinstance(item, dict):
            continue
        id_ = str(item.get("id", "")).strip()
        if id_ not in VALID_MAP_CATEGORIES or id_ in seen_categories:
            continue
        seen_categories.add(id_)
        detected_categories.append(detected_category(id_, str(item.get("label", id_)).strip(), str(item.get("sourceTerm", "")).strip(), item.get("confidence", 0.7)))
    patterns: list[dict[str, Any]] = []
    seen_patterns: set[str] = set()
    for item in raw.get("detectedPatterns", [])[:2]:
        if not isinstance(item, dict):
            continue
        id_ = str(item.get("id", "")).strip()
        if id_ not in VALID_PATTERNS or id_ in seen_patterns:
            continue
        seen_patterns.add(id_)
        patterns.append(detected_pattern(id_, str(item.get("label", id_)).strip(), str(item.get("meaning", "")).strip(), str(item.get("example", "")).strip()))
    notes: list[dict[str, Any]] = []
    for item in raw.get("grammarNotes", [])[:3]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        short = str(item.get("short", "")).strip()
        if not title or not short:
            continue
        notes.append(grammar_note(str(item.get("patternId", "")).strip(), title, short, str(item.get("example", "")).strip(), "beginner"))
    cards = clean_ai_cards(raw.get("cards"), "ai") or cards_from_core(core_items, "ai")
    if not core_items and cards:
        for index, card_ in enumerate(cards[:MAX_CORE_ITEMS]):
            core_items.append(core_item(card_["term"], card_.get("reading", ""), card_.get("note", ""), card_.get("category", "phrase"), card_["term"], index + 1))
    if not sentence["target"] and core_items:
        sentence["target"] = "、".join(item["term"] for item in core_items[:3])
    return {"version": 3, "source": "ai", "message": str(raw.get("message") or "這句話已整理成語言地圖。"), "sentence": sentence, "coreItems": core_items, "detectedCategories": detected_categories, "detectedPatterns": patterns, "grammarNotes": notes, "cards": cards}


def ai_analysis(text: str, mode: str, candidates: list[dict[str, Any]], local_seed: dict[str, Any]) -> dict[str, Any] | None:
    last_error: str | None = None
    for model in model_candidates():
        data, error = call_openai(model, text, mode, candidates, local_seed)
        if error:
            last_error = error
            continue
        output_text = extract_output_text(data or {})
        if not output_text:
            last_error = f"{model} returned no output text"
            continue
        try:
            parsed = json.loads(output_text)
        except json.JSONDecodeError as exc:
            last_error = f"{model} returned non-JSON text: {exc}"
            continue
        result = clean_language_map_result(parsed, text, mode)
        if not result:
            last_error = f"{model} returned no usable language map"
            continue
        result["model"] = model
        return result
    if last_error:
        print(f"OpenAI analysis failed: {last_error}", file=sys.stderr, flush=True)
    return None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def do_GET(self) -> None:
        if self.path == "/api/health":
            self.send_json({"ok": True, "ai_enabled": bool(os.environ.get("OPENAI_API_KEY")), "model": os.environ.get("OPENAI_MODEL", DEFAULT_MODEL), "version": APP_VERSION})
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path != "/api/analyze":
            self.send_error(404)
            return
        try:
            body = self.rfile.read(int(self.headers.get("Content-Length", "0") or 0))
            payload = json.loads(body.decode("utf-8"))
        except Exception:
            self.send_error(400, "Invalid JSON")
            return
        text = str(payload.get("text", "")).strip()
        mode = "en" if payload.get("mode") == "en" else "ja"
        if not text:
            self.send_json(local_language_map("", mode, []))
            return
        candidates = local_cards(text, mode)
        local_seed = local_language_map(text, mode, candidates)
        result = ai_analysis(text, mode, candidates, local_seed)
        self.send_json(result or local_seed)

    def send_json(self, payload: dict[str, Any]) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"{self.address_string()} - {format % args}", flush=True)


def main() -> None:
    port = int(os.environ.get("PORT", "8765"))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"Language OS {APP_VERSION} running on {host}:{port}; web={WEB_ROOT}", flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
