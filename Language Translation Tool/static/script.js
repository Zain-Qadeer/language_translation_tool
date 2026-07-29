// --- Flag mapping (common languages only; others fall back to a globe icon) ---
const FLAGS = {
  en: "🇬🇧", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪", it: "🇮🇹", pt: "🇵🇹",
  ru: "🇷🇺", zh: "🇨🇳", "zh-CN": "🇨🇳", ja: "🇯🇵", ko: "🇰🇷", ar: "🇸🇦",
  hi: "🇮🇳", ur: "🇵🇰", tr: "🇹🇷", nl: "🇳🇱", pl: "🇵🇱", sv: "🇸🇪",
  id: "🇮🇩", vi: "🇻🇳", th: "🇹🇭", fa: "🇮🇷", bn: "🇧🇩", pa: "🇮🇳"
};
function flagFor(code) { return FLAGS[code] || "🌍"; }

// --- Session state (real, tracked client-side, resets on page reload) ---
let sessionCount = 0;
let sessionChars = 0;
let recentTranslations = [];
let langDistribution = {};

const sourceLangEl = document.getElementById("sourceLang");
const targetLangEl = document.getElementById("targetLang");
const sourceFlagEl = document.getElementById("sourceFlag");
const targetFlagEl = document.getElementById("targetFlag");
const inputText = document.getElementById("inputText");
const outputText = document.getElementById("outputText");
const translateBtn = document.getElementById("translateBtn");
const errorMsg = document.getElementById("errorMsg");
const voiceStatus = document.getElementById("voiceStatus");
const charCount = document.getElementById("charCount");

function updateFlags() {
  sourceFlagEl.textContent = sourceLangEl.value === "auto" ? "🌍" : flagFor(sourceLangEl.value);
  targetFlagEl.textContent = flagFor(targetLangEl.value);
}
sourceLangEl.addEventListener("change", updateFlags);
targetLangEl.addEventListener("change", updateFlags);
updateFlags();
charCount.textContent = `${inputText.value.length} characters`;

inputText.addEventListener("input", () => {
  charCount.textContent = `${inputText.value.length} characters`;
});

async function translateText() {
  const text = inputText.value.trim();
  const source = sourceLangEl.value;
  const target = targetLangEl.value;

  errorMsg.textContent = "";
  if (!text) { errorMsg.textContent = "Please enter some text."; return; }

  translateBtn.disabled = true;
  translateBtn.textContent = "Translating...";

  try {
    const res = await fetch("/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source, target })
    });
    const data = await res.json();

    if (!res.ok) {
      errorMsg.textContent = data.error || "Something went wrong.";
    } else {
      // Translation succeeded — this is never rolled back by an analytics/chart failure below.
      outputText.textContent = data.translated_text;
      try {
        recordSession(text, target);
      } catch (chartErr) {
        console.error("Analytics/chart rendering failed (translation itself was fine):", chartErr);
      }
    }
  } catch (e) {
    errorMsg.textContent = "Network error. Please try again.";
  } finally {
    translateBtn.disabled = false;
    translateBtn.textContent = "Translate ›";
  }
}

function recordSession(text, targetCode) {
  sessionCount += 1;
  sessionChars += text.length;
  document.getElementById("usageCount").textContent = sessionCount;
  document.getElementById("usageChars").textContent = sessionChars;

  const targetName = targetLangEl.options[targetLangEl.selectedIndex].text;
  const sourceName = sourceLangEl.value === "auto" ? "Auto" : sourceLangEl.options[sourceLangEl.selectedIndex].text;

  recentTranslations.unshift({ from: sourceName, to: targetName, time: Date.now() });
  recentTranslations = recentTranslations.slice(0, 3);
  renderRecentList();

  langDistribution[targetName] = (langDistribution[targetName] || 0) + 1;
  renderDonut();
  renderUsageChart();
}

