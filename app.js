const STORAGE_KEY = "typeinsight.ai.sessions.v1";
const THEME_KEY = "typeinsight.ai.theme";
const keyboardRows = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M"],
  ["Backspace", "Space", "Enter"]
];

const elements = {
  consentToggle: document.querySelector("#consentToggle"),
  consentStatus: document.querySelector("#consentStatus"),
  typingInput: document.querySelector("#typingInput"),
  startSession: document.querySelector("#startSession"),
  finishSession: document.querySelector("#finishSession"),
  resetSession: document.querySelector("#resetSession"),
  sessionClock: document.querySelector("#sessionClock"),
  wpmMetric: document.querySelector("#wpmMetric"),
  accuracyMetric: document.querySelector("#accuracyMetric"),
  errorMetric: document.querySelector("#errorMetric"),
  confidenceMetric: document.querySelector("#confidenceMetric"),
  fatigueRing: document.querySelector("#fatigueRing"),
  insightList: document.querySelector("#insightList"),
  rhythmChart: document.querySelector("#rhythmChart"),
  keyboardHeatmap: document.querySelector("#keyboardHeatmap"),
  historyTable: document.querySelector("#historyTable"),
  exportCsv: document.querySelector("#exportCsv"),
  exportPdf: document.querySelector("#exportPdf"),
  deleteAll: document.querySelector("#deleteAll"),
  themeToggle: document.querySelector("#themeToggle"),
  openPrivacy: document.querySelector("#openPrivacy"),
  privacyDialog: document.querySelector("#privacyDialog")
};

let session = createEmptySession();
let timerId = null;
let lastInputLength = 0;
let previousInputAt = 0;
let history = loadHistory();

function createEmptySession() {
  return {
    active: false,
    startedAt: 0,
    endedAt: 0,
    keypresses: 0,
    chars: 0,
    backspaces: 0,
    pauses: [],
    intervals: [],
    keyFrequency: {},
    wpmPoints: []
  };
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function applyTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light") document.documentElement.classList.add("light");
  elements.themeToggle.querySelector("span").textContent = document.documentElement.classList.contains("light") ? "☀" : "☾";
}

function setConsentState() {
  const allowed = elements.consentToggle.checked;
  if (!allowed && session.active) {
    session.active = false;
    clearInterval(timerId);
    elements.typingInput.value = "";
    lastInputLength = 0;
    previousInputAt = 0;
  }
  elements.typingInput.disabled = !allowed;
  elements.consentStatus.textContent = allowed ? "Consent active" : "Collection paused";
  elements.consentStatus.classList.toggle("active", allowed);
}

function beginSession(options = { clearPad: true }) {
  if (!elements.consentToggle.checked) {
    elements.privacyDialog.showModal();
    return;
  }

  session = createEmptySession();
  session.active = true;
  session.startedAt = Date.now();
  lastInputLength = 0;
  previousInputAt = 0;
  if (options.clearPad) elements.typingInput.value = "";
  elements.typingInput.disabled = false;
  clearInterval(timerId);
  timerId = setInterval(updateMetrics, 500);
  updateMetrics();
}

function startSession() {
  beginSession({ clearPad: true });
  elements.typingInput.focus();
}

function finishSession() {
  if (!session.active && session.keypresses === 0) return;
  session.active = false;
  session.endedAt = Date.now();
  clearInterval(timerId);
  elements.typingInput.disabled = true;
  const summary = calculateSummary();

  if (summary.durationSeconds > 2 && session.keypresses > 0) {
    history.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      createdAt: new Date().toISOString(),
      ...summary,
      keyFrequency: { ...session.keyFrequency }
    });
    history = history.slice(0, 24);
    saveHistory();
  }

  elements.typingInput.value = "";
  lastInputLength = 0;
  renderAll();
}

