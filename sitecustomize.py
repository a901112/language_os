from __future__ import annotations

import json
import os
import re
import http.server
from typing import Any

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
    has_food = bool(re.search(r"吃|飽|餓|飯|拉麵|壽司|\u98df\u3079|\u304a\u8179|\u3054\u98ef|\u30e9\u30fc\u30e1\u30f3|\u5bff\u53f8", text))
    has_guess = bool(re.search(r"你覺得|覺得|猜|你猜|\u3068\u601d\u3046|\u3068\u601d\u3044\u307e\u3059|\u4f55\u3060\u3068\u601d\u3046", text))
    has_cat = bool(re.search(r"貓|\u732b|\u306d\u3053", text))
    has_ski = bool(re.search(r"滑雪|\u30b9\u30ad\u30fc|snowboard|snow", lower))
    has_tired = bool(re.search(r"累|\u75b2\u308c|\u3057\u3093\u3069\u3044|疲勞", text))

    if has_guess and has_food:
        return result(
            "\u4f55\u3092\u98df\u3079\u307e\u3057\u305f\u304b\u3002\u30e9\u30fc\u30e1\u30f3\u3067\u3059\u304b\u3002",
            "你吃了什麼呢？是拉麵嗎？",
            "你想讓教練猜猜你吃了什麼。",
            "\u30e9\u30fc\u30e1\u30f3\u3092\u98df\u3079\u307e\u3057\u305f\u3002",
            "我吃了拉麵。",
            "",
            tip("\u301c\u3092\u98df\u3079\u307e\u3057\u305f", "表示「吃了～」。食物後面常接 を。", "\u30e9\u30fc\u30e1\u30f3\u3092\u98df\u3079\u307e\u3057\u305f\u3002") if show_grammar else tip(),
            [option("\u30e9\u30fc\u30e1\u30f3\u3067\u3059", "\u30e9\u30fc\u30e1\u30f3\u3067\u3059\u3002", "是拉麵。"), option("\u5bff\u53f8\u3092\u98df\u3079\u307e\u3057\u305f", "\u5bff\u53f8\u3092\u98df\u3079\u307e\u3057\u305f\u3002", "我吃了壽司。"), option("\u79d8\u5bc6\u3067\u3059", "\u79d8\u5bc6\u3067\u3059\u3002", "是秘密。")],
            "food", "guess_food", "\u301c\u3092\u98df\u3079\u307e\u3057\u305f",
        )

    if has_food:
        return result(
            "\u304a\u8179\u3044\u3063\u3071\u3044\u306a\u3093\u3067\u3059\u306d\u3002\u4f55\u3092\u98df\u3079\u307e\u3057\u305f\u304b\u3002",
            "你吃得很飽對吧。你吃了什麼？",
            "我剛吃得很飽。",
            "\u30e9\u30fc\u30e1\u30f3\u3092\u98df\u3079\u307e\u3057\u305f\u3002",
            "我吃了拉麵。",
            "",
            tip("\u301c\u3092\u98df\u3079\u307e\u3057\u305f", "表示「吃了～」。食物後面常接 を。", "\u30e9\u30fc\u30e1\u30f3\u3092\u98df\u3079\u307e\u3057\u305f\u3002") if show_grammar else tip(),
            [option("\u30e9\u30fc\u30e1\u30f3\u3092\u98df\u3079\u307e\u3057\u305f", "\u30e9\u30fc\u30e1\u30f3\u3092\u98df\u3079\u307e\u3057\u305f\u3002", "我吃了拉麵。"), option("\u3054\u98ef\u3092\u98df\u3079\u307e\u3057\u305f", "\u3054\u98ef\u3092\u98df\u3079\u307e\u3057\u305f\u3002", "我吃了飯。"), option("\u98df\u3079\u3059\u304e\u307e\u3057\u305f", "\u98df\u3079\u3059\u304e\u307e\u3057\u305f\u3002", "我吃太多了。")],
            "food", "share_food", "\u301c\u3092\u98df\u3079\u307e\u3057\u305f",
        )

    if has_cat:
        corrective = "\u732b\u597d\u304d" in text and "\u732b\u304c\u597d\u304d" not in text
        return result(
            "\u610f\u5473\u306f\u308f\u304b\u308a\u307e\u3059\u3002\u81ea\u7136\u306b\u8a00\u3046\u306a\u3089\u300c\u732b\u304c\u597d\u304d\u3067\u3059\u300d\u3067\u3059\u3002" if corrective else "\u3044\u3044\u3067\u3059\u306d\u3002\u732b\u304c\u597d\u304d\u306a\u3093\u3067\u3059\u306d\u3002",
            "意思懂。自然一點可以說「猫が好きです」。" if corrective else "很好耶。你喜歡貓對吧。",
            "我喜歡貓。",
            "\u732b\u304c\u597d\u304d\u3067\u3059\u3002" if corrective else "\u306f\u3044\u3001\u732b\u304c\u597d\u304d\u3067\u3059\u3002",
            "我喜歡貓。" if corrective else "是的，我喜歡貓。",
            "\u732b\u597d\u304d\u3067\u3059 \u2192 \u732b\u304c\u597d\u304d\u3067\u3059" if corrective else "",
            tip("\u301c\u304c\u597d\u304d\u3067\u3059", "喜歡的對象通常用 が。", "\u732b\u304c\u597d\u304d\u3067\u3059\u3002") if show_grammar else tip(),
            [option("\u72ac\u3082\u597d\u304d\u3067\u3059", "\u72ac\u3082\u597d\u304d\u3067\u3059\u3002", "我也喜歡狗。"), option("\u732b\u3092\u98fc\u3063\u3066\u3044\u307e\u3059", "\u732b\u3092\u98fc\u3063\u3066\u3044\u307e\u3059\u3002", "我有養貓。"), option("\u52d5\u7269\u304c\u597d\u304d\u3067\u3059", "\u52d5\u7269\u304c\u597d\u304d\u3067\u3059\u3002", "我喜歡動物。")],
            "animal", "correct_sentence" if corrective else "talk_about_likes", "\u301c\u304c\u597d\u304d\u3067\u3059",
        )

    if has_ski:
        return result(
            "\u3044\u3044\u3067\u3059\u306d\u3002\u660e\u65e5\u3001\u30b9\u30ad\u30fc\u5834\u306b\u884c\u304d\u305f\u3044\u3093\u3067\u3059\u306d\u3002",
            "不錯耶。你明天想去滑雪場對吧。",
            "我明天想去滑雪。",
            "\u306f\u3044\u3001\u660e\u65e5\u30b9\u30ad\u30fc\u5834\u306b\u884c\u304d\u305f\u3044\u3067\u3059\u3002",
            "是的，我明天想去滑雪場。",
            "",
            tip("\u301c\u305f\u3044\u3067\u3059", "表示「想做某事」。", "\u884c\u304d\u305f\u3044\u3067\u3059\u3002") if show_grammar else tip(),
            [option("\u30b9\u30ce\u30fc\u30dc\u30fc\u30c9\u3092\u3057\u305f\u3044\u3067\u3059", "\u30b9\u30ce\u30fc\u30dc\u30fc\u30c9\u3092\u3057\u305f\u3044\u3067\u3059\u3002", "我想滑雪板。"), option("\u30a6\u30a7\u30a2\u3092\u30ec\u30f3\u30bf\u30eb\u3057\u305f\u3044\u3067\u3059", "\u30a6\u30a7\u30a2\u3092\u30ec\u30f3\u30bf\u30eb\u3057\u305f\u3044\u3067\u3059\u3002", "我想租雪衣。"), option("\u53cb\u9054\u3068\u884c\u304d\u305f\u3044\u3067\u3059", "\u53cb\u9054\u3068\u884c\u304d\u305f\u3044\u3067\u3059\u3002", "我想和朋友去。")],
            "ski", "talk_about_plans", "\u301c\u305f\u3044\u3067\u3059",
        )

    if has_tired:
        return result(
            "\u75b2\u308c\u305f\u3093\u3067\u3059\u306d\u3002\u4eca\u65e5\u306f\u3086\u3063\u304f\u308a\u4f11\u307f\u307e\u3057\u3087\u3046\u3002",
            "你累了對吧。今天好好休息吧。",
            "我有點累。",
            "\u5c11\u3057\u75b2\u308c\u307e\u3057\u305f\u3002",
            "我有點累。",
            "",
            tip("\u5c11\u3057\u301c\u307e\u3057\u305f", "少し 表示「有點」。語氣比較柔和。", "\u5c11\u3057\u75b2\u308c\u307e\u3057\u305f\u3002") if show_grammar else tip(),
            [option("\u5c11\u3057\u75b2\u308c\u307e\u3057\u305f", "\u5c11\u3057\u75b2\u308c\u307e\u3057\u305f\u3002", "我有點累。"), option("\u4eca\u65e5\u306f\u65e9\u304f\u5bdd\u307e\u3059", "\u4eca\u65e5\u306f\u65e9\u304f\u5bdd\u307e\u3059\u3002", "我今天早點睡。"), option("\u3067\u3082\u697d\u3057\u304b\u3063\u305f\u3067\u3059", "\u3067\u3082\u697d\u3057\u304b\u3063\u305f\u3067\u3059\u3002", "但是很開心。")],
            "tired", "share_feeling", "\u5c11\u3057\u301c\u307e\u3057\u305f",
        )

    return result(
        "\u3044\u3044\u3067\u3059\u306d\u3002\u3082\u3046\u5c11\u3057\u6559\u3048\u3066\u304f\u3060\u3055\u3044\u3002",
        "不錯耶。再多告訴我一點。",
        text,
        "\u4eca\u65e5\u306f\u4f55\u3092\u3057\u307e\u3057\u305f\u304b\u3002",
        "今天做了什麼？",
        "",
        tip(),
        [option("\u4eca\u65e5\u306f\u4f55\u3092\u3057\u307e\u3057\u305f\u304b", "\u4eca\u65e5\u306f\u4f55\u3092\u3057\u307e\u3057\u305f\u304b\u3002", "今天做了什麼？"), option("\u4f55\u304c\u597d\u304d\u3067\u3059\u304b", "\u4f55\u304c\u597d\u304d\u3067\u3059\u304b\u3002", "你喜歡什麼？"), option("\u660e\u65e5\u3001\u4f55\u3092\u3057\u305f\u3044\u3067\u3059\u304b", "\u660e\u65e5\u3001\u4f55\u3092\u3057\u305f\u3044\u3067\u3059\u304b\u3002", "明天想做什麼？")],
        "unknown", "continue_conversation", "simple_question",
    )


def handle_coach(handler: http.server.SimpleHTTPRequestHandler) -> None:
    try:
        body = handler.rfile.read(int(handler.headers.get("Content-Length", "0") or 0))
        payload = json.loads(body.decode("utf-8")) if body else {}
    except Exception:
        handler.send_error(400, "Invalid JSON")
        return
    message = str(payload.get("message") or "").strip() or "\u4eca\u65e5\u306f\u4f55\u3092\u3057\u307e\u3057\u305f\u304b\u3002"
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
