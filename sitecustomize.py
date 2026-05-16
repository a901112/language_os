from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any
import http.server

APP_VERSION = "2026-05-16-kotoha-coach-api-fix"
DEFAULT_MODEL = "gpt-5"

if not os.environ.get("OPENAI_MODEL") or "mini" in os.environ.get("OPENAI_MODEL", "").lower():
    os.environ["OPENAI_MODEL"] = DEFAULT_MODEL
os.environ.setdefault("OPENAI_REASONING_EFFORT", "medium")
os.environ.setdefault("OPENAI_MAX_OUTPUT_TOKENS", "3600")
os.environ.setdefault("OPENAI_ALLOW_MINI_FALLBACK", "0")


def normalize(text: str) -> str:
    ignored = set(" \t\r\n，。！？!?、,.「」『』（）()")
    return "".join(ch for ch in text.casefold() if ch not in ignored)


def coach_option(label: str, ja: str, zh: str) -> dict[str, str]:
    return {"label": label, "ja": ja, "zh": zh}


def topic_state(topic: str, detected_intent: str, recommended_pattern: str) -> dict[str, str]:
    return {"topic": topic, "detectedIntent": detected_intent, "recommendedPattern": recommended_pattern}


def clean_settings(raw: Any) -> dict[str, Any]:
    settings = raw if isinstance(raw, dict) else {}
    return {"showTranslation": bool(settings.get("showTranslation", True)), "showGrammar": bool(settings.get("showGrammar", False)), "level": "beginner"}


