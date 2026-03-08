// Content script that runs on the dashboard page after magic link callback.
// Captures access_token and refresh_token from the URL hash fragment or localStorage.
(function () {
  // Try URL hash first (magic link callback flow)
  const hash = location.hash;
  if (hash && hash.includes("access_token=")) {
    const params = new URLSearchParams(hash.substring(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token && refresh_token) {
      chrome.storage.local.set({ auth: { access_token, refresh_token } }, () => {
        history.replaceState(null, "", location.pathname);
      });
      return;
    }
  }

  // Fallback: pull tokens from dashboard's localStorage (re-sync flow)
  try {
    const raw = localStorage.getItem("auth");
    if (raw) {
      const tokens = JSON.parse(raw);
      if (tokens.access_token && tokens.refresh_token) {
        chrome.storage.local.set({ auth: tokens });
      }
    }
  } catch {}
})();
