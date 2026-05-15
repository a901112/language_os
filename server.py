from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "web"
MAX_CARDS = 7

LOCAL_CARDS = [
    {"keys": ["請問", "请问", "不好意思", "excuse me"], "category": "phrase", "ja": ["すみません", "すみません", "開口問路或叫住店員時很常用。"], "en": ["excuse me", "ik-SKYOOZ mee", "問路或吸引對方注意。"]},
    {"keys": ["請", "麻煩", "拜託", "please"], "category": "phrase", "ja": ["お願いします", "おねがいします", "禮貌地請求對方協助。"], "en": ["please", "pleez", "禮貌請求時使用。"]},
    {"keys": ["在哪", "在哪裡", "在哪里", "哪裡", "哪里", "where", "どこ"], "category": "phrase", "ja": ["どこですか", "どこですか", "問位置：在哪裡？"], "en": ["where is it?", "wair iz it", "詢問某物或某地在哪裡。"]},
    {"keys": ["多少錢", "多少钱", "how much", "いくら"], "category": "phrase", "ja": ["いくらですか", "いくらですか", "詢問價格的簡單說法。"], "en": ["how much is it?", "how much iz it", "詢問價格。"]},
    {"keys": ["明天", "tomorrow", "明日", "あした"], "category": "time", "ja": ["明日", "あした", "日常口語常用的「明天」。"], "en": ["tomorrow", "tuh-MOR-oh", "表示明天。"]},
    {"keys": ["想", "想要", "want", "たい"], "category": "grammar", "ja": ["〜たい", "たい", "動詞想望形：想做某事。"], "en": ["want to", "wahnt to", "表示想做某事。"]},
    {"keys": ["想去", "want to go", "行きたい", "いきたい"], "category": "action", "ja": ["行きたい", "いきたい", "意思是「想去」。"], "en": ["want to go", "wahnt to goh", "想去某個地方。"]},
    {"keys": ["去", "要去", "go", "行く", "行き"], "category": "action", "ja": ["行く", "いく", "基本動詞：去。"], "en": ["go", "goh", "去某個地方。"]},
    {"keys": ["車站", "车站", "station", "駅"], "category": "place", "ja": ["駅", "えき", "車站。"], "en": ["station", "STAY-shun", "車站。"]},
    {"keys": ["機場", "机场", "airport", "空港"], "category": "place", "ja": ["空港", "くうこう", "機場。"], "en": ["airport", "AIR-port", "機場。"]},
    {"keys": ["餐廳", "餐厅", "restaurant", "レストラン"], "category": "place", "ja": ["レストラン", "れすとらん", "餐廳。"], "en": ["restaurant", "RES-tuh-rahnt", "餐廳。"]},
    {"keys": ["滑雪場", "滑雪场", "ski resort", "スキー場", "スキー"], "category": "place", "ja": ["スキー場", "すきーじょう", "滑雪場。"], "en": ["ski resort", "skee ri-ZORT", "滑雪場。"]},
    {"keys": ["票", "車票", "车票", "ticket", "切符"], "category": "object", "ja": ["切符", "きっぷ", "票、車票。"], "en": ["ticket", "TIK-it", "票、車票。"]},
    {"keys": ["水", "water"], "category": "object", "ja": ["水", "みず", "水。"], "en": ["water", "WAH-ter", "水。"]},
    {"keys": ["拉麵", "拉面", "ramen", "ラーメン"], "category": "object", "ja": ["ラーメン", "らーめん", "拉麵。"], "en": ["ramen", "RAH-men", "拉麵。"]},
    {"keys": ["計程車", "计程车", "taxi", "タクシー"], "category": "object", "ja": ["タクシー", "たくしー", "計程車。"], "en": ["taxi", "TAK-see", "計程車。"]},
]


def normalize(value: str) -> str:
    return "".join(ch for ch in value.casefold() if ch not in " \t\r\n，。！？、,.!?？")


