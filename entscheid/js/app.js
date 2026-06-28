import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot,
  collection, addDoc, serverTimestamp, query
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import FIREBASE_CONFIG from "./firebase-config.js";

// ── Firebase ──────────────────────────────────────────────────
let db = null;

function isConfigured() {
  return FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.length > 0;
}

if (isConfigured()) {
  const app = initializeApp(FIREBASE_CONFIG);
  db = getFirestore(app);
}

// ── Language ──────────────────────────────────────────────────
let lang = navigator.language.startsWith("de") ? "de" : "en";

const T = {
  de: {
    // Nav
    lang_label: "EN",
    // Home
    hero_h1a: "Endlich",
    hero_h1b: "einig werden.",
    hero_sub: "Frage stellen, Link teilen, abstimmen lassen — fertig. Kein Account. Keine App.",
    cta: "Abstimmung erstellen →",
    ex_food: "🍕 Wo essen wir?",
    ex_film: "🎬 Welchen Film?",
    ex_trip: "✈️ Wohin in den Urlaub?",
    ex_drink: "🍺 Was trinken wir?",
    ex_food_q: "Wo essen wir heute?",
    ex_film_q: "Welchen Film schauen wir?",
    ex_trip_q: "Wohin in den Urlaub?",
    ex_drink_q: "Was trinken wir?",
    // Create
    create_title: "Neue Abstimmung",
    back: "← Zurück",
    question_label: "Die Frage",
    question_placeholder: "z. B. Wo essen wir heute?",
    options_label: "Optionen",
    option_placeholder: "Option",
    add_option: "+ Option hinzufügen",
    create_btn: "Link erstellen →",
    creating: "Erstelle…",
    // Vote
    see_results: "Ergebnisse ansehen →",
    vote_sub: "Wähle deine Antwort.",
    already_voted: "✓ Du hast bereits abgestimmt!",
    vote_btn: "Abstimmen",
    see_results_btn: "Ergebnisse ansehen",
    share_label: "Link teilen",
    copy_link: "Link kopieren",
    copied: "Link kopiert!",
    saving: "Wird gespeichert…",
    // Results
    back_to_vote: "← Zurück",
    live: "Live",
    loading: "Lädt…",
    no_votes: "Noch keine Stimmen — teile den Link!",
    total_one: "1 Stimme insgesamt",
    total_many: (n) => `${n} Stimmen insgesamt`,
    vote_count_one: "1 Stimme",
    vote_count_many: (n) => `${n} Stimmen`,
    new_vote: "Neue Abstimmung →",
    // Not found
    not_found_title: "Nicht gefunden",
    not_found_sub: "Diese Abstimmung existiert nicht (mehr).",
  },
  en: {
    // Nav
    lang_label: "DE",
    // Home
    hero_h1a: "Finally",
    hero_h1b: "decide together.",
    hero_sub: "Post a question, share the link, let everyone vote — done. No account. No app.",
    cta: "Create a vote →",
    ex_food: "🍕 Where should we eat?",
    ex_film: "🎬 Which movie?",
    ex_trip: "✈️ Where should we go?",
    ex_drink: "🍺 What are we drinking?",
    ex_food_q: "Where should we eat today?",
    ex_film_q: "Which movie should we watch?",
    ex_trip_q: "Where should we go on vacation?",
    ex_drink_q: "What are we drinking?",
    // Create
    create_title: "New vote",
    back: "← Back",
    question_label: "The question",
    question_placeholder: "e.g. Where should we eat?",
    options_label: "Options",
    option_placeholder: "Option",
    add_option: "+ Add option",
    create_btn: "Create link →",
    creating: "Creating…",
    // Vote
    see_results: "See results →",
    vote_sub: "Cast your vote.",
    already_voted: "✓ You already voted!",
    vote_btn: "Vote",
    see_results_btn: "See results",
    share_label: "Share link",
    copy_link: "Copy link",
    copied: "Link copied!",
    saving: "Saving…",
    // Results
    back_to_vote: "← Back",
    live: "Live",
    loading: "Loading…",
    no_votes: "No votes yet — share the link!",
    total_one: "1 vote total",
    total_many: (n) => `${n} votes total`,
    vote_count_one: "1 vote",
    vote_count_many: (n) => `${n} votes`,
    new_vote: "New vote →",
    // Not found
    not_found_title: "Not found",
    not_found_sub: "This vote doesn’t exist (anymore).",
  },
};

function t(key) {
  return T[lang][key] ?? T.de[key] ?? key;
}

// ── Security: escape user content before inserting into HTML ──
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function navigate(hash) { location.hash = hash; }

window.addEventListener("hashchange", render);
window.addEventListener("load", render);