def clean_history(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    cleaned: list[dict[str, str]] = []
    for item in raw[-8:]:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip()
        if role not in {"user", "coach"}:
            continue
        cleaned.append({"role": role, "text": str(item.get("text") or "").strip()[:400], "ja": str(item.get("ja") or "").strip()[:400], "zh": str(item.get("zh") or "").strip()[:400]})
    return cleaned


def local_coach_fallback(message: str, settings: dict[str, Any]) -> dict[str, Any]:
    normalized = normalize(message)
    show_grammar = bool(settings.get("showGrammar"))
    food_terms = ["吃", "飽", "餓", "飯", "拉麵", "壽司", "食べ", "食べました", "お腹", "ご飯", "ラーメン", "寿司"]
    guess_terms = ["你覺得", "覺得", "猜", "你猜", "と思う", "と思います", "何だと思う"]
    tired_terms = ["累", "疲れ", "しんどい", "疲勞"]
    is_food = any(term in message or term in normalized for term in food_terms)
    is_guess = any(term in message or term in normalized for term in guess_terms)
    if is_guess and is_food:
        return {"version": 1, "source": "local", "coachMessage": {"ja": "何を食べましたか。ラーメンですか。", "reading": "", "zh": "你吃了什麼呢？是拉麵嗎？", "tone": "gentle", "speakText": "何を食べましたか。ラーメンですか。"}, "userAssist": {"understoodAs": "你想讓教練猜猜你吃了什麼。", "suggestedReplyJa": "ラーメンを食べました。", "suggestedReplyZh": "我吃了拉麵。", "correction": "", "encouragement": "這樣就可以自然接食物話題。"}, "grammarTip": {"title": "〜を食べました", "body": "表示「吃了～」。食物後面常接 を。", "example": "ラーメンを食べました。"} if show_grammar else {"title": "", "body": "", "example": ""}, "nextOptions": [coach_option("ラーメンです", "ラーメンです。", "是拉麵。"), coach_option("寿司を食べました", "寿司を食べました。", "我吃了壽司。"), coach_option("秘密です", "秘密です。", "是秘密。")], "topicState": topic_state("food", "guess_food", "〜を食べました")}
    if is_food:
        return {"version": 1, "source": "local", "coachMessage": {"ja": "お腹いっぱいなんですね。何を食べましたか。", "reading": "", "zh": "你吃得很飽對吧。你吃了什麼？", "tone": "gentle", "speakText": "お腹いっぱいなんですね。何を食べましたか。"}, "userAssist": {"understoodAs": "我剛吃得很飽。", "suggestedReplyJa": "ラーメンを食べました。", "suggestedReplyZh": "我吃了拉麵。", "correction": "", "encouragement": "先用一個食物名，就能把對話接下去。"}, "grammarTip": {"title": "〜を食べました", "body": "表示「吃了～」。食物後面常接 を。", "example": "ラーメンを食べました。"} if show_grammar else {"title": "", "body": "", "example": ""}, "nextOptions": [coach_option("ラーメンを食べました", "ラーメンを食べました。", "我吃了拉麵。"), coach_option("ご飯を食べました", "ご飯を食べました。", "我吃了飯。"), coach_option("食べすぎました", "食べすぎました。", "我吃太多了。")], "topicState": topic_state("food", "share_food", "〜を食べました")}
    if is_guess:
        return {"version": 1, "source": "local", "coachMessage": {"ja": "何だと思いますか。ヒントをください。", "reading": "", "zh": "你覺得是什麼呢？給我一點提示。", "tone": "gentle", "speakText": "何だと思いますか。ヒントをください。"}, "userAssist": {"understoodAs": "你想讓教練猜一猜。", "suggestedReplyJa": "ヒントは食べ物です。", "suggestedReplyZh": "提示是食物。", "correction": "", "encouragement": "這句可以很輕鬆地把遊戲感接起來。"}, "grammarTip": {"title": "〜と思います", "body": "表示「我覺得～」。猜測時很常用。", "example": "何だと思いますか。"} if show_grammar else {"title": "", "body": "", "example": ""}, "nextOptions": [coach_option("ヒントをください", "ヒントをください。", "請給我提示。"), coach_option("食べ物です", "食べ物です。", "是食物。"), coach_option("秘密です", "秘密です。", "是秘密。")], "topicState": topic_state("guess", "ask_guess", "〜と思います")}
    if any(key in message for key in ["貓", "猫", "ねこ"]):
        corrective = "猫好き" in message and "猫が好き" not in message
        return {"version": 1, "source": "local", "coachMessage": {"ja": "意味はわかります。自然に言うなら「猫が好きです」です。" if corrective else "いいですね。猫が好きなんですね。", "reading": "", "zh": "意思懂。自然一點可以說「猫が好きです」。" if corrective else "很好耶。你喜歡貓對吧。", "tone": "corrective" if corrective else "encouraging", "speakText": "意味はわかります。自然に言うなら、猫が好きです、です。" if corrective else "いいですね。猫が好きなんですね。"}, "userAssist": {"understoodAs": "我喜歡貓。", "suggestedReplyJa": "猫が好きです。" if corrective else "はい、猫が好きです。", "suggestedReplyZh": "我喜歡貓。" if corrective else "是的，我喜歡貓。", "correction": "猫好きです → 猫が好きです" if corrective else "", "encouragement": "這句已經能讓人懂，補上 が 會更自然。" if corrective else "很好，先用這句就能自然接話。"}, "grammarTip": {"title": "〜が好きです", "body": "喜歡的對象通常用 が。", "example": "猫が好きです。"} if show_grammar else {"title": "", "body": "", "example": ""}, "nextOptions": [coach_option("犬も好きです", "犬も好きです。", "我也喜歡狗。"), coach_option("猫を飼っています", "猫を飼っています。", "我有養貓。"), coach_option("動物が好きです", "動物が好きです。", "我喜歡動物。")], "topicState": topic_state("animal", "talk_about_likes", "〜が好きです")}
    if any(key in normalized for key in ["滑雪", "スキー", "snowboard", "snow"]):
        return {"version": 1, "source": "local", "coachMessage": {"ja": "いいですね。明日、スキー場に行きたいんですね。", "reading": "", "zh": "不錯耶。你明天想去滑雪場對吧。", "tone": "encouraging", "speakText": "いいですね。明日、スキー場に行きたいんですね。"}, "userAssist": {"understoodAs": "我明天想去滑雪。", "suggestedReplyJa": "はい、明日スキー場に行きたいです。", "suggestedReplyZh": "是的，我明天想去滑雪場。", "correction": "", "encouragement": "這個話題很適合練 〜たいです。"}, "grammarTip": {"title": "〜たいです", "body": "表示「想做某事」。", "example": "行きたいです。"} if show_grammar else {"title": "", "body": "", "example": ""}, "nextOptions": [coach_option("スノーボードをしたいです", "スノーボードをしたいです。", "我想滑雪板。"), coach_option("ウェアをレンタルしたいです", "ウェアをレンタルしたいです。", "我想租雪衣。"), coach_option("友達と行きたいです", "友達と行きたいです。", "我想和朋友去。")], "topicState": topic_state("ski", "talk_about_plans", "〜たいです")}
    if any(term in message or term in normalized for term in tired_terms):
        return {"version": 1, "source": "local", "coachMessage": {"ja": "疲れたんですね。今日はゆっくり休みましょう。", "reading": "", "zh": "你累了對吧。今天好好休息吧。", "tone": "gentle", "speakText": "疲れたんですね。今日はゆっくり休みましょう。"}, "userAssist": {"understoodAs": "我有點累。", "suggestedReplyJa": "少し疲れました。", "suggestedReplyZh": "我有點累。", "correction": "", "encouragement": "這句很自然，也很適合日常對話。"}, "grammarTip": {"title": "少し〜ました", "body": "少し 表示「有點」。可以讓語氣更柔和。", "example": "少し疲れました。"} if show_grammar else {"title": "", "body": "", "example": ""}, "nextOptions": [coach_option("少し疲れました", "少し疲れました。", "我有點累。"), coach_option("今日は早く寝ます", "今日は早く寝ます。", "我今天早點睡。"), coach_option("でも楽しかったです", "でも楽しかったです。", "但是很開心。")], "topicState": topic_state("tired", "share_feeling", "少し〜ました")}
    return {"version": 1, "source": "local", "coachMessage": {"ja": "いいですね。もう少し教えてください。", "reading": "", "zh": "不錯耶。再多告訴我一點。", "tone": "gentle", "speakText": "いいですね。もう少し教えてください。"}, "userAssist": {"understoodAs": message, "suggestedReplyJa": "今日は何をしましたか。", "suggestedReplyZh": "今天做了什麼？", "correction": "", "encouragement": "先用很短的一句也可以。"}, "grammarTip": {"title": "", "body": "", "example": ""}, "nextOptions": [coach_option("今日は何をしましたか", "今日は何をしましたか。", "今天做了什麼？"), coach_option("何が好きですか", "何が好きですか。", "你喜歡什麼？"), coach_option("明日、何をしたいですか", "明日、何をしたいですか。", "明天想做什麼？")], "topicState": topic_state("unknown", "continue_conversation", "simple_question")}


def coach_schema() -> dict[str, Any]:
    return {"type": "object", "additionalProperties": False, "required": ["version", "source", "coachMessage", "userAssist", "grammarTip", "nextOptions", "topicState"], "properties": {"version": {"type": "integer"}, "source": {"type": "string", "enum": ["ai", "local"]}, "coachMessage": {"type": "object", "additionalProperties": False, "required": ["ja", "reading", "zh", "tone", "speakText"], "properties": {"ja": {"type": "string"}, "reading": {"type": "string"}, "zh": {"type": "string"}, "tone": {"type": "string", "enum": ["gentle", "encouraging", "corrective"]}, "speakText": {"type": "string"}}}, "userAssist": {"type": "object", "additionalProperties": False, "required": ["understoodAs", "suggestedReplyJa", "suggestedReplyZh", "correction", "encouragement"], "properties": {"understoodAs": {"type": "string"}, "suggestedReplyJa": {"type": "string"}, "suggestedReplyZh": {"type": "string"}, "correction": {"type": "string"}, "encouragement": {"type": "string"}}}, "grammarTip": {"type": "object", "additionalProperties": False, "required": ["title", "body", "example"], "properties": {"title": {"type": "string"}, "body": {"type": "string"}, "example": {"type": "string"}}}, "nextOptions": {"type": "array", "maxItems": 3, "items": {"type": "object", "additionalProperties": False, "required": ["label", "ja", "zh"], "properties": {"label": {"type": "string"}, "ja": {"type": "string"}, "zh": {"type": "string"}}}}, "topicState": {"type": "object", "additionalProperties": False, "required": ["topic", "detectedIntent", "recommendedPattern"], "properties": {"topic": {"type": "string"}, "detectedIntent": {"type": "string"}, "recommendedPattern": {"type": "string"}}}}}


def is_reasoning_model(model: str) -> bool:
    return model.startswith("gpt-5") or model.startswith("o1") or model.startswith("o3") or model.startswith("o4")


def model_candidates() -> list[str]:
    configured = (os.environ.get("OPENAI_MODEL") or DEFAULT_MODEL).strip() or DEFAULT_MODEL
    fallbacks = ["gpt-4.1", "gpt-5-mini", "gpt-4o-mini"] if os.environ.get("OPENAI_ALLOW_MINI_FALLBACK") == "1" else ["gpt-4.1"]
    models: list[str] = []
    for model in [configured, *fallbacks]:
        if model and model not in models:
            models.append(model)
    return models


def build_coach_payload(model: str, message: str, history: list[dict[str, str]], settings: dict[str, Any], local_seed: dict[str, Any]) -> dict[str, Any]:
    prompt = {"message": message, "history": history, "settings": settings, "local_seed_if_relevant": local_seed, "rules": ["你是 Kotoha AI Coach，一位溫柔但不笨的日文陪練教練。使用者是台灣繁中使用者，日文初學。", "你的目標不是講課，而是根據使用者輸入，用簡單日文自然接話，幫他慢慢敢開口。", "你必須先理解使用者輸入背後的情境，再回一句剛剛好的日文。", "只專攻日文。說明和翻譯用繁體中文。", "coachMessage.ja 最多 1 到 2 句，日文程度 N5-N4。", "不要一直回「もう少し教えてください」。不要泛用回覆，必須根據使用者內容接話。", "如果使用者輸入中文，要理解意思，轉成簡單日文回應。", "如果使用者輸入日文且不自然，要溫柔修正，不要說「錯了」。", "每次都要提供 userAssist.suggestedReplyJa，讓使用者可以模仿。", "nextOptions 必須跟話題相關，不可以永遠是泛用選項。", "如果使用者在講吃飯、很飽、食物，教練要接食物話題。", "如果使用者在問「你覺得我吃什麼」，教練要用簡單日文猜或反問，不要泛用。", "如果使用者說「我剛吃很飽」，自然接：お腹いっぱいなんですね。何を食べましたか。", "如果使用者說「你覺得我吃甚麼」，自然接：何を食べましたか。ラーメンですか。", "如果使用者說「我喜歡貓」，自然接貓或動物話題。", "如果使用者說「猫好きです」，自然接：意味はわかります。自然に言うなら「猫が好きです」です。", "如果使用者說滑雪，接滑雪話題。", "settings.showGrammar = false 時，grammarTip 必須是空字串。", "settings.showGrammar = true 時，只給一個短文法點，不能長篇。", "不要像客服機器人。不要像字典。不要像考試。要像一個溫柔的日文陪練。", "topicState.topic 要填目前話題，例如 food、animal、ski、tired、guess、unknown。", "topicState.detectedIntent 要填使用者意圖，例如 share_food、guess_food、talk_about_likes、correct_sentence。", "topicState.recommendedPattern 要填這輪最適合練的句型，例如 〜を食べました、〜が好きです、〜たいです。", "Return JSON only matching the coach schema. Do not return a Language Map Result."], "examples": [{"user": "我剛吃很飽", "coachMessage.ja": "お腹いっぱいなんですね。何を食べましたか。", "suggestedReplyJa": "ラーメンを食べました。", "nextOptions": ["ラーメンを食べました。", "ご飯を食べました。", "食べすぎました。"]}, {"user": "你覺得我吃甚麼", "coachMessage.ja": "何を食べましたか。ラーメンですか。", "suggestedReplyJa": "ラーメンを食べました。", "nextOptions": ["ラーメンです。", "寿司を食べました。", "秘密です。"]}, {"user": "猫好きです", "coachMessage.ja": "意味はわかります。自然に言うなら「猫が好きです」です。", "correction": "猫好きです → 猫が好きです", "nextOptions": ["犬も好きです。", "猫が大好きです。"]}]}
    payload: dict[str, Any] = {"model": model, "input": [{"role": "developer", "content": "You produce one small Kotoha AI Coach conversation turn."}, {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)}], "text": {"format": {"type": "json_schema", "name": "kotoha_coach_turn", "strict": True, "schema": coach_schema()}}, "max_output_tokens": min(int(os.environ.get("OPENAI_MAX_OUTPUT_TOKENS", "3600")), 1800)}
    if is_reasoning_model(model):
        payload["reasoning"] = {"effort": os.environ.get("OPENAI_REASONING_EFFORT", "medium")}
    return payload