function resetSession() {
  session = createEmptySession();
  elements.typingInput.value = "";
  elements.typingInput.disabled = !elements.consentToggle.checked;
  lastInputLength = 0;
  previousInputAt = 0;
  clearInterval(timerId);
  renderAll();
}

function handleKeydown(event) {
  if (!elements.consentToggle.checked) return;
  if (!session.active) beginSession({ clearPad: false });

  if (event.key !== "Backspace" && event.key !== "Enter") return;
}

function recordInputTiming() {
  const now = Date.now();
  if (previousInputAt) {
    const interval = now - previousInputAt;
    session.intervals.push(interval);
    if (interval > 900) session.pauses.push(interval);
  }
  previousInputAt = now;
}

function handleInput(event) {
  if (!elements.consentToggle.checked) return;
  if (!session.active) beginSession({ clearPad: false });
  recordInputTiming();

  const length = elements.typingInput.value.length;
  const delta = length - lastInputLength;

  if (delta > 0) {
    const addedText = elements.typingInput.value.slice(lastInputLength);
    session.chars += delta;
    session.keypresses += delta;
    countInsertedKeys(addedText);
  } else if (delta < 0 || event.inputType?.startsWith("delete")) {
    const deleteCount = Math.max(1, Math.abs(delta));
    session.backspaces += deleteCount;
    session.keypresses += deleteCount;
    session.keyFrequency.Backspace = (session.keyFrequency.Backspace || 0) + deleteCount;
  }

  lastInputLength = length;
  updateMetrics();
}

function countInsertedKeys(text) {
  for (const char of text) {
    const key = normalizeInputChar(char);
    if (key) session.keyFrequency[key] = (session.keyFrequency[key] || 0) + 1;
  }
}

function normalizeInputChar(char) {
  if (char === " ") return "Space";
  if (char === "\n") return "Enter";
  if (/^[a-z]$/i.test(char)) return char.toUpperCase();
  return null;
}

function calculateSummary() {
  const now = session.active ? Date.now() : (session.endedAt || Date.now());
  const durationSeconds = Math.max(0, (now - session.startedAt) / 1000);
  const minutes = Math.max(durationSeconds / 60, 1 / 60);
  const wpm = Math.round((session.chars / 5) / minutes);
  const errorRate = session.keypresses ? Math.min(100, (session.backspaces / session.keypresses) * 100) : 0;
  const accuracy = Math.max(0, 100 - errorRate);
  const pauseAverage = session.pauses.length
    ? session.pauses.reduce((sum, item) => sum + item, 0) / session.pauses.length
    : 0;
  const rhythmVariance = calculateVariance(session.intervals.slice(-28));
  const fatigue = Math.min(100, Math.round((pauseAverage / 28) + (rhythmVariance / 9000) + Math.max(0, session.backspaces - 8) * 1.5));
  const confidence = Math.max(0, Math.min(100, Math.round((accuracy * 0.55) + (Math.min(wpm, 90) / 90 * 30) + ((100 - fatigue) * 0.15))));

  return {
    durationSeconds: Math.round(durationSeconds),
    wpm,
    accuracy: Math.round(accuracy),
    errorRate: Math.round(errorRate),
    backspaces: session.backspaces,
    pauseCount: session.pauses.length,
    pauseAverage: Math.round(pauseAverage),
    fatigue,
    confidence,
    keypresses: session.keypresses
  };
}

function calculateVariance(values) {
  if (values.length < 2) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
}

function updateMetrics() {
  if (!session.startedAt) {
    renderAll();
    return;
  }
  const summary = calculateSummary();
  session.wpmPoints.push(summary.wpm);
  session.wpmPoints = session.wpmPoints.slice(-32);
  renderSummary(summary);
  renderChart();
  renderHeatmap();
  renderInsights(summary);
}

function renderAll() {
  const summary = session.startedAt ? calculateSummary() : {
    durationSeconds: 0,
    wpm: 0,
    accuracy: 100,
    errorRate: 0,
    backspaces: 0,
    pauseCount: 0,
    pauseAverage: 0,
    fatigue: 0,
    confidence: 0
  };
  renderSummary(summary);
  renderChart();
  renderHeatmap();
  renderInsights(summary);
  renderHistory();
  setConsentState();
}

