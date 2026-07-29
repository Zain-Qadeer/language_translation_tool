# CodeAlpha_LanguageTranslationTool

A simple web-based Language Translation Tool built with Flask and Python.
Users can enter text, select a source and target language, and get an
instant translation — with copy and text-to-speech support.

## Features
- Text input with source/target language selection (133 languages), flag icons for common languages
- Auto-detect source language, swap-languages button
- Translation via Google Translate (through `deep-translator`, no API key needed)
- Copy-to-clipboard button, text-to-speech playback, optional mic input (speech-to-text via Web Speech API — browser-dependent support)
- Dashboard-style analytics panel:
  - **Recent Translations** and **Language Distribution** are real, tracked from your actual translations this session (resets on page reload — there's no database).
  - **Accuracy gauge (98%)** is a static illustrative design element, not a measured score — the translation API has no confidence metric.
  - **Session Usage** shows real counts (translations/characters this session), not fabricated global user numbers.
- Sidebar History / API / Settings icons are visual only (no backend behind them) — out of scope for this task.

## Tech Stack
- Python 3 / Flask (backend)
- HTML/CSS/JavaScript (frontend, no framework)
- `deep-translator` library

## Run Locally (in PyCharm)
1. Open this folder as a project in PyCharm.
2. Open the PyCharm terminal and create a virtual environment (optional but recommended):
   ```
   python -m venv venv
   venv\Scripts\activate      # Windows
   source venv/bin/activate   # Mac/Linux
   ```
3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
4. Run the app:
   ```
   python app.py
   ```
5. Open `http://127.0.0.1:5000` in your browser.

## Deploy to Vercel
Vercel auto-detects Flask apps with zero configuration as long as your
Flask instance is named `app` in `app.py` (which it is here).

1. Push this project to GitHub (see below).
2. Go to vercel.com → **Add New Project** → import the GitHub repo.
3. Leave settings as default and click **Deploy**.
4. Vercel will give you a live URL (e.g. `codealpha-translation.vercel.app`).

## Create the GitHub Repo (per CodeAlpha instructions)
```
git init
git add .
git commit -m "Initial commit: Language Translation Tool"
git branch -M main
git remote add origin https://github.com/<your-username>/CodeAlpha_LanguageTranslationTool.git
git push -u origin main
```

## Note
`deep-translator` scrapes Google Translate's public interface — it's free
and needs no API key, but it can occasionally break if Google changes their
page structure. If that happens, swap `GoogleTranslator` for
`MicrosoftTranslator` (needs a free Azure API key) in `app.py` — the rest
of the code doesn't need to change.