// ── ID generator ──────────────────────────────────────────────
function makeId(len = 7) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

// ── Copy with visual feedback ─────────────────────────────────
function setupCopyBtn(btnId, url) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.onclick = () => {
    navigator.clipboard.writeText(url).then(() => {
      const orig = btn.textContent;
      btn.textContent = lang === "de" ? "✓ Kopiert!" : "✓ Copied!";
      btn.style.color = "var(--success)";
      btn.style.borderColor = "rgba(52,211,153,0.35)";
      setTimeout(() => {
        btn.textContent = orig;
        btn.style.color = "";
        btn.style.borderColor = "";
      }, 2000);
    });
  };
}

// ── Shell ─────────────────────────────────────────────────────
function getApp() { return document.getElementById("app"); }

function renderShell(content) {
  getApp().innerHTML = `
    <nav class="nav">
      <a class="logo" onclick="navigate('')">
        <span class="logo-dot"></span>entscheid
      </a>
      <button class="lang-toggle" id="langToggle">${t("lang_label")}</button>
    </nav>
    <div class="view">${content}</div>
    <div id="toast"></div>
  `;

  document.getElementById("langToggle").onclick = () => {
    lang = lang === "de" ? "en" : "de";
    render();
  };
}

// ── Setup screen ──────────────────────────────────────────────
function renderSetup() {
  renderShell(`
    <div class="setup-screen">
      <div class="setup-icon">🔧</div>
      <h2>Firebase einrichten</h2>
      <p class="muted mt-8">Einmalig, kostenlos, 5 Minuten.</p>
      <div class="setup-steps mt-16">
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
            <strong>Firestore Database</strong> → <em>Datenbank erstellen</em> → <em>Im Testmodus starten</em>.
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

// ── Home ──────────────────────────────────────────────────────
function renderHome() {
  if (!isConfigured()) { renderSetup(); return; }

  renderShell(`
    <div class="hero">
      <h1>${t("hero_h1a")}<br><span class="accent">${t("hero_h1b")}</span></h1>
      <p class="hero-sub mt-12">${t("hero_sub")}</p>
      <div class="examples">
        <span class="example-chip" data-q="${esc(t("ex_food_q"))}">${t("ex_food")}</span>
        <span class="example-chip" data-q="${esc(t("ex_film_q"))}">${t("ex_film")}</span>
        <span class="example-chip" data-q="${esc(t("ex_trip_q"))}">${t("ex_trip")}</span>
        <span class="example-chip" data-q="${esc(t("ex_drink_q"))}">${t("ex_drink")}</span>
      </div>
      <button class="btn btn-primary" id="startBtn" style="font-size:16px;padding:15px">
        ${t("cta")}
      </button>
    </div>
  `);

  document.getElementById("startBtn").onclick = () => navigate("create");
  document.querySelectorAll(".example-chip").forEach(chip => {
    chip.onclick = () => navigate("create?q=" + encodeURIComponent(chip.dataset.q));
  });
}

// ── Create ────────────────────────────────────────────────────
function renderCreate() {
  if (!isConfigured()) { renderSetup(); return; }

  const presetQ = new URLSearchParams(location.hash.split("?")[1] || "").get("q") || "";
  let options = ["", ""];

  renderShell(`
    <div>
      <div class="mb-16">
        <button class="btn-back" id="backBtn">${t("back")}</button>
      </div>
      <h2 class="mb-16">${t("create_title")}</h2>

      <div class="card">
        <div class="label">${t("question_label")}</div>
        <input type="text" id="titleInput" maxlength="120"
          placeholder="${esc(t("question_placeholder"))}" value="${esc(presetQ)}" />
      </div>

      <div class="card">
        <div class="label">${t("options_label")}</div>
        <div id="optionsList"></div>
        <button class="add-option-btn" id="addOptionBtn">${t("add_option")}</button>
      </div>

      <button class="btn btn-primary" id="createBtn" disabled>
        ${t("create_btn")}
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
          placeholder="${t("option_placeholder")} ${i + 1}" maxlength="80" value="${esc(val)}" />
        ${options.length > 2 ? `<button class="btn-danger" data-remove="${i}" aria-label="Remove option">×</button>` : ""}
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
    btn.textContent = t("creating");

    const id = makeId();
    await setDoc(doc(db, "decisions", id), {
      title,
      options: cleanOptions,
      createdAt: serverTimestamp()
    });

    navigate("vote/" + id);
  };
}

// ── Vote ──────────────────────────────────────────────────────
let unsubscribe = null;

