from __future__ import annotations

import runpy
from pathlib import Path

ROOT_SERVER = Path(__file__).resolve().parent.parent / "server.py"
runpy.run_path(str(ROOT_SERVER), run_name="__main__")
