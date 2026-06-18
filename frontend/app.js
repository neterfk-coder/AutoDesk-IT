// ── Config (from config.js) ───────────────────────────────────────────────────
const FIREBASE_URL = CONFIG.FIREBASE_URL;
const GROQ_API_KEY = CONFIG.GROQ_API_KEY;

// ── State ─────────────────────────────────────────────────────────────────────
let tickets = [];
let filtered = [];
let activeFilter = "all";
let activeTicket = null;
let searchQuery = "";
let activityLog = [];
let chatOpen = false;
let chatContext = null;
let chatHistory = [];
let unreadCount = 0;

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadAllTickets();
  setInterval(loadAllTickets, 3000);
});

// ── Load data ─────────────────────────────────────────────────────────────────
async function loadAllTickets() {
  try {
    const [tr, ar] = await Promise.all([
      fetch(`${FIREBASE_URL}/tickets.json`),
      fetch(`${FIREBASE_URL}/analyses.json`),
    ]);
    const ticketsData = (await tr.json()) || {};
    const analysesData = (await ar.json()) || {};
    const prevCount = tickets.length;

    tickets = Object.values(ticketsData)
      .map((t) => ({
        ...t,
        analyses: analysesData[t.id] ? [analysesData[t.id]] : [],
      }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (prevCount > 0 && tickets.length > prevCount) {
      const newest = tickets[0];
      showToast(`🎫 New ticket: ${newest.title}`);
      addActivity(
        "blue",
        `New ticket received from ${newest.source}`,
        newest.title,
      );
    }

    applyFilters();
    updateStats();
    updateNavBadges();
    buildHeatmap();

    if (activeTicket) {
      const updated = tickets.find((t) => t.id === activeTicket.id);
      if (updated) {
        activeTicket = updated;
        renderDetail(updated);
        buildTimeline(updated);
      }
    }
  } catch (e) {
    console.error("Firebase error:", e);
    showToast("⚠️ Connection error — retrying...");
  }
}

// ── Filters ───────────────────────────────────────────────────────────────────
function setFilter(filter, el) {
  activeFilter = filter;
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  if (el) el.classList.add("active");
  applyFilters();
}

function filterBySearch(val) {
  searchQuery = val.toLowerCase();
  applyFilters();
}

function applyFilters() {
  filtered = tickets.filter((t) => {
    const matchFilter =
      activeFilter === "all"
        ? true
        : activeFilter === "servicenow" || activeFilter === "gmail"
          ? t.source === activeFilter
          : t.status === activeFilter;

    const matchSearch = !searchQuery
      ? true
      : t.title?.toLowerCase().includes(searchQuery) ||
        t.description?.toLowerCase().includes(searchQuery) ||
        t.user_email?.toLowerCase().includes(searchQuery);

    return matchFilter && matchSearch;
  });
  renderTickets();
}

// ── Render tickets ────────────────────────────────────────────────────────────
function renderTickets() {
  const list = document.getElementById("tickets-list");
  if (!list) return;

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p>${tickets.length === 0 ? "No tickets yet" : "No tickets match your filter"}</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered
    .map((t) => {
      const sev = t.analyses?.[0]?.severity || null;
      return `
      <div class="ticket-card ${activeTicket?.id === t.id ? "active" : ""}"
           onclick="selectTicket('${t.id}')">
        <div class="ticket-card-top">
          <span class="ticket-card-title">${escHtml(t.title)}</span>
          <span class="status-badge status-${t.status}">${statusLabel(t.status)}</span>
        </div>
        <div class="ticket-card-meta">
          <span>${sourceIcon(t.source)} ${t.source}</span>
          ${sev ? `<span class="sev-pill sev-${sev}">${sev}</span>` : ""}
          <span style="margin-left:auto">${timeAgo(t.created_at)}</span>
        </div>
      </div>`;
    })
    .join("");
}

// ── Select ticket ─────────────────────────────────────────────────────────────
function selectTicket(id) {
  activeTicket = tickets.find((t) => t.id === id);
  renderTickets();
  renderDetail(activeTicket);
  buildTimeline(activeTicket);
  if (chatOpen && activeTicket) setTicketContext(activeTicket);
}

// ── Render detail ─────────────────────────────────────────────────────────────
function renderDetail(ticket) {
  if (!ticket) return;
  const a = ticket.analyses?.[0];
  const div = document.getElementById("ticket-detail");
  if (!div) return;

  div.innerHTML = `
    <div class="detail-header">
      <div class="detail-title">${escHtml(ticket.title)}</div>
      <div class="detail-meta-row">
        <span class="meta-tag">${ticket.id}</span>
        <span class="meta-tag">${ticket.source}</span>
        <span class="meta-tag">${ticket.user_email || "—"}</span>
        <span class="status-badge status-${ticket.status}">${statusLabel(ticket.status)}</span>
      </div>
    </div>

    <div class="detail-section">
      <div class="section-label">Description</div>
      <div class="section-value">${escHtml(ticket.description || "—")}</div>
    </div>

    ${
      a
        ? `
      <div class="detail-section">
        <div class="section-label">AI Analysis</div>
        <div class="ai-summary">
          <div class="ai-summary-title">${escHtml(a.summary)}</div>
          <div class="ai-summary-sub">Root cause: ${escHtml(a.root_cause || "—")}</div>
        </div>
      </div>

      <div class="detail-section">
        <div class="section-label">Classification</div>
        <div class="chips-row">
          <span class="chip">📁 ${a.category}</span>
          <span class="chip sev-${a.severity}">${a.severity}</span>
          <span class="chip">⏱ ~${a.estimated_time_minutes} min</span>
          <span class="chip">${a.escalate ? "⚠️ Escalate" : "✅ Auto-fix"}</span>
        </div>
      </div>

      ${
        a.fix_script
          ? `
        <div class="detail-section">
          <div class="section-label">Fix Script</div>
          <div class="fix-script-box">
            <div class="fix-script-header">
              <span class="fix-script-label">bash / powershell</span>
              <button class="copy-btn" onclick="copyScript(\`${escHtml(a.fix_script)}\`)">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Copy
              </button>
            </div>
            <div class="fix-script-code">${escHtml(a.fix_script)}</div>
          </div>
        </div>
      `
          : `
        <div class="detail-section">
          <div class="section-label">Instructions</div>
          <div class="section-value">${escHtml(a.fix_instructions || "—")}</div>
        </div>
      `
      }

      ${
        a.escalate
          ? `
        <div class="detail-section">
          <div class="escalation-box">
            <div>
              <div class="escalation-title">⚠️ Human Approval Required</div>
              <div class="escalation-reason">${escHtml(a.escalate_reason || "")}</div>
              <div class="approval-btns">
                <button class="btn-approve" onclick="handleApproval('${ticket.id}', 'approve')">
                  ✓ Approve Fix
                </button>
                <button class="btn-reject" onclick="handleApproval('${ticket.id}', 'reject')">
                  ✕ Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      `
          : ""
      }
    `
        : `
      <div class="detail-section">
        <div class="empty-state">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
          <p>AI analysis in progress...</p>
        </div>
      </div>
    `
    }
  `;
}

// ── Human in the loop ─────────────────────────────────────────────────────────
async function handleApproval(ticketId, action) {
  const label = action === "approve" ? "approved" : "rejected";
  const color = action === "approve" ? "green" : "red";
  addActivity(color, `Fix ${label} by human reviewer`, `Ticket ${ticketId}`);
  showToast(
    action === "approve" ? "✅ Fix approved — executing..." : "❌ Fix rejected",
  );

  try {
    await fetch(`${FIREBASE_URL}/tickets/${ticketId}.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: action === "approve" ? "resolved" : "escalated",
        updated_at: new Date().toISOString(),
      }),
    });
    await loadAllTickets();
  } catch (e) {
    console.error("Approval error:", e);
    showToast("⚠️ Error updating ticket status");
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function updateStats() {
  const total = tickets.length;
  const resolved = tickets.filter((t) => t.status === "resolved").length;
  const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const times = tickets
    .filter((t) => t.analyses?.[0]?.estimated_time_minutes)
    .map((t) => t.analyses[0].estimated_time_minutes);
  const avg =
    times.length > 0
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : 0;

  document.getElementById("metric-total").textContent = total;
  document.getElementById("metric-rate").textContent = rate + "%";
  document.getElementById("metric-avg").textContent = avg + "m";
}

function updateNavBadges() {
  document.getElementById("nav-all").textContent = tickets.length;
  document.getElementById("nav-received").textContent = tickets.filter(
    (t) => t.status === "received",
  ).length;
  document.getElementById("nav-processing").textContent = tickets.filter(
    (t) => t.status === "processing",
  ).length;
  document.getElementById("nav-resolved").textContent = tickets.filter(
    (t) => t.status === "resolved",
  ).length;
  document.getElementById("nav-escalated").textContent = tickets.filter(
    (t) => t.status === "escalated",
  ).length;
}

// ── Activity feed ─────────────────────────────────────────────────────────────
function addActivity(color, text, sub) {
  activityLog.unshift({ color, text, sub, time: new Date() });
  if (activityLog.length > 50) activityLog.pop();
  renderActivity();
  const el = document.getElementById("activity-count");
  if (el) el.textContent = `${activityLog.length} events`;
}

function renderActivity() {
  const feed = document.getElementById("activity-feed");
  if (!feed) return;
  if (activityLog.length === 0) {
    feed.innerHTML = '<div class="empty-state small">No activity yet</div>';
    return;
  }
  feed.innerHTML = activityLog
    .map(
      (a) => `
    <div class="activity-item">
      <div class="activity-dot ${a.color}"></div>
      <div class="activity-body">
        <div class="activity-text">${escHtml(a.text)}</div>
        ${a.sub ? `<div class="activity-time">${escHtml(a.sub)}</div>` : ""}
        <div class="activity-time">${timeAgo(a.time)}</div>
      </div>
    </div>`,
    )
    .join("");
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function buildHeatmap() {
  const grid = document.getElementById("heatmap-grid");
  const total = document.getElementById("heatmap-total");
  if (!grid) return;

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const slots = 6;
  const now = new Date();
  const matrix = {};

  days.forEach((_, di) => {
    matrix[di] = {};
    for (let s = 0; s < slots; s++) matrix[di][s] = 0;
  });

  let totalCount = 0;
  tickets.forEach((t) => {
    const d = new Date(t.created_at);
    const diffD = Math.floor((now - d) / 86400000);
    if (diffD > 6) return;
    const dow = d.getDay();
    const slot = Math.min(Math.floor((d.getHours() - 6) / 3), slots - 1);
    if (slot < 0) return;
    matrix[dow][slot] = (matrix[dow][slot] || 0) + 1;
    totalCount++;
  });

  // Demo data si no hay tickets reales
  if (totalCount === 0) {
    days.forEach((_, di) => {
      for (let s = 0; s < slots; s++) {
        matrix[di][s] = Math.floor(Math.random() * 7);
        totalCount += matrix[di][s];
      }
    });
  }

  if (total) total.textContent = `${totalCount} tickets`;

  const maxVal = Math.max(
    ...Object.values(matrix).flatMap((r) => Object.values(r)),
    1,
  );
  const colors = ["#0f1623", "#1e3a5f", "#1d4ed8", "#3b82f6", "#93c5fd"];
  const getColor = (v) => {
    if (v === 0) return colors[0];
    return colors[
      Math.min(Math.ceil((v / maxVal) * (colors.length - 1)), colors.length - 1)
    ];
  };

  const today = now.getDay();
  const ordered = Array.from({ length: 7 }, (_, i) => (today - 6 + i + 7) % 7);

  grid.innerHTML = ordered
    .map(
      (di) => `
    <div class="heatmap-row">
      <span class="heatmap-day-label">${days[di]}</span>
      ${Array.from({ length: slots }, (_, s) => {
        const v = matrix[di][s] || 0;
        const hour = 6 + s * 3;
        return `<div class="heatmap-cell"
          style="background:${getColor(v)}"
          data-tip="${hour}:00 — ${v} ticket${v !== 1 ? "s" : ""}"
          onclick="showToast('${hour}:00 — ${v} ticket${v !== 1 ? "s" : ""}')">
        </div>`;
      }).join("")}
    </div>`,
    )
    .join("");
}

// ── Timeline ──────────────────────────────────────────────────────────────────
function buildTimeline(ticket) {
  const wrap = document.getElementById("timeline-wrap");
  const countEl = document.getElementById("timeline-count");
  if (!wrap || !ticket) return;

  const a = ticket.analyses?.[0];
  if (countEl) countEl.textContent = ticket.id;

  const steps = [
    {
      label: "Ticket received",
      sub: `From ${ticket.source} · ${new Date(ticket.created_at).toLocaleTimeString()}`,
      state: "done",
      badge: ticket.source,
    },
    {
      label: "Saved to Firebase",
      sub: "Persisted to Realtime Database",
      state: "done",
      badge: "firebase",
    },
    {
      label: "UiPath Maestro triggered",
      sub: "Orchestration flow started",
      state: ticket.status !== "received" ? "done" : "active",
      badge: "maestro",
    },
    {
      label: "Groq AI analysis",
      sub: a
        ? `${a.category} · ${a.severity} · ~${a.estimated_time_minutes}min`
        : "Analyzing...",
      state: a ? "done" : "active",
      badge: a ? "llama-3.3-70b" : "processing",
    },
    {
      label: a?.escalate ? "Human approval requested" : "Auto-fix generated",
      sub: a?.escalate
        ? a.escalate_reason || "Waiting for reviewer"
        : a?.fix_script
          ? "Script ready"
          : "Instructions generated",
      state: a ? (a.escalate ? "error" : "done") : "pending",
      badge: a?.escalate ? "escalated" : "auto-fix",
    },
    {
      label: "Slack notification",
      sub: ticket.status !== "received" ? "IT team notified" : "Pending",
      state: ticket.status !== "received" ? "done" : "pending",
      badge: "slack",
    },
    {
      label: ticket.status === "escalated" ? "Jira issue created" : "Resolved",
      sub:
        ticket.status === "resolved"
          ? `Closed in ~${a?.estimated_time_minutes || "?"} min`
          : ticket.status === "escalated"
            ? "Tracked in Jira"
            : "Pending",
      state:
        ticket.status === "resolved"
          ? "done"
          : ticket.status === "escalated"
            ? "error"
            : "pending",
      badge: ticket.status,
    },
  ];

  wrap.innerHTML = `
    <div class="timeline">
      ${steps
        .map(
          (s) => `
        <div class="timeline-step">
          <div class="timeline-dot ${s.state}"></div>
          <div class="timeline-label">${s.label}</div>
          <div class="timeline-sub">${s.sub}</div>
          <span class="timeline-badge ${s.state}">${s.badge}</span>
        </div>`,
        )
        .join("")}
    </div>`;
}

// ── Chat ──────────────────────────────────────────────────────────────────────
const CHAT_SYSTEM = `You are ResolveAI, an expert IT support assistant integrated 
into an enterprise dashboard. Help IT teams analyze tickets, diagnose problems, 
and generate fix scripts. Be concise, technical, and actionable.
Use markdown-style formatting when helpful.
Keep responses under 150 words unless a detailed explanation is needed.`;

function toggleChat() {
  chatOpen = !chatOpen;
  document.getElementById("chat-window").classList.toggle("hidden", !chatOpen);
  if (chatOpen) {
    unreadCount = 0;
    document.getElementById("chat-badge").style.display = "none";
    if (activeTicket && chatContext?.id !== activeTicket.id)
      setTicketContext(activeTicket);
    setTimeout(() => document.getElementById("chat-input")?.focus(), 100);
  }
}

function setTicketContext(ticket) {
  chatContext = ticket;
  const bar = document.getElementById("chat-context-bar");
  const label = document.getElementById("chat-context-label");
  if (bar) bar.style.display = "flex";
  if (label) label.textContent = `Context: ${ticket.title}`;
}

function clearContext() {
  chatContext = null;
  const bar = document.getElementById("chat-context-bar");
  if (bar) bar.style.display = "none";
}

function clearChat() {
  chatHistory = [];
  document.getElementById("chat-messages").innerHTML = `
    <div class="chat-msg assistant">
      <div class="chat-bubble">Chat cleared. How can I help you?</div>
    </div>`;
  document.getElementById("chat-suggestions").style.display = "flex";
}

function sendSuggestion(btn) {
  document.getElementById("chat-suggestions").style.display = "none";
  document.getElementById("chat-input").value = btn.textContent;
  sendMessage();
}

async function sendMessage() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  document.getElementById("chat-send").disabled = true;
  document.getElementById("chat-suggestions").style.display = "none";
  appendMsg("user", text);

  // Build system context
  let systemMsg = CHAT_SYSTEM;

  if (chatContext) {
    const a = chatContext.analyses?.[0];
    systemMsg += `\n\nCURRENT TICKET CONTEXT:
Title: ${chatContext.title}
Source: ${chatContext.source}
Status: ${chatContext.status}
Description: ${chatContext.description}
${
  a
    ? `Analysis: ${a.summary}
Category: ${a.category} | Severity: ${a.severity}
Root cause: ${a.root_cause}
Fix script: ${a.fix_script || "N/A"}
Escalate: ${a.escalate}`
    : "No analysis yet"
}`;
  }

  const summary = tickets
    .slice(0, 10)
    .map(
      (t) =>
        `- [${t.status}] ${t.title} (${t.source}, ${t.analyses?.[0]?.severity || "unanalyzed"})`,
    )
    .join("\n");
  systemMsg += `\n\nDASHBOARD (${tickets.length} total tickets):\n${summary}`;

  const typingId = appendTyping();

  try {
    chatHistory.push({ role: "user", content: text });

    const resp = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.4,
          max_tokens: 400,
          messages: [
            { role: "system", content: systemMsg },
            ...chatHistory.slice(-8),
          ],
        }),
      },
    );

    const data = await resp.json();
    const reply =
      data.choices?.[0]?.message?.content || "Sorry, I could not process that.";

    chatHistory.push({ role: "assistant", content: reply });
    removeTyping(typingId);
    appendMsg("assistant", reply);
    addActivity("blue", "AI assistant responded", text.slice(0, 40) + "...");

    if (!chatOpen) {
      unreadCount++;
      const badge = document.getElementById("chat-badge");
      badge.textContent = unreadCount;
      badge.style.display = "flex";
    }
  } catch (e) {
    removeTyping(typingId);
    appendMsg(
      "assistant",
      "⚠️ Connection error. Check your Groq API key in config.js.",
    );
    console.error("Groq error:", e);
  }

  document.getElementById("chat-send").disabled = false;
  input.focus();
}

function appendMsg(role, text) {
  const msgs = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = `chat-msg ${role}`;
  const html = escHtml(text)
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
  div.innerHTML = `<div class="chat-bubble">${html}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function appendTyping() {
  const msgs = document.getElementById("chat-messages");
  const id = "typing-" + Date.now();
  const div = document.createElement("div");
  div.className = "chat-msg assistant";
  div.id = id;
  div.innerHTML = `
    <div class="chat-bubble">
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return id;
}

function removeTyping(id) {
  document.getElementById(id)?.remove();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusLabel(s) {
  return (
    {
      received: "Received",
      processing: "Processing",
      resolved: "Resolved",
      escalated: "Escalated",
    }[s] || s
  );
}

function sourceIcon(s) {
  return { servicenow: "🎫", gmail: "📧", manual: "✏️" }[s] || "📋";
}

function timeAgo(d) {
  const diff = Math.floor((Date.now() - new Date(d)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function escHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function copyScript(text) {
  navigator.clipboard.writeText(text);
  showToast("📋 Script copied to clipboard");
  addActivity("blue", "Fix script copied", "Ready to execute");
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 3000);
}
