from __future__ import annotations

import json
import os
import re
import urllib.request
from typing import Any
import http.server

APP_VERSION = "2026-05-16-kotoha-coach-api-fix"
DEFAULT_MODEL = "gpt-5"
if not os.environ.get("OPENAI_MODEL") or "mini" in os.environ.get("OPENAI_MODEL", "").lower():
    os.environ["OPENAI_MODEL"] = DEFAULT_MODEL


def send_json(handler: http.server.SimpleHTTPRequestHandler, payload: dict[str, Any]) -> None:
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(200)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(raw)))
    handler.end_headers()
    handler.wfile.write(raw)


def option(label: str, ja: str, zh: str) -> dict[str, str]:
    return {"label": label, "ja": ja, "zh": zh}


def tip(title: str = "", body: str = "", example: str = "") -> dict[str, str]:
    return {"title": title, "body": body, "example": example}


def result(ja: str, zh: str, understood: str, suggested_ja: str, suggested_zh: str, correction: str, grammar_tip: dict[str, str], next_options: list[dict[str, str]], topic: str, intent: str, pattern: str) -> dict[str, Any]:
    return {
        "version": 1,
        "source": "local",
        "coachMessage": {"ja": ja, "reading": "", "zh": zh, "tone": "corrective" if correction else "gentle", "speakText": ja},
        "userAssist": {"understoodAs": understood, "suggestedReplyJa": suggested_ja, "suggestedReplyZh": suggested_zh, "correction": correction, "encouragement": "這樣回就很自然。"},
        "grammarTip": grammar_tip,
        "nextOptions": next_options[:3],
        "topicState": {"topic": topic, "detectedIntent": intent, "recommendedPattern": pattern},
    }


def clean_settings(raw: Any) -> dict[str, Any]:
    settings = raw if isinstance(raw, dict) else {}
    return {"showTranslation": bool(settings.get("showTranslation", True)), "showGrammar": bool(settings.get("showGrammar", False)), "level": "beginner"}


