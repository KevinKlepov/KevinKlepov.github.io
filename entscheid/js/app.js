import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot,
  collection, addDoc, serverTimestamp, query
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import FIREBASE_CONFIG from "./firebase-config.js";

// ── Firebase init ─────────────────────────────────────────────
let db = null;

function isConfigured() {
  return FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.length > 0;
}

if (isConfigured()) {
  const app = initializeApp(FIREBASE_CONFIG);
  db = getFirestore(app);
}

// ── Router ────────────────────────────────────────────────────
function getRoute() {
  const hash = location.hash.replace("#", "");
  if (!hash) return { view: "home" };
  if (hash.startsWith("vote/")) return { view: "vote", id: hash.slice(5) };
  if (hash.startsWith("results/")) return { view: "results", id: hash.slice(8) };
  if (hash === "create") return { view: "create" };
  return { view: "home" };
}

function navigate(hash) {
  location.hash = hash;
}

window.addEventListener("hashchange", render);
window.addEventListener("load", render);

// ── ID generator ──────────────────────────────────────────────
function makeId(len = 7) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2000);
}

// ── App container ─────────────────────────────────────────────
function getApp() { return document.getElementById("app"); }

function renderShell(content) {
  getApp().innerHTML = `
    <nav class="nav">
      <a class="logo" onclick="navigate('')">
        <span class="logo-dot"></span>entscheid
      </a>
    </nav>
    <div class="view">${content}</div>
    <div id="toast"></div>
  `;
}

// ── Setup screen ──────────────────────────────────────────────
function renderSetup() {
  renderShell(`
    <div class="setup-screen">
      <div class="setup-icon">🔧</div>
      <h2>Firebase einrichten</h2>
      <p class="muted mt-8">Einmalig, kostenlos, 5 Minuten.</p>
      <div class="setup-steps mt-24">
        <div class="setup-step">
          <div class="step-num">1</div>
          <div class="step-text">
            Gehe zu <a href="https://console.firebase.google.com" target="_blank">console.firebase.google.com</a>
            und erstelle ein neues Projekt.
          </div>
        </div>
        <div class="setup-step">
          <div class="step-num">2</div>
          <div class="step-text">
            Gehe zu <strong>Firestore Database</strong> → <em>Datenbank erstellen</em> →
            <em>Im Testmodus starten</em>.
          </div>
        </div>
        <div class="setup-step">
          <div class="step-num">3</div>
          <div class="step-text">
            Projekteinstellungen (⚙) → <em>Web-App hinzufügen</em> → Config kopieren.
          </div>
        </div>
        <div class="setup-step">
          <div class="step-num">4</div>
          <div class="step-text">
            Werte in <code>entscheid/js/firebase-config.js</code> eintragen und pushen.
          </div>
        </div>
      </div>
      <a href="https://console.firebase.google.com" target="_blank" class="btn btn-primary">
        Firebase öffnen →
      </a>
    </div>
  `);
}

// ── Home view ─────────────────────────────────────────────────
function renderHome() {
  if (!isConfigured()) { renderSetup(); return; }

  renderShell(`
    <div class="hero">
      <div class="hero-eyebrow">✦ Kostenlos · Kein Account · Kein Stress</div>
      <h1>Endlich<br><span class="accent">einig werden.</span></h1>
      <p class="muted" style="margin-top:14px;line-height:1.7">
        Frage stellen, Link teilen, abstimmen lassen —<br>
        und der Rest erledigt sich von selbst.
      </p>
      <div class="examples">
        <span class="example-chip" data-q="Wo essen wir heute?">🍕 Wo essen wir heute?</span>
        <span class="example-chip" data-q="Welchen Film schauen wir?">🎬 Welchen Film?</span>
        <span class="example-chip" data-q="Wohin in den Urlaub?">✈️ Wohin in den Urlaub?</span>
        <span class="example-chip" data-q="Was trinken wir?">🍺 Was trinken wir?</span>
      </div>
      <button class="btn btn-primary" id="startBtn" style="font-size:16px;padding:17px">
        Abstimmung erstellen →
      </button>
    </div>
  `);

  document.getElementById("startBtn").onclick = () => navigate("create");
  document.querySelectorAll(".example-chip").forEach(chip => {
    chip.onclick = () => navigate("create?q=" + encodeURIComponent(chip.dataset.q));
  });
}