function renderRecentList() {
  const list = document.getElementById("recentList");
  if (recentTranslations.length === 0) {
    list.innerHTML = `<li class="empty">No translations yet this session.</li>`;
    return;
  }
  list.innerHTML = recentTranslations.map(t => {
    const secondsAgo = Math.max(1, Math.round((Date.now() - t.time) / 1000));
    return `<li><span>${t.from} → ${t.to}</span><span class="ago">${secondsAgo}s ago</span></li>`;
  }).join("");
}
setInterval(renderRecentList, 5000);

function swapLanguages() {
  if (sourceLangEl.value === "auto") {
    errorMsg.textContent = "Can't swap while source is set to auto-detect.";
    return;
  }
  const temp = sourceLangEl.value;
  sourceLangEl.value = targetLangEl.value;
  targetLangEl.value = temp;
  updateFlags();
}

function copyResult() {
  const text = outputText.textContent;
  if (!text || text === "Translation will appear here.") return;
  navigator.clipboard.writeText(text);
  const btn = document.getElementById("copyBtn");
  const original = btn.textContent;
  btn.textContent = "✅";
  setTimeout(() => (btn.textContent = original), 1200);
}

// --- Text-to-speech: robust voice handling ---
// Browsers only speak audibly if a voice matching the target language is
// actually installed on the device. If none is found, older code stayed
// silent with no feedback — now we detect that and say so explicitly.
function getVoicesAsync() {
  return new Promise((resolve) => {
    let voices = speechSynthesis.getVoices();
    if (voices.length) { resolve(voices); return; }
    speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
    // Fallback in case voiceschanged never fires on this browser
    setTimeout(() => resolve(speechSynthesis.getVoices()), 1500);
  });
}

// Browsers give no real age/gender data for a voice — only a name string
// (e.g. "Microsoft David", "Google US English"). This is a best-effort guess
// from common name patterns, not a guaranteed classification.
const MALE_HINTS = ["david", "mark", "james", "george", "daniel", "alex", "fred", "guy", "ryan", "male"];
const FEMALE_HINTS = ["zira", "susan", "samantha", "victoria", "karen", "hazel", "linda", "female", "aria", "jenny"];
function guessVoiceGender(name) {
  const n = name.toLowerCase();
  if (MALE_HINTS.some(h => n.includes(h))) return "likely male";
  if (FEMALE_HINTS.some(h => n.includes(h))) return "likely female";
  return "unspecified";
}

const voiceSelect = document.getElementById("voiceSelect");
let cachedVoices = [];

async function refreshVoiceOptions() {
  const targetCode = targetLangEl.value;
  cachedVoices = await getVoicesAsync();
  const matches = cachedVoices.filter(v => v.lang.toLowerCase().startsWith(targetCode.toLowerCase()));

  if (matches.length === 0) {
    voiceSelect.innerHTML = `<option value="">No installed voice for this language</option>`;
    return;
  }
  voiceSelect.innerHTML = matches
    .map((v, i) => `<option value="${i}">${v.name} (${guessVoiceGender(v.name)})</option>`)
    .join("");
  voiceSelect.dataset.matches = JSON.stringify(matches.map(v => v.name));
}
targetLangEl.addEventListener("change", refreshVoiceOptions);
refreshVoiceOptions();

async function speakResult() {
  const text = outputText.textContent;
  voiceStatus.textContent = "";
  if (!text || text === "Translation will appear here.") return;

  const targetCode = targetLangEl.value;
  const targetName = targetLangEl.options[targetLangEl.selectedIndex].text;
  const voices = await getVoicesAsync();
  const matches = voices.filter(v => v.lang.toLowerCase().startsWith(targetCode.toLowerCase()));

  if (matches.length === 0) {
    voiceStatus.textContent =
      `No ${targetName} voice is installed on this device, so playback would be silent — ` +
      `this is a browser/OS limitation, not a bug. Try English, Spanish, French, or German ` +
      `to confirm playback works, or add the ${targetName} voice in Windows Settings → ` +
      `Time & Language → Speech.`;
    return;
  }

  const selectedIndex = voiceSelect.value !== "" ? parseInt(voiceSelect.value, 10) : 0;
  const chosen = matches[selectedIndex] || matches[0];

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = chosen;
  utterance.lang = chosen.lang;
  utterance.onerror = (e) => { voiceStatus.textContent = "Speech error: " + e.error; };
  speechSynthesis.cancel(); // clear any stuck queue before speaking
  speechSynthesis.speak(utterance);
}

