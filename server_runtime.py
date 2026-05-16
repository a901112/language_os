from __future__ import annotations

import os

import coach_api

if not os.environ.get("OPENAI_MODEL") or ("mini" in os.environ.get("OPENAI_MODEL", "").lower() and not coach_api.OPENAI_ALLOW_MINI_FALLBACK):
    os.environ["OPENAI_MODEL"] = coach_api.DEFAULT_MODEL

import server

server.APP_VERSION = coach_api.APP_VERSION
server.DEFAULT_MODEL = coach_api.DEFAULT_MODEL
server.MODEL_FALLBACKS = coach_api.model_fallbacks()
coach_api.install(server.Handler)

if __name__ == "__main__":
    server.main()