// ── Create view ───────────────────────────────────────────────
function renderCreate() {
  if (!isConfigured()) { renderSetup(); return; }

  const presetQ = new URLSearchParams(location.hash.split("?")[1] || "").get("q") || "";
  let options = ["", ""];

  renderShell(`
    <div>
      <div class="mb-16">
        <button class="btn btn-ghost" id="backBtn" style="padding:8px 14px;font-size:14px">
          ← Zurück
        </button>
      </div>
      <h2 class="mb-16">Neue Entscheidung</h2>

      <div class="card">
        <div class="label">Die Frage</div>
        <input type="text" id="titleInput" maxlength="120"
          placeholder="z.B. Wo essen wir heute?" value="${presetQ}" />
      </div>

      <div class="card">
        <div class="label">Optionen</div>
        <div id="optionsList"></div>
        <button class="add-option-btn" id="addOptionBtn">+ Option hinzufügen</button>
      </div>

      <button class="btn btn-primary" id="createBtn" disabled>
        Link erstellen →
      </button>
    </div>
  `);

  document.getElementById("backBtn").onclick = () => navigate("");

  function renderOptions() {
    const list = document.getElementById("optionsList");
    list.innerHTML = options.map((val, i) => `
      <div class="option-row">
        <div class="option-num">${i + 1}</div>
        <input type="text" class="option-input" data-index="${i}"
          placeholder="Option ${i + 1}" maxlength="80" value="${val}" />
        ${options.length > 2 ? `<button class="btn-danger" data-remove="${i}">×</button>` : ""}
      </div>
    `).join("");

    list.querySelectorAll(".option-input").forEach(input => {
      input.addEventListener("input", e => {
        options[+e.target.dataset.index] = e.target.value;
        validate();
      });
    });
    list.querySelectorAll("[data-remove]").forEach(btn => {
      btn.addEventListener("click", e => {
        options.splice(+e.target.dataset.remove, 1);
        renderOptions();
        validate();
      });
    });
    validate();
  }

  function validate() {
    const title = document.getElementById("titleInput")?.value?.trim();
    const filled = options.filter(o => o.trim()).length;
    const btn = document.getElementById("createBtn");
    if (btn) btn.disabled = !(title && filled >= 2);
  }

  document.getElementById("titleInput").addEventListener("input", validate);
  document.getElementById("addOptionBtn").onclick = () => {
    if (options.length < 8) { options.push(""); renderOptions(); }
  };

  renderOptions();

  document.getElementById("createBtn").onclick = async () => {
    const title = document.getElementById("titleInput").value.trim();
    const cleanOptions = options.map(o => o.trim()).filter(Boolean);
    if (!title || cleanOptions.length < 2) return;

    const btn = document.getElementById("createBtn");
    btn.disabled = true;
    btn.textContent = "Erstelle…";

    const id = makeId();
    await setDoc(doc(db, "decisions", id), {
      title,
      options: cleanOptions,
      createdAt: serverTimestamp()
    });

    navigate("vote/" + id);
  };
}

// ── Vote view ─────────────────────────────────────────────────
let unsubscribe = null;

async function renderVote(id) {
  if (!isConfigured()) { renderSetup(); return; }
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  const snap = await getDoc(doc(db, "decisions", id));
  if (!snap.exists()) {
    renderShell(`<div class="setup-screen"><div class="setup-icon">😕</div><h2>Nicht gefunden</h2><p class="muted mt-8">Diese Entscheidung existiert nicht (mehr).</p></div>`);
    return;
  }

  const { title, options } = snap.data();
  const hasVoted = localStorage.getItem("voted_" + id);
  const shareUrl = location.origin + location.pathname.replace(/\/[^/]*$/, "/") + "#results/" + id;
  const voteUrl = location.href.split("#")[0] + "#vote/" + id;

  renderShell(`
    <div>
      <div class="mb-16">
        <button class="btn btn-ghost" id="resultsLinkBtn" style="padding:8px 14px;font-size:14px">
          Ergebnisse ansehen →
        </button>
      </div>

      <h2 class="mb-8">${title}</h2>
      <p class="muted mb-16">Wähle deine Lieblingsantwort.</p>

      ${hasVoted ? `<div class="voted-banner">✓ Du hast bereits abgestimmt!</div>` : ""}

      <div id="optionsList">
        ${options.map((opt, i) => `
          <div class="vote-option ${hasVoted ? "disabled" : ""}" data-index="${i}">
            <div class="vote-indicator"></div>
            <span class="vote-option-text">${opt}</span>
          </div>
        `).join("")}
      </div>

      <button class="btn btn-primary mt-16" id="submitBtn" disabled>
        ${hasVoted ? "Ergebnisse ansehen" : "Abstimmen"}
      </button>

      <div class="card mt-24">
        <div class="label mb-8">Link teilen</div>
        <div class="share-box">${voteUrl}</div>
        <button class="btn btn-ghost" id="copyBtn" style="width:100%">Link kopieren</button>
      </div>
    </div>
  `);

  document.getElementById("resultsLinkBtn").onclick = () => navigate("results/" + id);
  document.getElementById("copyBtn").onclick = () => {
    navigator.clipboard.writeText(voteUrl).then(() => showToast("Link kopiert!"));
  };

  if (hasVoted) {
    document.getElementById("submitBtn").disabled = false;
    document.getElementById("submitBtn").onclick = () => navigate("results/" + id);
    return;
  }

  let selected = null;

  document.querySelectorAll(".vote-option").forEach(el => {
    el.addEventListener("click", () => {
      document.querySelectorAll(".vote-option").forEach(e => e.classList.remove("selected"));
      el.classList.add("selected");
      selected = options[+el.dataset.index];
      document.getElementById("submitBtn").disabled = false;
    });
  });

  document.getElementById("submitBtn").onclick = async () => {
    if (!selected) return;
    const btn = document.getElementById("submitBtn");
    btn.disabled = true;
    btn.textContent = "Wird gespeichert…";

    await addDoc(collection(db, "decisions", id, "votes"), {
      option: selected,
      timestamp: serverTimestamp()
    });

    localStorage.setItem("voted_" + id, "1");
    navigate("results/" + id);
  };
}

