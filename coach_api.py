from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from typing import Any

APP_VERSION = "2026-05-16-kotoha-coach-official"
DEFAULT_MODEL = "gpt-5"
OPENAI_REASONING_EFFORT = os.environ.get("OPENAI_REASONING_EFFORT", "medium")
OPENAI_ALLOW_MINI_FALLBACK = os.environ.get("OPENAI_ALLOW_MINI_FALLBACK") == "1"


def env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except (TypeError, ValueError):
        return default


OPENAI_MAX_OUTPUT_TOKENS = env_int("OPENAI_MAX_OUTPUT_TOKENS", 3600)


def model_fallbacks() -> list[str]:
    if OPENAI_ALLOW_MINI_FALLBACK:
        return ["gpt-4.1", "gpt-5-mini", "gpt-4o-mini"]
    return ["gpt-4.1"]


def model_candidates() -> list[str]:
    configured = (os.environ.get("OPENAI_MODEL") or DEFAULT_MODEL).strip() or DEFAULT_MODEL
    if "mini" in configured.lower() and not OPENAI_ALLOW_MINI_FALLBACK:
        configured = DEFAULT_MODEL
    models: list[str] = []
    for model in [configured, *model_fallbacks()]:
        if model and model not in models:
            models.append(model)
    return models


def is_reasoning_model(model: str) -> bool:
    return model.startswith("gpt-5") or model.startswith("o1") or model.startswith("o3") or model.startswith("o4")


def coach_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["version", "source", "coachMessage", "userAssist", "grammarTip", "nextOptions", "topicState"],
        "properties": {
            "version": {"type": "integer"},
            "source": {"type": "string", "enum": ["ai", "local"]},
            "coachMessage": {
                "type": "object",
                "additionalProperties": False,
                "required": ["ja", "reading", "zh", "tone", "speakText"],
                "properties": {
                    "ja": {"type": "string"},
                    "reading": {"type": "string"},
                    "zh": {"type": "string"},
                    "tone": {"type": "string", "enum": ["gentle", "encouraging", "corrective"]},
                    "speakText": {"type": "string"},
                },
            },
            "userAssist": {
                "type": "object",
                "additionalProperties": False,
                "required": ["understoodAs", "suggestedReplyJa", "suggestedReplyZh", "correction", "encouragement"],
                "properties": {
                    "understoodAs": {"type": "string"},
                    "suggestedReplyJa": {"type": "string"},
                    "suggestedReplyZh": {"type": "string"},
                    "correction": {"type": "string"},
                    "encouragement": {"type": "string"},
                },
            },
            "grammarTip": {
                "type": "object",
                "additionalProperties": False,
                "required": ["title", "body", "example"],
                "properties": {"title": {"type": "string"}, "body": {"type": "string"}, "example": {"type": "string"}},
            },
            "nextOptions": {
                "type": "array",
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["label", "ja", "zh"],
                    "properties": {"label": {"type": "string"}, "ja": {"type": "string"}, "zh": {"type": "string"}},
                },
            },
            "topicState": {
                "type": "object",
                "additionalProperties": False,
                "required": ["topic", "detectedIntent", "recommendedPattern"],
                "properties": {"topic": {"type": "string"}, "detectedIntent": {"type": "string"}, "recommendedPattern": {"type": "string"}},
            },
        },
    }


def coach_option(label: str, ja: str, zh: str) -> dict[str, str]:
    return {"label": label, "ja": ja, "zh": zh}


def coach_tip(title: str = "", body: str = "", example: str = "") -> dict[str, str]:
    return {"title": title, "body": body, "example": example}


def coach_result(
    ja: str,
    zh: str,
    understood: str,
    suggested_ja: str,
    suggested_zh: str,
    correction: str,
    grammar_tip: dict[str, str],
    next_options: list[dict[str, str]],
    topic: str,
    intent: str,
    pattern: str,
    source: str = "local",
) -> dict[str, Any]:
    return {
        "version": 1,
        "source": source,
        "coachMessage": {"ja": ja, "reading": "", "zh": zh, "tone": "corrective" if correction else "gentle", "speakText": ja},
        "userAssist": {
            "understoodAs": understood,
            "suggestedReplyJa": suggested_ja,
            "suggestedReplyZh": suggested_zh,
            "correction": correction,
            "encouragement": "這樣回就很自然。",
        },
        "grammarTip": grammar_tip,
        "nextOptions": next_options[:3],
        "topicState": {"topic": topic, "detectedIntent": intent, "recommendedPattern": pattern},
    }


