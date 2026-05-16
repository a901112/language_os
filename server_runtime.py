from __future__ import annotations

import coach_api
import server

server.APP_VERSION = coach_api.APP_VERSION
server.DEFAULT_MODEL = coach_api.DEFAULT_MODEL
server.MODEL_FALLBACKS = coach_api.model_fallbacks()
coach_api.install(server.Handler)

if __name__ == "__main__":
    server.main()