def extract_output_text(data: dict[str, Any]) -> str:
    texts: list[str] = []
    for item in data.get("output", []) if isinstance(data.get("output"), list) else []:
        if not isinstance(item, dict):
            continue
        if item.get("type") == "message":
            for content in item.get("content", []) if isinstance(item.get("content"), list) else []:
                if isinstance(content, dict) and content.get("type") in {"output_text", "text"}:
                    texts.append(str(content.get("text") or ""))
        elif item.get("type") == "output_text":
            texts.append(str(item.get("text") or ""))
    return "\n".join(text for text in texts if text).strip()


def clean_coach_result(raw: Any, local_seed: dict[str, Any], settings: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(raw, dict) or int(raw.get("version") or 0) != 1:
        return None
    coach_raw = raw.get("coachMessage") if isinstance(raw.get("coachMessage"), dict) else {}
    assist_raw = raw.get("userAssist") if isinstance(raw.get("userAssist"), dict) else {}
    grammar_raw = raw.get("grammarTip") if isinstance(raw.get("grammarTip"), dict) else {}
    options_raw = raw.get("nextOptions") if isinstance(raw.get("nextOptions"), list) else []
    topic_raw = raw.get("topicState") if isinstance(raw.get("topicState"), dict) else {}
    seed = local_seed
    ja = str(coach_raw.get("ja") or seed["coachMessage"]["ja"]).strip()
    options = []
    for option in options_raw[:3]:
        if isinstance(option, dict) and str(option.get("ja") or "").strip():
            option_ja = str(option.get("ja") or "").strip()
            options.append(coach_option(str(option.get("label") or option_ja).strip(), option_ja, str(option.get("zh") or "").strip()))
    if not settings.get("showGrammar"):
        grammar_raw = {}
    return {"version": 1, "source": "ai", "coachMessage": {"ja": ja, "reading": str(coach_raw.get("reading") or "").strip(), "zh": str(coach_raw.get("zh") or seed["coachMessage"]["zh"]).strip(), "tone": str(coach_raw.get("tone") or "gentle").strip() if str(coach_raw.get("tone") or "gentle").strip() in {"gentle", "encouraging", "corrective"} else "gentle", "speakText": str(coach_raw.get("speakText") or ja).strip()}, "userAssist": {"understoodAs": str(assist_raw.get("understoodAs") or seed["userAssist"]["understoodAs"]).strip(), "suggestedReplyJa": str(assist_raw.get("suggestedReplyJa") or seed["userAssist"]["suggestedReplyJa"]).strip(), "suggestedReplyZh": str(assist_raw.get("suggestedReplyZh") or seed["userAssist"]["suggestedReplyZh"]).strip(), "correction": str(assist_raw.get("correction") or "").strip(), "encouragement": str(assist_raw.get("encouragement") or seed["userAssist"]["encouragement"]).strip()}, "grammarTip": {"title": str(grammar_raw.get("title") or "").strip(), "body": str(grammar_raw.get("body") or "").strip(), "example": str(grammar_raw.get("example") or "").strip()}, "nextOptions": options or seed["nextOptions"], "topicState": {"topic": str(topic_raw.get("topic") or seed["topicState"]["topic"]).strip(), "detectedIntent": str(topic_raw.get("detectedIntent") or seed["topicState"]["detectedIntent"]).strip(), "recommendedPattern": str(topic_raw.get("recommendedPattern") or seed["topicState"]["recommendedPattern"]).strip()}}


def ai_coach(message: str, history: list[dict[str, str]], settings: dict[str, Any], local_seed: dict[str, Any]) -> dict[str, Any] | None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None
    last_error: str | None = None
    for model in model_candidates():
        request = urllib.request.Request("https://api.openai.com/v1/responses", data=json.dumps(build_coach_payload(model, message, history, settings, local_seed)).encode("utf-8"), headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json; charset=utf-8"}, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=35) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            last_error = f"{model} coach HTTP {exc.code}: {exc.read().decode('utf-8', errors='replace')[:500]}"
            continue
        except (OSError, urllib.error.URLError, TimeoutError) as exc:
            last_error = f"{model} coach request failed: {exc}"
            continue
        output_text = extract_output_text(data)
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


def handle_coach(handler: http.server.SimpleHTTPRequestHandler) -> None:
    try:
        body = handler.rfile.read(int(handler.headers.get("Content-Length", "0") or 0))
        payload = json.loads(body.decode("utf-8"))
    except Exception:
        handler.send_error(400, "Invalid JSON")
        return
    message = str(payload.get("message") or "").strip() or "今日は何をしましたか。"
    history = clean_history(payload.get("history"))
    settings = clean_settings(payload.get("settings"))
    local_seed = local_coach_fallback(message, settings)
    result = ai_coach(message, history, settings, local_seed)
    handler.send_json(result or local_seed)  # type: ignore[attr-defined]


def patch_main_module() -> None:
    main_module = sys.modules.get("__main__")
    if not main_module:
        return
    setattr(main_module, "APP_VERSION", APP_VERSION)
    setattr(main_module, "DEFAULT_MODEL", DEFAULT_MODEL)
    setattr(main_module, "MODEL_FALLBACKS", ["gpt-4.1", "gpt-5-mini", "gpt-4o-mini"] if os.environ.get("OPENAI_ALLOW_MINI_FALLBACK") == "1" else ["gpt-4.1"])
    build_payload = getattr(main_module, "build_ai_payload", None)
    if build_payload and not getattr(build_payload, "_kotoha_model_patch", False):
        def wrapped_build_ai_payload(model: str, *args: Any, **kwargs: Any) -> dict[str, Any]:
            payload = build_payload(model, *args, **kwargs)
            payload["max_output_tokens"] = int(os.environ.get("OPENAI_MAX_OUTPUT_TOKENS", "3600"))
            if is_reasoning_model(model):
                payload["reasoning"] = {"effort": os.environ.get("OPENAI_REASONING_EFFORT", "medium")}
            return payload
        wrapped_build_ai_payload._kotoha_model_patch = True  # type: ignore[attr-defined]
        setattr(main_module, "build_ai_payload", wrapped_build_ai_payload)


def patch_handler(handler_class: type[http.server.SimpleHTTPRequestHandler]) -> None:
    if getattr(handler_class, "_kotoha_coach_patched", False):
        return
    original_do_post = handler_class.do_POST
    original_do_get = handler_class.do_GET
    def do_POST(self: http.server.SimpleHTTPRequestHandler) -> None:
        if self.path == "/api/coach":
            handle_coach(self)
            return
        original_do_post(self)
    def do_GET(self: http.server.SimpleHTTPRequestHandler) -> None:
        if self.path == "/api/health":
            self.send_json({"ok": True, "ai_enabled": bool(os.environ.get("OPENAI_API_KEY")), "model": os.environ.get("OPENAI_MODEL", DEFAULT_MODEL), "version": APP_VERSION})  # type: ignore[attr-defined]
            return
        original_do_get(self)
    handler_class.do_POST = do_POST  # type: ignore[method-assign]
    handler_class.do_GET = do_GET  # type: ignore[method-assign]
    handler_class._kotoha_coach_patched = True  # type: ignore[attr-defined]


if not getattr(http.server.ThreadingHTTPServer, "_kotoha_coach_server_patched", False):
    _original_serve_forever = http.server.ThreadingHTTPServer.serve_forever
    def serve_forever(self: http.server.ThreadingHTTPServer, *args: Any, **kwargs: Any) -> Any:
        patch_main_module()
        patch_handler(self.RequestHandlerClass)
        return _original_serve_forever(self, *args, **kwargs)
    http.server.ThreadingHTTPServer.serve_forever = serve_forever  # type: ignore[method-assign]
    http.server.ThreadingHTTPServer._kotoha_coach_server_patched = True  # type: ignore[attr-defined]