def local_coach(message: str, settings: dict[str, Any]) -> dict[str, Any]:
    show_grammar = bool(settings.get("showGrammar"))
    text = str(message or "")
    lower = text.lower()
    has_food = bool(re.search(r"吃|飽|餓|飯|拉麵|壽司|食べ|お腹|ご飯|ラーメン|寿司", text))
    has_guess = bool(re.search(r"你覺得|覺得|猜|你猜|と思う|と思います|何だと思う", text))
    has_cat = bool(re.search(r"貓|猫|ねこ", text))
    has_ski = bool(re.search(r"滑雪|スキー|snowboard|snow", lower))
    has_tired = bool(re.search(r"累|疲れ|しんどい|疲勞", text))

    if has_guess and has_food:
        return result(
            "何を食べましたか。ラーメンですか。",
            "你吃了什麼呢？是拉麵嗎？",
            "你想讓教練猜猜你吃了什麼。",
            "ラーメンを食べました。",
            "我吃了拉麵。",
            "",
            tip("〜を食べました", "表示「吃了～」。食物後面常接 を。", "ラーメンを食べました。") if show_grammar else tip(),
            [option("ラーメンです", "ラーメンです。", "是拉麵。"), option("寿司を食べました", "寿司を食べました。", "我吃了壽司。"), option("秘密です", "秘密です。", "是秘密。")],
            "food", "guess_food", "〜を食べました",
        )

    if has_food:
        return result(
            "お腹いっぱいなんですね。何を食べましたか。",
            "你吃得很飽對吧。你吃了什麼？",
            "我剛吃得很飽。",
            "ラーメンを食べました。",
            "我吃了拉麵。",
            "",
            tip("〜を食べました", "表示「吃了～」。食物後面常接 を。", "ラーメンを食べました。") if show_grammar else tip(),
            [option("ラーメンを食べました", "ラーメンを食べました。", "我吃了拉麵。"), option("ご飯を食べました", "ご飯を食べました。", "我吃了飯。"), option("食べすぎました", "食べすぎました。", "我吃太多了。")],
            "food", "share_food", "〜を食べました",
        )

    if has_cat:
        corrective = "猫好き" in text and "猫が好き" not in text
        return result(
            "意味はわかります。自然に言うなら「猫が好きです」です。" if corrective else "いいですね。猫が好きなんですね。",
            "意思懂。自然一點可以說「猫が好きです」。" if corrective else "很好耶。你喜歡貓對吧。",
            "我喜歡貓。",
            "猫が好きです。" if corrective else "はい、猫が好きです。",
            "我喜歡貓。" if corrective else "是的，我喜歡貓。",
            "猫好きです → 猫が好きです" if corrective else "",
            tip("〜が好きです", "喜歡的對象通常用 が。", "猫が好きです。") if show_grammar else tip(),
            [option("犬も好きです", "犬も好きです。", "我也喜歡狗。"), option("猫を飼っています", "猫を飼っています。", "我有養貓。"), option("動物が好きです", "動物が好きです。", "我喜歡動物。")],
            "animal", "correct_sentence" if corrective else "talk_about_likes", "〜が好きです",
        )

    if has_ski:
        return result(
            "いいですね。明日、スキー場に行きたいんですね。",
            "不錯耶。你明天想去滑雪場對吧。",
            "我明天想去滑雪。",
            "はい、明日スキー場に行きたいです。",
            "是的，我明天想去滑雪場。",
            "",
            tip("〜たいです", "表示「想做某事」。", "行きたいです。") if show_grammar else tip(),
            [option("スノーボードをしたいです", "スノーボードをしたいです。", "我想滑雪板。"), option("ウェアをレンタルしたいです", "ウェアをレンタルしたいです。", "我想租雪衣。"), option("友達と行きたいです", "友達と行きたいです。", "我想和朋友去。")],
            "ski", "talk_about_plans", "〜たいです",
        )

    if has_tired:
        return result(
            "疲れたんですね。今日はゆっくり休みましょう。",
            "你累了對吧。今天好好休息吧。",
            "我有點累。",
            "少し疲れました。",
            "我有點累。",
            "",
            tip("少し〜ました", "少し 表示「有點」。語氣比較柔和。", "少し疲れました。") if show_grammar else tip(),
            [option("少し疲れました", "少し疲れました。", "我有點累。"), option("今日は早く寝ます", "今日は早く寝ます。", "我今天早點睡。"), option("でも楽しかったです", "でも楽しかったです。", "但是很開心。")],
            "tired", "share_feeling", "少し〜ました",
        )

    return result(
        "いいですね。もう少し教えてください。",
        "不錯耶。再多告訴我一點。",
        text,
        "今日は何をしましたか。",
        "今天做了什麼？",
        "",
        tip(),
        [option("今日は何をしましたか", "今日は何をしましたか。", "今天做了什麼？"), option("何が好きですか", "何が好きですか。", "你喜歡什麼？"), option("明日、何をしたいですか", "明日、何をしたいですか。", "明天想做什麼？")],
        "unknown", "continue_conversation", "simple_question",
    )


def handle_coach(handler: http.server.SimpleHTTPRequestHandler) -> None:
    try:
        body = handler.rfile.read(int(handler.headers.get("Content-Length", "0") or 0))
        payload = json.loads(body.decode("utf-8")) if body else {}
    except Exception:
        handler.send_error(400, "Invalid JSON")
        return
    message = str(payload.get("message") or "").strip() or "今日は何をしましたか。"
    settings = clean_settings(payload.get("settings"))
    send_json(handler, local_coach(message, settings))


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
            send_json(self, {"ok": True, "ai_enabled": bool(os.environ.get("OPENAI_API_KEY")), "model": os.environ.get("OPENAI_MODEL", DEFAULT_MODEL), "version": APP_VERSION})
            return
        original_do_get(self)

    handler_class.do_POST = do_POST  # type: ignore[method-assign]
    handler_class.do_GET = do_GET  # type: ignore[method-assign]
    handler_class._kotoha_coach_patched = True  # type: ignore[attr-defined]


if not getattr(http.server.ThreadingHTTPServer, "_kotoha_coach_server_patched", False):
    _original_serve_forever = http.server.ThreadingHTTPServer.serve_forever

    def serve_forever(self: http.server.ThreadingHTTPServer, *args: Any, **kwargs: Any) -> Any:
        patch_handler(self.RequestHandlerClass)
        return _original_serve_forever(self, *args, **kwargs)

    http.server.ThreadingHTTPServer.serve_forever = serve_forever  # type: ignore[method-assign]
    http.server.ThreadingHTTPServer._kotoha_coach_server_patched = True  # type: ignore[attr-defined]