def clean_coach_settings(raw: Any) -> dict[str, Any]:
    settings = raw if isinstance(raw, dict) else {}
    return {
        "showTranslation": bool(settings.get("showTranslation", True)),
        "showGrammar": bool(settings.get("showGrammar", False)),
        "level": "beginner",
    }


def clean_coach_history(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    cleaned: list[dict[str, str]] = []
    for item in raw[-8:]:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip()
        if role not in {"user", "coach"}:
            continue
        cleaned.append({
            "role": role,
            "text": str(item.get("text") or "").strip()[:300],
            "ja": str(item.get("ja") or "").strip()[:300],
            "zh": str(item.get("zh") or "").strip()[:300],
        })
    return cleaned


def local_coach_result(message: str, settings: dict[str, Any]) -> dict[str, Any]:
    show_grammar = bool(settings.get("showGrammar"))
    text = str(message or "")
    lower = text.lower()
    has_food = bool(re.search(r"吃|飽|餓|飯|拉麵|壽司|食べ|お腹|ご飯|ラーメン|寿司", text))
    has_guess = bool(re.search(r"你覺得|覺得|猜|你猜|と思う|と思います|何だと思う", text))
    has_cat = bool(re.search(r"貓|猫|ねこ", text))
    has_ski = bool(re.search(r"滑雪|スキー|snowboard|snow", lower))
    has_tired = bool(re.search(r"累|疲れ|しんどい|疲勞", text))

    if has_guess and has_food:
        return coach_result(
            "何を食べましたか。ラーメンですか。",
            "你吃了什麼呢？是拉麵嗎？",
            "你想讓教練猜猜你吃了什麼。",
            "ラーメンを食べました。",
            "我吃了拉麵。",
            "",
            coach_tip("〜を食べました", "表示「吃了～」。食物後面常接 を。", "ラーメンを食べました。") if show_grammar else coach_tip(),
            [
                coach_option("ラーメンです", "ラーメンです。", "是拉麵。"),
                coach_option("寿司を食べました", "寿司を食べました。", "我吃了壽司。"),
                coach_option("秘密です", "秘密です。", "是秘密。"),
            ],
            "food",
            "guess_food",
            "〜を食べました",
        )

    if has_food:
        return coach_result(
            "お腹いっぱいなんですね。何を食べましたか。",
            "你吃得很飽對吧。你吃了什麼？",
            "我剛吃得很飽。",
            "ラーメンを食べました。",
            "我吃了拉麵。",
            "",
            coach_tip("〜を食べました", "表示「吃了～」。食物後面常接 を。", "ラーメンを食べました。") if show_grammar else coach_tip(),
            [
                coach_option("ラーメンを食べました", "ラーメンを食べました。", "我吃了拉麵。"),
                coach_option("ご飯を食べました", "ご飯を食べました。", "我吃了飯。"),
                coach_option("食べすぎました", "食べすぎました。", "我吃太多了。"),
            ],
            "food",
            "share_food",
            "〜を食べました",
        )

    if has_cat:
        corrective = "猫好き" in text and "猫が好き" not in text
        return coach_result(
            "意味はわかります。自然に言うなら「猫が好きです」です。" if corrective else "いいですね。猫が好きなんですね。",
            "意思懂。自然一點可以說「猫が好きです」。" if corrective else "很好耶。你喜歡貓對吧。",
            "我喜歡貓。",
            "猫が好きです。" if corrective else "はい、猫が好きです。",
            "我喜歡貓。" if corrective else "是的，我喜歡貓。",
            "猫好きです → 猫が好きです" if corrective else "",
            coach_tip("〜が好きです", "喜歡的對象通常用 が。", "猫が好きです。") if show_grammar else coach_tip(),
            [
                coach_option("犬も好きです", "犬も好きです。", "我也喜歡狗。"),
                coach_option("猫を飼っています", "猫を飼っています。", "我有養貓。"),
                coach_option("動物が好きです", "動物が好きです。", "我喜歡動物。"),
            ],
            "animal",
            "correct_sentence" if corrective else "talk_about_likes",
            "〜が好きです",
        )

    if has_ski:
        return coach_result(
            "いいですね。明日、スキー場に行きたいんですね。",
            "不錯耶。你明天想去滑雪場對吧。",
            "我明天想去滑雪。",
            "はい、明日スキー場に行きたいです。",
            "是的，我明天想去滑雪場。",
            "",
            coach_tip("〜たいです", "表示「想做某事」。", "行きたいです。") if show_grammar else coach_tip(),
            [
                coach_option("スノーボードをしたいです", "スノーボードをしたいです。", "我想滑雪板。"),
                coach_option("ウェアをレンタルしたいです", "ウェアをレンタルしたいです。", "我想租雪衣。"),
                coach_option("友達と行きたいです", "友達と行きたいです。", "我想和朋友去。"),
            ],
            "ski",
            "talk_about_plans",
            "〜たいです",
        )

    if has_tired:
        return coach_result(
            "疲れたんですね。今日はゆっくり休みましょう。",
            "你累了對吧。今天好好休息吧。",
            "我有點累。",
            "少し疲れました。",
            "我有點累。",
            "",
            coach_tip("少し〜ました", "少し 表示「有點」。語氣比較柔和。", "少し疲れました。") if show_grammar else coach_tip(),
            [
                coach_option("少し疲れました", "少し疲れました。", "我有點累。"),
                coach_option("今日は早く寝ます", "今日は早く寝ます。", "我今天早點睡。"),
                coach_option("でも楽しかったです", "でも楽しかったです。", "但是很開心。"),
            ],
            "tired",
            "share_feeling",
            "少し〜ました",
        )

    return coach_result(
        "いいですね。もう少し教えてください。",
        "不錯耶。再多告訴我一點。",
        text,
        "今日は何をしましたか。",
        "今天做了什麼？",
        "",
        coach_tip(),
        [
            coach_option("今日は何をしましたか", "今日は何をしましたか。", "今天做了什麼？"),
            coach_option("何が好きですか", "何が好きですか。", "你喜歡什麼？"),
            coach_option("明日、何をしたいですか", "明日、何をしたいですか。", "明天想做什麼？"),
        ],
        "unknown",
        "continue_conversation",
        "simple_question",
    )


def build_coach_payload(model: str, message: str, history: list[dict[str, str]], settings: dict[str, Any], local_seed: dict[str, Any]) -> dict[str, Any]:
    prompt = {
        "message": message,
        "history": history,
        "settings": settings,
        "local_seed_if_relevant": local_seed,
        "rules": [
            "You are Kotoha AI Coach, a gentle but not generic Japanese practice coach for Taiwanese Traditional Chinese users.",
            "Your job is not to lecture. Understand the user's situation, then continue with one just-right simple Japanese reply.",
            "Focus only on Japanese. Explanations and translations use Traditional Chinese.",
            "coachMessage.ja must be N5-N4 level and at most 1 to 2 short sentences.",
            "Do not keep saying もう少し教えてください unless the topic is truly unknown.",
            "Never give generic nextOptions. nextOptions must match the current topic.",
            "If the user writes Chinese, understand the meaning and respond with simple Japanese.",
            "If the user writes unnatural Japanese, correct it gently. Do not say the user is wrong.",
            "Always provide userAssist.suggestedReplyJa so the user can imitate a reply.",
            "If the topic is food/full/hungry, respond about food. Example: お腹いっぱいなんですね。何を食べましたか。",
            "If the user asks you to guess what they ate, respond: 何を食べましたか。ラーメンですか。 or a similar food guess.",
            "If the topic is cats or animals, continue with cats or animals.",
            "If the topic is skiing, continue with skiing.",
            "If settings.showGrammar is false, grammarTip fields must be empty strings.",
            "If settings.showGrammar is true, give only one short grammar point.",
            "Return JSON only matching the coach schema. Do not return a Language Map Result.",
        ],
        "examples": [
            {
                "user": "我剛吃很飽",
                "coachMessage.ja": "お腹いっぱいなんですね。何を食べましたか。",
                "suggestedReplyJa": "ラーメンを食べました。",
                "nextOptions": ["ラーメンを食べました。", "ご飯を食べました。", "食べすぎました。"],
            },
            {
                "user": "你覺得我吃甚麼",
                "coachMessage.ja": "何を食べましたか。ラーメンですか。",
                "suggestedReplyJa": "ラーメンを食べました。",
                "nextOptions": ["ラーメンです。", "寿司を食べました。", "秘密です。"],
            },
            {
                "user": "猫好きです",
                "coachMessage.ja": "意味はわかります。自然に言うなら「猫が好きです」です。",
                "correction": "猫好きです → 猫が好きです",
                "nextOptions": ["犬も好きです。", "猫が大好きです。"],
            },
        ],
    }
    payload: dict[str, Any] = {
        "model": model,
        "input": [
            {"role": "developer", "content": "You produce one small Kotoha AI Coach conversation turn. Be warm, specific, and concise."},
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
        ],
        "text": {"format": {"type": "json_schema", "name": "kotoha_coach_turn", "strict": True, "schema": coach_schema()}},
        "max_output_tokens": min(OPENAI_MAX_OUTPUT_TOKENS, 1800),
    }
    if is_reasoning_model(model):
        payload["reasoning"] = {"effort": OPENAI_REASONING_EFFORT}
    return payload


def call_openai_coach(model: str, message: str, history: list[dict[str, str]], settings: dict[str, Any], local_seed: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None, "OPENAI_API_KEY is not configured"
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(build_coach_payload(model, message, history, settings, local_seed)).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            return json.loads(response.read().decode("utf-8")), None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:700]
        return None, f"{model} coach HTTP {exc.code}: {detail}"
    except (OSError, urllib.error.URLError, TimeoutError) as exc:
        return None, f"{model} coach request failed: {exc}"


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


def is_valid_coach_text(text: str) -> bool:
    if not text:
        return False
    if re.search(r"[\uac00-\ud7af]", text):
        return False
    return bool(re.search(r"[\u3040-\u30ff]", text))


def clean_coach_result(raw: Any, local_seed: dict[str, Any], settings: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(raw, dict) or int(raw.get("version") or 0) != 1:
        return None
    coach_raw = raw.get("coachMessage") if isinstance(raw.get("coachMessage"), dict) else {}
    assist_raw = raw.get("userAssist") if isinstance(raw.get("userAssist"), dict) else {}
    grammar_raw = raw.get("grammarTip") if isinstance(raw.get("grammarTip"), dict) else {}
    options_raw = raw.get("nextOptions") if isinstance(raw.get("nextOptions"), list) else []
    topic_raw = raw.get("topicState") if isinstance(raw.get("topicState"), dict) else {}
    seed_topic = str(local_seed.get("topicState", {}).get("topic") or "")
    ja = str(coach_raw.get("ja") or local_seed["coachMessage"]["ja"]).strip()
    if not is_valid_coach_text(ja):
        return None
    if seed_topic != "unknown" and "もう少し教えてください" in ja:
        return None
    options: list[dict[str, str]] = []
    for raw_option in options_raw[:3]:
        if not isinstance(raw_option, dict):
            continue
        option_ja = str(raw_option.get("ja") or "").strip()
        if not option_ja:
            continue
        options.append(coach_option(str(raw_option.get("label") or option_ja).strip(), option_ja, str(raw_option.get("zh") or "").strip()))
    if not bool(settings.get("showGrammar")):
        grammar_raw = {}
    tone = str(coach_raw.get("tone") or local_seed["coachMessage"]["tone"]).strip()
    if tone not in {"gentle", "encouraging", "corrective"}:
        tone = "gentle"
    return {
        "version": 1,
        "source": "ai",
        "coachMessage": {
            "ja": ja,
            "reading": str(coach_raw.get("reading") or "").strip(),
            "zh": str(coach_raw.get("zh") or local_seed["coachMessage"]["zh"]).strip(),
            "tone": tone,
            "speakText": str(coach_raw.get("speakText") or ja).strip(),
        },
        "userAssist": {
            "understoodAs": str(assist_raw.get("understoodAs") or local_seed["userAssist"]["understoodAs"]).strip(),
            "suggestedReplyJa": str(assist_raw.get("suggestedReplyJa") or local_seed["userAssist"]["suggestedReplyJa"]).strip(),
            "suggestedReplyZh": str(assist_raw.get("suggestedReplyZh") or local_seed["userAssist"]["suggestedReplyZh"]).strip(),
            "correction": str(assist_raw.get("correction") or "").strip(),
            "encouragement": str(assist_raw.get("encouragement") or local_seed["userAssist"]["encouragement"]).strip(),
        },
        "grammarTip": {
            "title": str(grammar_raw.get("title") or "").strip(),
            "body": str(grammar_raw.get("body") or "").strip(),
            "example": str(grammar_raw.get("example") or "").strip(),
        },
        "nextOptions": options or local_seed["nextOptions"],
        "topicState": {
            "topic": str(topic_raw.get("topic") or seed_topic).strip(),
            "detectedIntent": str(topic_raw.get("detectedIntent") or local_seed.get("topicState", {}).get("detectedIntent") or "").strip(),
            "recommendedPattern": str(topic_raw.get("recommendedPattern") or local_seed.get("topicState", {}).get("recommendedPattern") or "").strip(),
        },
    }


def ai_coach(message: str, history: list[dict[str, str]], settings: dict[str, Any], local_seed: dict[str, Any]) -> dict[str, Any] | None:
    last_error: str | None = None
    for model in model_candidates():
        data, error = call_openai_coach(model, message, history, settings, local_seed)
        if error:
            last_error = error
            continue
        output_text = extract_output_text(data or {})
        if not output_text:
            last_error = f"{model} coach returned no output text"
            continue
        try:
            parsed = json.loads(output_text)
        except json.JSONDecodeError as exc:
            last_error = f"{model} coach returned non-JSON text: {exc}"
            continue
        result = clean_coach_result(parsed, local_seed, settings)
        if result:
            result["model"] = model
            return result
        last_error = f"{model} coach returned no usable turn"
    if last_error:
        print(f"OpenAI coach failed: {last_error}", file=sys.stderr, flush=True)
    return None


def handle_coach(handler: Any) -> None:
    try:
        body = handler.rfile.read(int(handler.headers.get("Content-Length", "0") or 0))
        payload = json.loads(body.decode("utf-8")) if body else {}
    except Exception:
        handler.send_error(400, "Invalid JSON")
        return
    message = str(payload.get("message") or "").strip()
    history = clean_coach_history(payload.get("history"))
    settings = clean_coach_settings(payload.get("settings"))
    if not message:
        message = "今日は何をしましたか。"
    local_seed = local_coach_result(message, settings)
    result = ai_coach(message, history, settings, local_seed)
    handler.send_json(result or local_seed)


def install(handler_class: type[Any]) -> None:
    if getattr(handler_class, "_kotoha_official_coach", False):
        return
    original_do_get = handler_class.do_GET
    original_do_post = handler_class.do_POST

    def do_GET(self: Any) -> None:
        if self.path == "/api/health":
            self.send_json({"ok": True, "ai_enabled": bool(os.environ.get("OPENAI_API_KEY")), "model": os.environ.get("OPENAI_MODEL", DEFAULT_MODEL), "version": APP_VERSION})
            return
        original_do_get(self)

    def do_POST(self: Any) -> None:
        if self.path == "/api/coach":
            handle_coach(self)
            return
        original_do_post(self)

    handler_class.do_GET = do_GET
    handler_class.do_POST = do_POST
    handler_class._kotoha_official_coach = True
