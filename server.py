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

APP_VERSION = "2026-05-15-ai-fallback-2"
MAX_CARDS = 7
DEFAULT_MODEL = "gpt-5-mini"
MODEL_FALLBACKS = ["gpt-5.4-mini", "gpt-4.1-mini", "gpt-4o-mini"]

LOCAL_CARDS = [
    {
        "id": "excuse",
        "keys": ["請問", "请问", "不好意思", "excuse me"],
        "category": "phrase",
        "ja": ["すみません", "すみません", "開口問路或叫住店員時很常用。"],
        "en": ["excuse me", "ik-SKYOOZ mee", "問路或吸引對方注意。"],
    },
    {
        "id": "please",
        "keys": ["請", "请", "麻煩", "拜託", "please"],
        "category": "phrase",
        "ja": ["お願いします", "おねがいします", "禮貌地請求對方協助。"],
        "en": ["please", "pleez", "禮貌請求時使用。"],
    },
    {
        "id": "where",
        "keys": ["在哪", "在哪裡", "在哪里", "哪裡", "哪里", "where", "どこ"],
        "category": "phrase",
        "ja": ["どこですか", "どこですか", "問位置：在哪裡？"],
        "en": ["where is it?", "wair iz it", "詢問某物或某地在哪裡。"],
    },
    {
        "id": "how_much",
        "keys": ["多少錢", "多少钱", "how much", "いくら"],
        "category": "phrase",
        "ja": ["いくらですか", "いくらですか", "詢問價格的簡單說法。"],
        "en": ["how much is it?", "how much iz it", "詢問價格。"],
    },
    {
        "id": "tomorrow",
        "keys": ["明天", "明日", "tomorrow", "あした"],
        "category": "time",
        "ja": ["明日", "あした", "日常口語常用的「明天」。"],
        "en": ["tomorrow", "tuh-MOR-oh", "表示明天。"],
    },
    {
        "id": "want_to",
        "keys": ["想", "想要", "want", "たい"],
        "category": "grammar",
        "ja": ["〜たい", "たい", "動詞想望形：想做某事。"],
        "en": ["want to", "wahnt to", "表示想做某事。"],
    },
    {
        "id": "want_go",
        "keys": ["想去", "want to go", "行きたい", "いきたい"],
        "category": "action",
        "ja": ["行きたい", "いきたい", "意思是「想去」。"],
        "en": ["want to go", "wahnt to goh", "想去某個地方。"],
    },
    {
        "id": "go",
        "keys": ["去", "要去", "go", "行く", "行き"],
        "category": "action",
        "ja": ["行く", "いく", "基本動詞：去。"],
        "en": ["go", "goh", "去某個地方。"],
    },
    {
        "id": "station",
        "keys": ["車站", "车站", "station", "駅"],
        "category": "place",
        "ja": ["駅", "えき", "車站。"],
        "en": ["station", "STAY-shun", "車站。"],
    },
    {
        "id": "airport",
        "keys": ["機場", "机场", "airport", "空港"],
        "category": "place",
        "ja": ["空港", "くうこう", "機場。"],
        "en": ["airport", "AIR-port", "機場。"],
    },
    {
        "id": "restaurant",
        "keys": ["餐廳", "餐厅", "restaurant", "レストラン"],
        "category": "place",
        "ja": ["レストラン", "れすとらん", "餐廳。"],
        "en": ["restaurant", "RES-tuh-rahnt", "餐廳。"],
    },
    {
        "id": "ski_resort",
        "keys": ["滑雪場", "滑雪场", "ski resort", "スキー場", "スキー"],
        "category": "place",
        "ja": ["スキー場", "すきーじょう", "滑雪場。"],
        "en": ["ski resort", "skee ri-ZORT", "滑雪場。"],
    },
    {
        "id": "rent",
        "keys": ["租", "租借", "租板", "rent", "rental", "レンタル", "借りる"],
        "category": "action",
        "ja": ["レンタルする", "れんたるする", "租借器材或用品時很自然。"],
        "en": ["rent", "rent", "租借物品。"],
    },
    {
        "id": "snowboard",
        "keys": ["板子", "雪板", "滑雪板", "snowboard", "ボード", "スノーボード"],
        "category": "object",
        "ja": ["スノーボード", "すのーぼーど", "滑雪板。"],
        "en": ["snowboard", "SNOH-bord", "滑雪板。"],
    },
    {
        "id": "ticket",
        "keys": ["票", "車票", "车票", "ticket", "切符"],
        "category": "object",
        "ja": ["切符", "きっぷ", "票、車票。"],
        "en": ["ticket", "TIK-it", "票、車票。"],
    },
    {
        "id": "water",
        "keys": ["水", "water"],
        "category": "object",
        "ja": ["水", "みず", "水。"],
        "en": ["water", "WAH-ter", "水。"],
    },
    {
        "id": "ramen",
        "keys": ["拉麵", "拉面", "ramen", "ラーメン"],
        "category": "object",
        "ja": ["ラーメン", "らーめん", "拉麵。"],
        "en": ["ramen", "RAH-men", "拉麵。"],
    },
    {
        "id": "taxi",
        "keys": ["計程車", "计程车", "taxi", "タクシー"],
        "category": "object",
        "ja": ["タクシー", "たくしー", "計程車。"],
        "en": ["taxi", "TAK-see", "計程車。"],
    },
]


def normalize(value: str) -> str:
    ignored = " \t\r\n，。！？、,.!?？"
    return "".join(ch for ch in value.casefold() if ch not in ignored)