function renderSummary(summary) {
  elements.wpmMetric.textContent = summary.wpm;
  elements.accuracyMetric.textContent = `${summary.accuracy}%`;
  elements.errorMetric.textContent = `${summary.errorRate}%`;
  elements.confidenceMetric.textContent = `${summary.confidence}%`;
  elements.sessionClock.textContent = formatDuration(summary.durationSeconds);
  elements.fatigueRing.textContent = `${summary.fatigue}%`;
  elements.fatigueRing.style.background = `radial-gradient(circle closest-side, var(--bg-2) 68%, transparent 70% 100%), conic-gradient(var(--amber) ${summary.fatigue * 3.6}deg, rgba(255,255,255,0.12) 0deg)`;
}

function renderInsights(summary) {
  const previous = history[0];
  const trend = previous ? summary.wpm - previous.wpm : 0;
  const suggestions = [
    {
      title: "Performance summary",
      body: session.startedAt
        ? `Current pace is ${summary.wpm} WPM with ${summary.accuracy}% accuracy and ${summary.pauseCount} notable pauses.`
        : "Start a consented session to generate a live local performance summary."
    },
    {
      title: "Personalized suggestion",
      body: summary.backspaces > 10
        ? "Slow down slightly for one minute and aim for cleaner first-pass accuracy."
        : "Your correction load is controlled. Try short bursts with relaxed shoulders to lift speed."
    },
    {
      title: "Trend analysis",
      body: previous
        ? `Compared with your last saved session, speed is ${trend >= 0 ? "up" : "down"} ${Math.abs(trend)} WPM.`
        : "Save a session to unlock cross-session trend analysis."
    },
    {
      title: "Fatigue detection",
      body: summary.fatigue > 62
        ? "Rhythm instability and pauses suggest fatigue. A short break may improve consistency."
        : "Typing rhythm looks steady, with no strong fatigue signal yet."
    },
    {
      title: "Productivity insight",
      body: `Confidence score is ${summary.confidence}%, blending speed, accuracy, and rhythm stability.`
    }
  ];

  elements.insightList.innerHTML = suggestions.map(item => `
    <div class="insight-item">
      <strong>${item.title}</strong>
      <span>${item.body}</span>
    </div>
  `).join("");
}