def local_cards(text: str, mode: str) -> list[dict[str, Any]]:
    normalized = normalize(text)
    cards: list[dict[str, Any]] = []
    for item in LOCAL_CARDS:
        if any(normalize(key) in normalized for key in item["keys"]):
            term, reading, note = item[mode]
            cards.append({"term": term, "reading": reading, "note": note, "category": item["category"], "difficulty": 1, "source": "local"})
    return cards[:MAX_CARDS]


def fallback_cards(mode: str) -> list[dict[str, Any]]:
    ids = {"すみません", "お願いします", "どこですか", "いくらですか"} if mode == "ja" else {"excuse me", "please", "where is it?", "how much is it?"}
    cards = []
    for item in LOCAL_CARDS:
        term, reading, note = item[mode]
        if term in ids:
            cards.append({"term": term, "reading": reading, "note": note, "category": item["category"], "difficulty": 1, "source": "local"})
    return cards


def ai_cards(text: str, mode: str, candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None

    schema = {
        "type": "object",
        "additionalProperties": False,
        "required": ["message", "cards"],
        "properties": {
            "message": {"type": "string"},
            "cards": {
                "type": "array",
                "minItems": 1,
                "maxItems": MAX_CARDS,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["term", "reading", "note", "category", "difficulty"],
                    "properties": {
                        "term": {"type": "string"},
                        "reading": {"type": "string"},
                        "note": {"type": "string"},
                        "category": {"type": "string", "enum": ["time", "action", "place", "object", "phrase", "grammar"]},
                        "difficulty": {"type": "integer", "minimum": 1, "maximum": 3},
                    },
                },
            },
        },
    }
    prompt = {
        "user_text": text,
        "target_mode": mode,
        "local_candidates": candidates,
        "instruction": "Create beginner-friendly lesson cards. ja=Japanese output, en=English output. Notes must be Traditional Chinese. Keep each card short and practical.",
    }
    payload = {
        "model": os.environ.get("OPENAI_MODEL", "gpt-5-mini"),
        "input": [
            {"role": "developer", "content": [{"type": "input_text", "text": "You are a careful language-learning analyzer. Return only valid JSON matching the schema."}]},
            {"role": "user", "content": [{"type": "input_text", "text": json.dumps(prompt, ensure_ascii=False)}]},
        ],
        "text": {"format": {"type": "json_schema", "name": "lesson_analysis", "strict": True, "schema": schema}},
        "max_output_tokens": 900,
    }
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            data = json.loads(response.read().decode("utf-8"))
    except (OSError, urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
        return None

    output_text = data.get("output_text")
    if not output_text:
        for output in data.get("output", []):
            for content in output.get("content", []):
                if isinstance(content, dict) and content.get("text"):
                    output_text = content["text"]
                    break
    if not output_text:
        return None
    try:
        parsed = json.loads(output_text)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed.get("cards"), list) or not parsed["cards"]:
        return None
    for card in parsed["cards"]:
        card["source"] = "ai"
    parsed["source"] = "ai"
    return parsed


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def do_GET(self) -> None:
        if self.path == "/api/health":
            self.send_json({"ok": True, "ai_enabled": bool(os.environ.get("OPENAI_API_KEY")), "model": os.environ.get("OPENAI_MODEL", "gpt-5-mini")})
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
            self.send_json({"source": "local", "message": "", "cards": []})
            return
        candidates = local_cards(text, mode)
        result = ai_cards(text, mode, candidates)
        if result:
            self.send_json(result)
            return
        cards = candidates or fallback_cards(mode)
        message = (f"本地安全模式找到 {len(cards)} 個日文練習點。" if mode == "ja" else f"Local safe mode found {len(cards)} English practice points.")
        self.send_json({"source": "local", "message": message, "cards": cards})

    def send_json(self, payload: dict[str, Any]) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


def main() -> None:
    port = int(os.environ.get("PORT", "8765"))
    host = os.environ.get("HOST", "0.0.0.0")
    print(f"Language OS running on {host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
