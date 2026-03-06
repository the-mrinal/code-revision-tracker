const API = "http://localhost:8765/api";

let selectedRating = 0;

// --- Star rating ---
document.querySelectorAll("#stars .star").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedRating = parseInt(btn.dataset.value);
    document.querySelectorAll("#stars .star").forEach((s, i) => {
      s.classList.toggle("active", i < selectedRating);
    });
    checkReady();
  });
});

// --- Auto-fill URL from active tab ---
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]?.url) {
    document.getElementById("url").value = tabs[0].url;
    // Try to extract title from tab
    if (tabs[0].title) {
      document.getElementById("title").value = tabs[0].title;
    }
  }
});

// --- Server connection check ---
async function checkServer() {
  try {
    const r = await fetch(`${API}/stats`);
    if (r.ok) {
      document.getElementById("statusDot").classList.add("connected");
      document.getElementById("statusText").textContent = "Server connected";
      return true;
    }
  } catch {}
  document.getElementById("statusDot").classList.remove("connected");
  document.getElementById("statusText").textContent = "Server offline — start with: docker compose up -d";
  return false;
}

function checkReady() {
  const url = document.getElementById("url").value;
  document.getElementById("submitBtn").disabled = !(url && selectedRating > 0);
}

document.getElementById("url").addEventListener("input", checkReady);

// --- Submit ---
document.getElementById("submitBtn").addEventListener("click", async () => {
  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.textContent = "Saving...";

  const payload = {
    url: document.getElementById("url").value,
    title: document.getElementById("title").value || null,
    difficulty: document.getElementById("difficulty").value || null,
    self_rating: selectedRating,
    time_taken: parseInt(document.getElementById("timeTaken").value) || null,
    notes: document.getElementById("notes").value || null,
  };

  try {
    const r = await fetch(`${API}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (r.ok) {
      showToast("Question saved! Next review scheduled.", "success");
      // Reset form
      selectedRating = 0;
      document.querySelectorAll("#stars .star").forEach((s) => s.classList.remove("active"));
      document.getElementById("difficulty").value = "";
      document.getElementById("timeTaken").value = "";
      document.getElementById("notes").value = "";
      loadRevisions();
    } else {
      const err = await r.json();
      showToast(err.detail || "Failed to save", "error");
    }
  } catch {
    showToast("Cannot reach server", "error");
  }

  btn.textContent = "Save Question";
  checkReady();
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
    const r = await fetch(`${API}/revisions/today`);
    if (!r.ok) return;
    const items = await r.json();
    document.getElementById("revCount").textContent = items.length;

    const list = document.getElementById("revisionList");
    if (items.length === 0) {
      list.innerHTML = '<div class="empty-state">No revisions due today!</div>';
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

// --- Init ---
checkServer().then(() => loadRevisions());
