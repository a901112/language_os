# Language OS

A minimalist language-learning web app with a Python backend and optional OpenAI Responses API analysis.

## Render settings

- Runtime: Python 3
- Build command: `pip install -r requirements.txt`
- Start command: `python server.py`
- Environment variables:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL=gpt-5-mini`
  - `HOST=0.0.0.0`

Health check: `/api/health`
