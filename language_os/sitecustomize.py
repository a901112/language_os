from pathlib import Path

root_patch = Path(__file__).resolve().parent.parent / "sitecustomize.py"
if root_patch.exists():
    exec(compile(root_patch.read_text(encoding="utf-8"), str(root_patch), "exec"))