// Optional mic input (speech-to-text) via the Web Speech API where supported
function startMic() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    errorMsg.textContent = "Speech input isn't supported in this browser.";
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = sourceLangEl.value === "auto" ? "en-US" : sourceLangEl.value;
  recognition.onresult = (e) => {
    inputText.value = e.results[0][0].transcript;
    charCount.textContent = `${inputText.value.length} characters`;
  };
  recognition.onerror = () => { errorMsg.textContent = "Couldn't capture audio."; };
  recognition.start();
}

document.getElementById("translateBtn").addEventListener("click", translateText);
document.getElementById("swapBtn").addEventListener("click", swapLanguages);
document.getElementById("copyBtn").addEventListener("click", copyResult);
document.getElementById("speakBtn").addEventListener("click", speakResult);
document.getElementById("micBtn").addEventListener("click", startMic);

// --- Charts (Chart.js) ---
let donutChart, usageChart;

function renderGauge() {
  if (typeof Chart === "undefined") { console.error("Chart.js failed to load — gauge skipped."); return; }
  const ctx = document.getElementById("gaugeChart");
  new Chart(ctx, {
    type: "doughnut",
    data: { datasets: [{ data: [98, 2], backgroundColor: ["#3fae5a", "#e7e0d0"], borderWidth: 0 }] },
    options: {
      circumference: 180, rotation: 270, cutout: "75%",
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

function renderDonut() {
  if (typeof Chart === "undefined") { console.error("Chart.js failed to load — donut skipped."); return; }
  const ctx = document.getElementById("donutChart");
  const labels = Object.keys(langDistribution);
  const values = Object.values(langDistribution);
  document.getElementById("donutEmpty").style.display = labels.length ? "none" : "block";
  if (donutChart) donutChart.destroy();
  donutChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values.length ? values : [1],
        backgroundColor: ["#4a90d9", "#f0a24b", "#3fae5a", "#9b6bc4", "#e0654f", "#3fb8ae"],
        borderWidth: 0
      }]
    },
    options: { plugins: { legend: { display: labels.length > 0, position: "bottom", labels: { boxWidth: 9, font: { size: 9 } } } } }
  });
}

function renderUsageChart() {
  if (typeof Chart === "undefined") { console.error("Chart.js failed to load — usage chart skipped."); return; }
  const ctx = document.getElementById("usageChart");
  if (usageChart) usageChart.destroy();
  const ordered = [...recentTranslations].reverse();
  usageChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ordered.map((_, i) => `#${i + 1}`),
      datasets: [{ data: ordered.map(t => t.to.length), backgroundColor: "#4a90d9" }]
    },
    options: { plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } }
  });
}

renderGauge();
renderDonut();
renderUsageChart();

// --- Sketchy hand-drawn borders (rough.js) ---
function drawSketchBorders() {
  if (typeof rough === "undefined") { console.error("rough.js failed to load — sketch borders skipped."); return; }
  document.querySelectorAll(".sketch-box").forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    let svg = el.querySelector(":scope > svg.sketch-border");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "sketch-border");
      el.style.position = "relative";
      el.insertBefore(svg, el.firstChild);
    } else {
      svg.innerHTML = "";
    }
    svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);

    const rc = rough.svg(svg);
    const node = rc.rectangle(2, 2, rect.width - 4, rect.height - 4, {
      roughness: 1.4,
      stroke: "#3a3a3a",
      strokeWidth: 1.4,
      fill: "none"
    });
    svg.appendChild(node);
  });
}

window.addEventListener("load", drawSketchBorders);
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawSketchBorders, 200);
});
