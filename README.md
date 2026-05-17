# Kotoha

A minimalist language-learning web app with a Python backend and optional OpenAI Responses API analysis.

## Kotoha V4

Kotoha is a Japanese-focused language map assistant. It detects whether the user entered a Chinese word, Japanese word, Chinese sentence, or Japanese sentence, then chooses the right learning experience.

V4 adds an input intent router so the same quiet input box can answer differently:

- Chinese word: show Japanese, reading, quick use, related words, nuance, and a light memory hook.
- Japanese word: check correctness, reading, meaning, actual usage, and common mistakes.
- Chinese sentence: show the full natural Japanese translation first, then sentence map and swap practice.
- Japanese sentence: check naturalness, suggest a better version, and explain the smallest useful correction.

Kotoha V4 is Japanese-first. The old mode storage can remain for compatibility, but the UI defaults to Japanese learning.

## Kotoha V5

V5 adds a test-style practice layer and a learning map overview.

- Quiz Mode asks direct questions instead of only showing practice suggestions.
- Question types include multiple choice, fill blank, Japanese-to-Chinese, Chinese-to-Japanese, listening, and recording-style answers.
- Questions are selected from the user's current progress. New or weak items appear earlier, while stronger items are spaced out.
- A new session rotates questions so each login does not feel identical.
- If the user keeps missing the same item, that weak point returns sooner instead of disappearing.
- Learning Map summarizes mastered items, due review items, total knowledge nodes, category progress, and per-item mastery.

V5 still keeps Language Map and AI Coach as separate entrances from the left menu.

## AI Coach

AI 教練是 Kotoha 的第二個入口，從左上角選單切換。語言地圖保留原本的一句話分析；AI 教練則用極簡對話陪使用者練日文。使用者可以輸入中文或日文，教練會回 1 到 2 句簡單日文，提供語音、中文翻譯開關、文法提示開關、可模仿回覆與 2 到 3 個快速回覆 chips。

The coach endpoint is separate from language-map analysis:

- `POST /api/analyze` returns the language map result.
- `POST /api/coach` returns one AI coach conversation turn.

## Render settings

- Runtime: Python 3
- Build command: `pip install -r requirements.txt`
- Start command: `python server.py`
- Environment variables:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL=gpt-5`
  - `OPENAI_REASONING_EFFORT=medium`
  - `OPENAI_MAX_OUTPUT_TOKENS=3600`
  - `OPENAI_ALLOW_MINI_FALLBACK=0`
  - `HOST=0.0.0.0`

Health check: `/api/health`

## Manual V4 checks

- `貓` routes to `zh_word_explorer`, shows `猫 / ねこ / 貓`, quick sentences, animals, and `猫` vs `ねこ` nuance.
- `猫` routes to `ja_word_checker`, confirms the word, reading `ねこ`, meaning `貓`, and real usage.
- `我喜歡貓` routes to `zh_sentence_translator`, with `猫が好きです。` as the first large card.
- `猫好きです` routes to `ja_sentence_coach`, suggests `猫が好きです。` and explains `が`.
- `我明天想去滑雪場租板子` shows the full translation before the sentence map and rental swap practice.
- `明日スキー場でボード借りたい` suggests `明日、スキー場でボードを借りたいです。` and explains `を` and `です`.
- Forced route buttons rerun the same input with `forcedRoute`.
- API failures keep the gentle Kotoha loading error and retry button.

## Manual AI Coach checks

- Feature menu opens from the left hamburger and switches between `語言地圖` and `AI 教練` without clearing either state.
- `我喜歡貓` produces `いいですね。猫が好きなんですね。`, a suggested reply, and animal-related quick replies.
- `猫好きです` is corrected gently to `猫が好きです` without saying the user is wrong.
- Translation and grammar toggles hide/show only their supporting content.
- `我明天想去滑雪` keeps the ski topic and offers snowboard/rental quick replies.
- `/api/coach` falls back locally when OpenAI is unavailable.
- Coach history is stored in `localStorage` and survives reload.

## Manual V5 checks

- The left hamburger menu shows `測驗模式` and `學習地圖`.
- Quiz Mode starts a 6-question session and shows direct answer controls.
- Multiple choice and listening questions can be answered, then show correctness, standard answer, and mastery update.
- Fill blank, Japanese-to-Chinese, Chinese-to-Japanese, and recording-style questions render their own input controls.
- `重新出題` creates a fresh session and avoids repeating the exact same set unless weak items are due.
- Wrong answers lower mastery and make that item return sooner.
- Learning Map shows mastered count, due review count, total nodes, category sections, and mastery meters.
- Language Map and AI Coach still open from the same menu and keep their existing state.
