from flask import Flask, render_template, request, jsonify
from deep_translator import GoogleTranslator
from deep_translator.constants import GOOGLE_LANGUAGES_TO_CODES

app = Flask(__name__)

# {display_name: language_code} dict for the dropdowns, e.g. {"English": "en"}
LANGUAGES = {name.title(): code for name, code in GOOGLE_LANGUAGES_TO_CODES.items()}


@app.route("/")
def home():
    return render_template("index.html", languages=LANGUAGES)


@app.route("/translate", methods=["POST"])
def translate():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    source = data.get("source", "auto")
    target = data.get("target", "en")

    if not text:
        return jsonify({"error": "Please enter some text to translate."}), 400

    try:
        translated = GoogleTranslator(source=source, target=target).translate(text)
        return jsonify({"translated_text": translated})
    except Exception as e:
        return jsonify({"error": f"Translation failed: {str(e)}"}), 500


# Local dev entrypoint. Vercel's Python runtime finds the `app` object
# above automatically — this block never runs in production.
if __name__ == "__main__":
    app.run(debug=True)