// ── Results view ──────────────────────────────────────────────
async function renderResults(id) {
  if (!isConfigured()) { renderSetup(); return; }
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  const snap = await getDoc(doc(db, "decisions", id));
  if (!snap.exists()) {
    renderShell(`<div class="setup-screen"><div class="setup-icon">😕</div><h2>Nicht gefunden</h2></div>`);
    return;
  }

  const { title, options } = snap.data();
  const voteUrl = location.href.split("#")[0] + "#vote/" + id;

  renderShell(`
    <div>
      <div class="mb-16">
        <button class="btn btn-ghost" id="backVoteBtn" style="padding:8px 14px;font-size:14px">
          ← Zurück zum Abstimmen
        </button>
      </div>

      <div class="live-badge"><span class="live-dot"></span>Live</div>
      <h2 class="mb-16">${title}</h2>

      <div class="card">
        <div id="resultsContainer">
          <p class="muted" style="text-align:center">Lädt…</p>
        </div>
        <p class="total-votes" id="totalVotes"></p>
      </div>

      <div class="card">
        <div class="label mb-8">Link teilen</div>
        <div class="share-box">${voteUrl}</div>
        <div class="gap-8 mt-8">
          <button class="btn btn-ghost" id="copyBtn">Link kopieren</button>
          <button class="btn btn-primary" id="newBtn">Neue Entscheidung →</button>
        </div>
      </div>
    </div>
  `);

  document.getElementById("backVoteBtn").onclick = () => navigate("vote/" + id);
  document.getElementById("copyBtn").onclick = () => {
    navigator.clipboard.writeText(voteUrl).then(() => showToast("Link kopiert!"));
  };
  document.getElementById("newBtn").onclick = () => navigate("create");

  const votesRef = collection(db, "decisions", id, "votes");
  unsubscribe = onSnapshot(query(votesRef), snapshot => {
    const counts = {};
    options.forEach(o => counts[o] = 0);
    snapshot.docs.forEach(d => {
      const opt = d.data().option;
      if (counts[opt] !== undefined) counts[opt]++;
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const maxVotes = Math.max(...Object.values(counts));

    const container = document.getElementById("resultsContainer");
    if (!container) return;

    container.innerHTML = options.map(opt => {
      const count = counts[opt];
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const isWinner = count === maxVotes && maxVotes > 0;
      return `
        <div class="result-row ${isWinner ? "winner" : ""}">
          <div class="result-header">
            <span class="result-name">${opt}</span>
            <span class="result-count">${count} Stimme${count !== 1 ? "n" : ""} · ${pct}%</span>
          </div>
          <div class="result-bar-bg">
            <div class="result-bar" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join("");

    const totalEl = document.getElementById("totalVotes");
    if (totalEl) totalEl.textContent = total === 0
      ? "Noch keine Stimmen — teile den Link!"
      : `${total} Stimme${total !== 1 ? "n" : ""} insgesamt`;
  });
}

// ── Main render ───────────────────────────────────────────────
function render() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  const { view, id } = getRoute();
  if (view === "home") renderHome();
  else if (view === "create") renderCreate();
  else if (view === "vote") renderVote(id);
  else if (view === "results") renderResults(id);
  else renderHome();
}

window.navigate = navigate;
