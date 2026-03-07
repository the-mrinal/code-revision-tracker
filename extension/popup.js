const API = "https://revise.mrinal.dev/api";

let selectedRating = 0;
let timerInterval = null;
let finishTimerData = null;

// --- Auth helpers ---
function getAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.get("auth", (data) => resolve(data.auth || null));
  });
}

function setAuth(auth) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ auth }, resolve);
  });
}

function clearAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.remove("auth", resolve);
  });
}

async function apiFetch(path, options = {}) {
  const auth = await getAuth();
  if (!auth || !auth.access_token) {
    throw new Error("Not authenticated");
  }
  const headers = { ...options.headers, Authorization: `Bearer ${auth.access_token}` };
  let r = await fetch(`${API}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (r.status === 401 && auth.refresh_token) {
    try {
      const refreshResp = await fetch(`${API}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: auth.refresh_token }),
      });
      if (refreshResp.ok) {
        const tokens = await refreshResp.json();
        await setAuth(tokens);
        headers.Authorization = `Bearer ${tokens.access_token}`;
        r = await fetch(`${API}${path}`, { ...options, headers });
      } else {
        await clearAuth();
        showLoginView();
        throw new Error("Session expired");
      }
    } catch (e) {
      await clearAuth();
      showLoginView();
      throw e;
    }
  }
  return r;
}

// --- Views ---
const loginView = document.getElementById("loginView");
const startView = document.getElementById("startView");
const timerView = document.getElementById("timerView");
const finishView = document.getElementById("finishView");

function hideAllViews() {
  loginView.style.display = "none";
  startView.style.display = "none";
  timerView.style.display = "none";
  finishView.style.display = "none";
}

function showView(view) {
  hideAllViews();
  view.style.display = "block";
}

function showLoginView() {
  showView(loginView);
  document.getElementById("signOutLink").style.display = "none";
}

// --- Auth init ---
async function initAuth() {
  const auth = await getAuth();
  if (!auth || !auth.access_token) {
    showLoginView();
    return;
  }
  // Validate token by hitting a protected endpoint
  try {
    const r = await apiFetch("/stats");
    if (r.ok) {
      document.getElementById("signOutLink").style.display = "inline";
      document.getElementById("statusDot").classList.add("connected");
      document.getElementById("statusText").textContent = "Server connected";
      checkActiveTimer();
      loadRevisions();
      return;
    }
  } catch {}
  // Token invalid
  showLoginView();
}

