const API_BASE = "https://revise.mrinal.dev/api";

// --- Token capture from dashboard callback URL ---
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && changeInfo.url.includes("/dashboard#access_token=")) {
    try {
      const hash = new URL(changeInfo.url).hash.substring(1);
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        chrome.storage.local.set({ auth: { access_token, refresh_token } });
      }
    } catch {}
  }
});

// --- Badge update with auth ---
async function updateBadge() {
  try {
    // Check for active timer first
    const timerData = await chrome.storage.local.get("timer");
    if (timerData.timer && timerData.timer.running) {
      chrome.action.setBadgeText({ text: "⏱" });
      chrome.action.setBadgeBackgroundColor({ color: "#047857" });
      return;
    }

    // Get auth token
    const authData = await chrome.storage.local.get("auth");
    const auth = authData.auth;
    if (!auth || !auth.access_token) {
      chrome.action.setBadgeText({ text: "" });
      return;
    }

    const resp = await fetch(`${API_BASE}/revisions/today`, {
      headers: { Authorization: `Bearer ${auth.access_token}` },
    });
    if (resp.ok) {
      const data = await resp.json();
      const count = data.length;
      chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
      chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
    } else if (resp.status === 401) {
      // Try refresh
      if (auth.refresh_token) {
        try {
          const refreshResp = await fetch(`${API_BASE}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: auth.refresh_token }),
          });
          if (refreshResp.ok) {
            const tokens = await refreshResp.json();
            await chrome.storage.local.set({ auth: tokens });
            // Retry with new token
            const retry = await fetch(`${API_BASE}/revisions/today`, {
              headers: { Authorization: `Bearer ${tokens.access_token}` },
            });
            if (retry.ok) {
              const data = await retry.json();
              const count = data.length;
              chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
              chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
            }
          }
        } catch {}
      }
    }
  } catch {
    chrome.action.setBadgeText({ text: "" });
  }
}

// Update badge every 30 minutes
chrome.alarms.create("checkRevisions", { periodInMinutes: 30 });

// Also update badge every minute when timer might be active
chrome.alarms.create("checkTimer", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkRevisions" || alarm.name === "checkTimer") {
    updateBadge();
  }
});

// Update on install/startup
chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);

// Update badge when storage changes (timer start/stop or auth change)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.timer || changes.auth)) {
    updateBadge();
  }
});

// --- Speech-to-text offscreen document ---
let offscreenCreated = false;

async function ensureOffscreen() {
  if (offscreenCreated) return;
  try {
    const existing = await chrome.offscreen.hasDocument();
    if (existing) { offscreenCreated = true; return; }
  } catch {}
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Speech recognition for notes overlay",
    });
    offscreenCreated = true;
  } catch {}
}

// Relay speech messages between content script and offscreen document
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "speech-start-relay") {
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage({ type: "speech-start", id: msg.id });
    });
  } else if (msg.type === "speech-stop-relay") {
    chrome.runtime.sendMessage({ type: "speech-stop" });
  } else if (msg.type === "speech-result" || msg.type === "speech-end" || msg.type === "speech-error") {
    // Forward from offscreen to the content script tab
    if (msg.tabId) {
      chrome.tabs.sendMessage(msg.tabId, msg);
    } else {
      // Broadcast to all tabs (offscreen doesn't know the tab)
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          try { chrome.tabs.sendMessage(tab.id, msg); } catch {}
        }
      });
    }
  }
});

// --- Toggle overlay command ---
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-overlay") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "toggleOverlay" });
      }
    });
  }
});