async function renderVote(id) {
  if (!isConfigured()) { renderSetup(); return; }
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  const snap = await getDoc(doc(db, "decisions", id));
  if (!snap.exists()) {
    renderShell(`
      <div class="setup-screen">
        <div class="setup-icon">😕</div>
        <h2>${t("not_found_title")}</h2>
        <p class="muted mt-8">${t("not_found_sub")}</p>
      </div>
    `);
    return;
  }

  const { title, options } = snap.data();
  const hasVoted = localStorage.getItem("voted_" + id);
  const voteUrl = location.href.split("#")[0] + "#vote/" + id;

  renderShell(`
    <div>
      <div class="mb-16" style="display:flex;justify-content:space-between;align-items:center">
        <button class="btn-back" id="backBtn">${t("back")}</button>
        <button class="btn btn-ghost" id="resultsLinkBtn" style="padding:8px 14px;font-size:13px">
          ${t("see_results")}
        </button>
      </div>

      <h2 class="mb-8">${esc(title)}</h2>
      <p class="muted mb-16">${t("vote_sub")}</p>

      ${hasVoted ? `<div class="voted-banner">${t("already_voted")}</div>` : ""}

      <div id="optionsList">
        ${options.map((opt, i) => `
          <div class="vote-option ${hasVoted ? "disabled" : ""}" data-index="${i}">
            <div class="vote-radio"></div>
            <span class="vote-option-text">${esc(opt)}</span>
          </div>
        `).join("")}
      </div>

      <button class="btn btn-primary mt-12" id="submitBtn" ${hasVoted ? "" : "disabled"}>
        ${hasVoted ? t("see_results_btn") : t("vote_btn")}
      </button>

      <div class="card mt-20">
        <div class="label mb-8">${t("share_label")}</div>
        <div class="share-box">${voteUrl}</div>
        <button class="btn btn-ghost" id="copyBtn" style="width:100%">${t("copy_link")}</button>
      </div>
    </div>
  `);

  document.getElementById("backBtn").onclick = () => navigate("");
  document.getElementById("resultsLinkBtn").onclick = () => navigate("results/" + id);
  setupCopyBtn("copyBtn", voteUrl, id);

  if (hasVoted) {
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
    btn.textContent = t("saving");

    await addDoc(collection(db, "decisions", id, "votes"), {
      option: selected,
      timestamp: serverTimestamp()
    });

    localStorage.setItem("voted_" + id, "1");
    navigate("results/" + id);
  };
}

// ── Results ───────────────────────────────────────────────────
async function renderResults(id) {
  if (!isConfigured()) { renderSetup(); return; }
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }

  const snap = await getDoc(doc(db, "decisions", id));
  if (!snap.exists()) {
    renderShell(`
      <div class="setup-screen">
        <div class="setup-icon">😕</div>
        <h2>${t("not_found_title")}</h2>
      </div>
    `);
    return;
  }

  const { title, options } = snap.data();
  const voteUrl = location.href.split("#")[0] + "#vote/" + id;

  renderShell(`
    <div>
      <div class="mb-16" style="display:flex;justify-content:space-between;align-items:center">
        <button class="btn-back" id="backVoteBtn">${t("back_to_vote")}</button>
        <div class="live-badge"><span class="live-dot"></span>${t("live")}</div>
      </div>

      <h2 class="mb-16">${esc(title)}</h2>

      <div class="card">
        <div id="resultsContainer">
          <p class="muted" style="text-align:center">${t("loading")}</p>
        </div>
        <p class="total-votes" id="totalVotes"></p>
      </div>

      <div class="card">
        <div class="label mb-8">${t("share_label")}</div>
        <div class="share-box">${voteUrl}</div>
        <div class="gap-8 mt-8">
          <button class="btn btn-ghost" id="copyBtn">${t("copy_link")}</button>
          <button class="btn btn-primary" id="newBtn">${t("new_vote")}</button>
        </div>
      </div>
    </div>
  `);

  document.getElementById("backVoteBtn").onclick = () => navigate("vote/" + id);
  setupCopyBtn("copyBtn", voteUrl, id);
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
      const countLabel = count === 1
        ? t("vote_count_one")
        : T[lang].vote_count_many(count);
      return `
        <div class="result-row ${isWinner ? "winner" : ""}">
          <div class="result-header">
            <span class="result-name">${esc(opt)}</span>
            <span class="result-count">${countLabel} · ${pct}%</span>
          </div>
          <div class="result-bar-bg">
            <div class="result-bar" style="--pct:${pct / 100}"></div>
          </div>
        </div>
      `;
    }).join("");

    const totalEl = document.getElementById("totalVotes");
    if (totalEl) {
      totalEl.textContent = total === 0
        ? t("no_votes")
        : total === 1
          ? t("total_one")
          : T[lang].total_many(total);
    }
  });
}

// ── Render ────────────────────────────────────────────────────
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