// --- Send magic link ---
document.getElementById("sendMagicLinkBtn").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();
  if (!email) return;
  const btn = document.getElementById("sendMagicLinkBtn");
  const status = document.getElementById("loginStatus");
  btn.disabled = true;
  btn.textContent = "Sending...";
  try {
    const r = await fetch(`${API}/auth/magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (r.ok) {
      status.textContent = "Check your email for the magic link!";
      status.style.color = "#6ee7b7";
    } else {
      const err = await r.json();
      status.textContent = err.detail || "Failed to send link";
      status.style.color = "#fca5a5";
    }
  } catch (e) {
    status.textContent = "Server offline";
    status.style.color = "#fca5a5";
  }
  btn.disabled = false;
  btn.textContent = "Send Magic Link";
});

// --- Sign out ---
document.getElementById("signOutLink").addEventListener("click", async (e) => {
  e.preventDefault();
  await clearAuth();
  showLoginView();
});

// --- Star rating ---
document.querySelectorAll("#stars .star").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedRating = parseInt(btn.dataset.value);
    document.querySelectorAll("#stars .star").forEach((s, i) => {
      s.classList.toggle("active", i < selectedRating);
    });
    document.getElementById("finishBtn").disabled = selectedRating === 0;
  });
});

// --- Populate pattern dropdown ---
function populatePatternSelect() {
  const sel = document.getElementById("patternSelect");
  sel.innerHTML = '<option value="">None</option>' +
    PATTERN_LABELS.map(l => `<option value="${l}">${l}</option>`).join('');
}
populatePatternSelect();

// --- Auto-fill URL from active tab ---
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]?.url) {
    document.getElementById("url").value = tabs[0].url;
    if (tabs[0].title) {
      document.getElementById("title").value = tabs[0].title;
    }
    document.getElementById("startTimerBtn").disabled = false;

    // Detect and show pattern for LeetCode pages
    const pattern = detectPattern(tabs[0].url);
    if (pattern) {
      document.getElementById("patternTag").style.display = "block";
      document.getElementById("patternLabel").textContent = pattern;
      document.getElementById("patternSelect").value = pattern;
    }
  }
});

// --- Server connection check ---
async function checkServer() {
  try {
    const r = await apiFetch("/stats");
    if (r.ok) {
      document.getElementById("statusDot").classList.add("connected");
      document.getElementById("statusText").textContent = "Server connected";
      return true;
    }
  } catch {}
  document.getElementById("statusDot").classList.remove("connected");
  document.getElementById("statusText").textContent =
    "Server offline — start with: docker compose up -d";
  return false;
}

// --- Format seconds to HH:MM:SS ---
function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

// --- Get elapsed seconds from timer state ---
function getElapsedSeconds(timerState) {
  let elapsed = timerState.accumulated || 0;
  if (timerState.running && timerState.startTime) {
    elapsed += Math.floor((Date.now() - timerState.startTime) / 1000);
  }
  return elapsed;
}

// --- Timer display update loop ---
function startDisplayLoop() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    chrome.storage.local.get("timer", (data) => {
      if (data.timer) {
        document.getElementById("timerDisplay").textContent = formatTime(
          getElapsedSeconds(data.timer)
        );
      }
    });
  }, 1000);
}

// --- Check for active timer on popup open ---
function checkActiveTimer() {
  chrome.storage.local.get("timer", (data) => {
    const timer = data.timer;
    if (timer && timer.questionId) {
      showView(timerView);
      document.getElementById("timerTitle").textContent =
        timer.title || timer.url || "Untitled";
      document.getElementById("timerDisplay").textContent = formatTime(
        getElapsedSeconds(timer)
      );

      const pauseBtn = document.getElementById("pauseBtn");
      if (timer.running) {
        pauseBtn.textContent = "Pause";
        pauseBtn.classList.remove("paused");
      } else {
        pauseBtn.textContent = "Resume";
        pauseBtn.classList.add("paused");
      }

      startDisplayLoop();
    } else {
      showView(startView);
    }
  });
}

// --- Start Timer ---
document.getElementById("startTimerBtn").addEventListener("click", async () => {
  const btn = document.getElementById("startTimerBtn");
  btn.disabled = true;
  btn.textContent = "Starting...";

  const url = document.getElementById("url").value;
  const title = document.getElementById("title").value || null;

  const payload = {
    url,
    title,
    self_rating: 3,
    difficulty: null,
    time_taken: null,
    notes: null,
  };

  try {
    const r = await apiFetch("/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (r.ok) {
      const question = await r.json();

      const timerState = {
        questionId: question.id,
        url: url,
        title: title || url,
        startTime: Date.now(),
        accumulated: 0,
        running: true,
      };
      chrome.storage.local.set({ timer: timerState });

      showToast("Timer started!", "success");
      checkActiveTimer();
    } else {
      let msg = "Server error (" + r.status + ")";
      try {
        const err = await r.json();
        msg =
          typeof err.detail === "string"
            ? err.detail
            : JSON.stringify(err.detail);
      } catch {}
      showToast(msg, "error");
    }
  } catch (e) {
    showToast("Cannot reach server: " + e.message, "error");
  }

  btn.disabled = false;
  btn.textContent = "Start Timer";
});

// --- Toggle pause/resume ---
function togglePause() {
  chrome.storage.local.get("timer", (data) => {
    const timer = data.timer;
    if (!timer) return;

    if (timer.running) {
      timer.accumulated += Math.floor(
        (Date.now() - timer.startTime) / 1000
      );
      timer.startTime = null;
      timer.running = false;
    } else {
      timer.startTime = Date.now();
      timer.running = true;
    }

    chrome.storage.local.set({ timer }, () => {
      checkActiveTimer();
    });
  });
}

// --- Stop timer and show finish form ---
function showFinishForm() {
  chrome.storage.local.get("timer", (data) => {
    const timer = data.timer;
    if (!timer) return;

    if (timer.running) {
      timer.accumulated += Math.floor(
        (Date.now() - timer.startTime) / 1000
      );
      timer.startTime = null;
      timer.running = false;
      chrome.storage.local.set({ timer });
    }

    const totalSeconds = timer.accumulated;
    const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));

    finishTimerData = {
      questionId: timer.questionId,
      totalMinutes,
      totalSeconds,
    };

    showView(finishView);
    if (timerInterval) clearInterval(timerInterval);

    document.getElementById("finishTitle").textContent =
      timer.title || "Untitled";
    document.getElementById("finishTime").textContent =
      formatTime(totalSeconds) + ` (${totalMinutes} min)`;

    selectedRating = 0;
    document.querySelectorAll("#stars .star").forEach((s) =>
      s.classList.remove("active")
    );
    document.getElementById("finishBtn").disabled = true;
  });
}

// --- Save final details ---
document.getElementById("finishBtn").addEventListener("click", async () => {
  if (!finishTimerData) return;
  const btn = document.getElementById("finishBtn");
  btn.disabled = true;
  btn.textContent = "Saving...";

  const payload = {
    self_rating: selectedRating,
    difficulty: document.getElementById("difficulty").value || null,
    time_taken: finishTimerData.totalMinutes,
    notes: document.getElementById("notes").value || null,
    pattern: document.getElementById("patternSelect").value || null,
  };

  try {
    // First: run SM2 review to update next_review and last_reviewed
    const reviewRes = await apiFetch(
      `/questions/${finishTimerData.questionId}/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ self_rating: selectedRating }),
      }
    );

    if (!reviewRes.ok) {
      let msg = "Failed to save review";
      try { const err = await reviewRes.json(); msg = err.detail || msg; } catch {}
      showToast(msg, "error");
      btn.disabled = false;
      btn.textContent = "Save";
      return;
    }

    // Then: update extra metadata (difficulty, time, notes)
    const r = await apiFetch(
      `/questions/${finishTimerData.questionId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (r.ok || reviewRes.ok) {
      showToast(
        `Saved! ${finishTimerData.totalMinutes} min recorded.`,
        "success"
      );

      chrome.storage.local.remove("timer");
      finishTimerData = null;

      selectedRating = 0;
      document.querySelectorAll("#stars .star").forEach((s) =>
        s.classList.remove("active")
      );
      document.getElementById("difficulty").value = "";
      document.getElementById("notes").value = "";
      document.getElementById("patternSelect").value = "";
      showView(startView);
      loadRevisions();
    } else {
      let msg = "Failed to save";
      try {
        const err = await r.json();
        msg =
          typeof err.detail === "string"
            ? err.detail
            : JSON.stringify(err.detail);
      } catch {}
      showToast(msg, "error");
      btn.disabled = false;
    }
  } catch {
    showToast("Cannot reach server", "error");
    btn.disabled = false;
  }

  btn.textContent = "Save & Finish";
});

// --- Toast ---
function showToast(msg, type) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.style.display = "block";
  setTimeout(() => (el.style.display = "none"), 3000);
}

// --- Load revisions due today ---
async function loadRevisions() {
  try {
    const r = await apiFetch("/revisions/today");
    if (!r.ok) return;
    const items = await r.json();
    document.getElementById("revCount").textContent = items.length;

    const list = document.getElementById("revisionList");
    if (items.length === 0) {
      list.innerHTML =
        '<div class="empty-state">No revisions due today!</div>';
      return;
    }

    list.innerHTML = items
      .map(
        (q) => `
      <div class="revision-item">
        <a href="${q.url}" target="_blank">${q.title || q.url}</a>
        <span class="platform-tag">${q.platform || ""}</span>
      </div>`
      )
      .join("");
  } catch {
    document.getElementById("revisionList").innerHTML =
      '<div class="empty-state">Server offline</div>';
  }
}

// --- Button event listeners ---
document.getElementById("pauseBtn").addEventListener("click", togglePause);
document.getElementById("stopBtn").addEventListener("click", showFinishForm);

// --- Init ---
initAuth();