def local_cards(text: str, mode: str) -> list[dict[str, Any]]:
    normalized = normalize(text)
    cards: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in LOCAL_CARDS:
        if any(normalize(key) in normalized for key in item["keys"]):
            term, reading, note = item[mode]
            if term in seen:
                continue
            seen.add(term)
            cards.append(
                {
                    "term": term,
                    "reading": reading,
                    "note": note,
                    "category": item["category"],
                    "difficulty": 1,
                    "source": "local",
                }
            )
    return cards[:MAX_CARDS]


def fallback_cards(mode: str) -> list[dict[str, Any]]:
    preferred = {"excuse", "please", "where", "how_much"}
    cards: list[dict[str, Any]] = []
    for item in LOCAL_CARDS:
        if item["id"] not in preferred:
            continue
        term, reading, note = item[mode]
        cards.append(
            {
                "term": term,
                "reading": reading,
                "note": note,
                "category": item["category"],
                "difficulty": 1,
                "source": "local",
            }
        )
    return cards


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
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["message", "cards"],
        "properties": {
            "message": {"type": "string"},
            "cards": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["term", "reading", "note", "category", "difficulty"],
                    "properties": {
                        "term": {"type": "string"},
                        "reading": {"type": "string"},
                        "note": {"type": "string"},
                        "category": {
                            "type": "string",
                            "enum": ["time", "action", "place", "object", "phrase", "grammar"],
                        },
                        "difficulty": {"type": "integer"},
                    },
                },
            },
        },
    }


def build_ai_payload(model: str, text: str, mode: str, candidates: list[dict[str, Any]]) -> dict[str, Any]:
    prompt = {
        "user_text": text,
        "target_mode": mode,
        "local_candidates": candidates,
        "rules": [
            "Return 3 to 7 beginner-friendly lesson cards.",
            "ja means Japanese learning; en means English learning.",
            "Notes must be Traditional Chinese.",
            "Prefer useful words, grammar patterns, and natural phrases from the user's input.",
        ],
    }
    payload: dict[str, Any] = {
        "model": model,
        "input": [
            {
                "role": "system",
                "content": "You are a careful language-learning analyzer for a Taiwanese Traditional Chinese user. Return practical lesson cards that match the requested schema.",
            },
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "lesson_analysis",
                "strict": True,
                "schema": lesson_schema(),
            }
        },
        "max_output_tokens": 2000,
    }
    if is_reasoning_model(model):
        payload["reasoning"] = {"effort": "low"}
    return payload


def call_openai(model: str, text: str, mode: str, candidates: list[dict[str, Any]]) -> tuple[dict[str, Any] | None, str | None]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None, "OPENAI_API_KEY is not configured"

    payload = build_ai_payload(model, text, mode, candidates)
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json; charset=utf-8",
        },
        method="POST",
    )
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


def clean_ai_cards(raw_cards: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_cards, list):
        return []

    cleaned: list[dict[str, Any]] = []
    for raw in raw_cards[:MAX_CARDS]:
        if not isinstance(raw, dict):
            continue
        term = str(raw.get("term", "")).strip()
        if not term:
            continue
        try:
            difficulty = int(raw.get("difficulty", 1))
        except (TypeError, ValueError):
            difficulty = 1
        difficulty = min(3, max(1, difficulty))
        category = str(raw.get("category") or "phrase").strip()
        if category not in {"time", "action", "place", "object", "phrase", "grammar"}:
            category = "phrase"
        cleaned.append(
            {
                "term": term,
                "reading": str(raw.get("reading", "")).strip(),
                "note": str(raw.get("note", "")).strip(),
                "category": category,
                "difficulty": difficulty,
                "source": "ai",
            }
        )
    return cleaned


def ai_cards(text: str, mode: str, candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
    last_error: str | None = None
    for model in model_candidates():
        data, error = call_openai(model, text, mode, candidates)
        if error:
            last_error = error
            continue

        output_text = extract_output_text(data or {})
        if not output_text:
            status = (data or {}).get("status")
            details = (data or {}).get("incomplete_details") or (data or {}).get("error")
            last_error = f"{model} returned no output_text; status={status}; details={details}"
            continue

        try:
            parsed = json.loads(output_text)
        except json.JSONDecodeError as exc:
            last_error = f"{model} returned non-JSON text: {exc}"
            continue

        cards = clean_ai_cards(parsed.get("cards"))
        if not cards:
            last_error = f"{model} returned no usable cards"
            continue

        return {
            "source": "ai",
            "model": model,
            "message": str(parsed.get("message") or f"AI 找到 {len(cards)} 個練習點。"),
            "cards": cards,
        }

    if last_error:
        print(f"OpenAI analysis failed: {last_error}", file=sys.stderr, flush=True)
    return None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(WEB_ROOT), **kwargs)

    def do_GET(self) -> None:
        if self.path == "/api/health":
            self.send_json(
                {
                    "ok": True,
                    "ai_enabled": bool(os.environ.get("OPENAI_API_KEY")),
                    "model": os.environ.get("OPENAI_MODEL", DEFAULT_MODEL),
                    "version": APP_VERSION,
                }
            )
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
        if mode == "ja":
            message = f"本地安全模式找到 {len(cards)} 個日文練習點。"
        else:
            message = f"Local safe mode found {len(cards)} English practice points."
        self.send_json({"source": "local", "message": message, "cards": cards})

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