function renderChart() {
  const canvas = elements.rhythmChart;
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const points = session.wpmPoints.length ? session.wpmPoints : [0];
  const max = Math.max(40, ...points, 1);

  context.clearRect(0, 0, width, height);
  context.fillStyle = "rgba(255, 255, 255, 0.035)";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(255, 255, 255, 0.12)";
  context.lineWidth = 1;

  for (let i = 1; i < 5; i += 1) {
    const y = (height / 5) * i;
    context.beginPath();
    context.moveTo(32, y);
    context.lineTo(width - 24, y);
    context.stroke();
  }

  context.beginPath();
  points.forEach((point, index) => {
    const x = 32 + (index / Math.max(points.length - 1, 1)) * (width - 64);
    const y = height - 34 - (point / max) * (height - 68);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.strokeStyle = "#55d7ff";
  context.lineWidth = 5;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke();

  context.fillStyle = "#6ee7a8";
  points.forEach((point, index) => {
    const x = 32 + (index / Math.max(points.length - 1, 1)) * (width - 64);
    const y = height - 34 - (point / max) * (height - 68);
    context.beginPath();
    context.arc(x, y, 5, 0, Math.PI * 2);
    context.fill();
  });
}

function renderHeatmap() {
  const maxFrequency = Math.max(1, ...Object.values(session.keyFrequency));
  elements.keyboardHeatmap.innerHTML = keyboardRows.map((row, index) => `
    <div class="key-row row-${index + 1}">
      ${row.map(key => {
        const value = session.keyFrequency[key] || 0;
        const intensity = value / maxFrequency;
        const background = value
          ? `rgba(85, 215, 255, ${0.12 + intensity * 0.58})`
          : "rgba(255, 255, 255, 0.06)";
        return `<div class="key ${value ? "hot" : ""}" style="background:${background}" title="${key}: ${value} presses">${key === "Space" ? "Space" : key}</div>`;
      }).join("")}
    </div>
  `).join("");
}

function renderHistory() {
  if (!history.length) {
    elements.historyTable.innerHTML = `
      <tr>
        <td colspan="7">No saved sessions yet. Finish a consented session to create local analytics.</td>
      </tr>
    `;
    return;
  }

  elements.historyTable.innerHTML = history.map(item => `
    <tr>
      <td>${new Date(item.createdAt).toLocaleString()}</td>
      <td>${item.wpm}</td>
      <td>${item.accuracy}%</td>
      <td>${item.backspaces}</td>
      <td>${item.pauseCount}</td>
      <td>${formatDuration(item.durationSeconds)}</td>
      <td>${item.confidence}%</td>
    </tr>
  `).join("");
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function exportCsv() {
  const rows = [
    ["Date", "WPM", "Accuracy", "Error Rate", "Backspaces", "Pauses", "Duration", "Confidence"],
    ...history.map(item => [
      item.createdAt,
      item.wpm,
      item.accuracy,
      item.errorRate,
      item.backspaces,
      item.pauseCount,
      item.durationSeconds,
      item.confidence
    ])
  ];
  downloadFile("typeinsight-analytics.csv", rows.map(row => row.join(",")).join("\n"), "text/csv");
}

function exportPdf() {
  const printable = window.open("", "_blank");
  if (!printable) return;
  const rows = history.map(item => `
    <tr>
      <td>${new Date(item.createdAt).toLocaleString()}</td>
      <td>${item.wpm}</td>
      <td>${item.accuracy}%</td>
      <td>${item.confidence}%</td>
    </tr>
  `).join("");

  printable.document.write(`
    <html>
      <head>
        <title>TypeInsight AI Analytics</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 28px; color: #15201d; }
          h1 { margin-bottom: 4px; }
          p { color: #53645f; }
          table { width: 100%; border-collapse: collapse; margin-top: 22px; }
          th, td { border-bottom: 1px solid #d8e2df; padding: 10px; text-align: left; }
        </style>
      </head>
      <body>
        <h1>TypeInsight AI Analytics</h1>
        <p>Aggregate metrics only. No typed content is stored or exported.</p>
        <table>
          <thead><tr><th>Date</th><th>WPM</th><th>Accuracy</th><th>Confidence</th></tr></thead>
          <tbody>${rows || "<tr><td colspan='4'>No sessions available.</td></tr>"}</tbody>
        </table>
      </body>
    </html>
  `);
  printable.document.close();
  printable.focus();
  printable.print();
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

elements.consentToggle.addEventListener("change", setConsentState);
elements.startSession.addEventListener("click", startSession);
elements.finishSession.addEventListener("click", finishSession);
elements.resetSession.addEventListener("click", resetSession);
elements.typingInput.addEventListener("keydown", handleKeydown);
elements.typingInput.addEventListener("input", handleInput);
elements.exportCsv.addEventListener("click", exportCsv);
elements.exportPdf.addEventListener("click", exportPdf);
elements.deleteAll.addEventListener("click", () => {
  history = [];
  saveHistory();
  renderHistory();
});
elements.themeToggle.addEventListener("click", () => {
  document.documentElement.classList.toggle("light");
  localStorage.setItem(THEME_KEY, document.documentElement.classList.contains("light") ? "light" : "dark");
  applyTheme();
});
elements.openPrivacy.addEventListener("click", () => elements.privacyDialog.showModal());

applyTheme();
renderAll();
