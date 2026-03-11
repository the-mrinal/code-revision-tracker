const API_BASE = "https://revise.mrinal.dev/api";

// --- Proactive token refresh ---
let refreshInProgress = null; // Promise lock to prevent concurrent refreshes

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch { return null; }
}

function tokenExpiresWithin(token, seconds) {
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.exp) return true; // treat as expired if unreadable
  return (payload.exp - Date.now() / 1000) < seconds;
}

async function refreshAuthToken() {
  // If a refresh is already in progress, wait for it
  if (refreshInProgress) return refreshInProgress;

  refreshInProgress = (async () => {
    try {
      const authData = await chrome.storage.local.get("auth");
      const auth = authData.auth;
      if (!auth?.refresh_token) return null;

      // Skip if token still has >5 minutes left
      if (auth.access_token && !tokenExpiresWithin(auth.access_token, 300)) {
        return auth;
      }

      console.log("[Revise] Proactively refreshing token");
      const resp = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: auth.refresh_token }),
      });

      if (resp.ok) {
        const tokens = await resp.json();
        await chrome.storage.local.set({ auth: tokens });
        console.log("[Revise] Token refreshed successfully");
        return tokens;
      } else {
        console.warn("[Revise] Token refresh failed:", resp.status);
        return null;
      }
    } catch (e) {
      console.error("[Revise] Token refresh error:", e);
      return null;
    } finally {
      refreshInProgress = null;
    }
  })();

  return refreshInProgress;
}

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
      const refreshed = await refreshAuthToken();
      if (refreshed?.access_token) {
        const retry = await fetch(`${API_BASE}/revisions/today`, {
          headers: { Authorization: `Bearer ${refreshed.access_token}` },
        });
        if (retry.ok) {
          const data = await retry.json();
          const count = data.length;
          chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
          chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
        }
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

// Proactive token refresh every 5 minutes
chrome.alarms.create("refreshToken", { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refreshToken") {
    refreshAuthToken();
  } else if (alarm.name === "checkRevisions" || alarm.name === "checkTimer") {
    updateBadge();
  }
});

// Update on install/startup — refresh token first, then update badge
chrome.runtime.onInstalled.addListener(() => { refreshAuthToken().then(updateBadge); });
chrome.runtime.onStartup.addListener(() => { refreshAuthToken().then(updateBadge); });

// Update badge when storage changes (timer start/stop or auth change)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.timer || changes.auth)) {
    updateBadge();
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
