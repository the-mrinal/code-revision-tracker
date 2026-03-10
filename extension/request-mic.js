document.getElementById("grant").addEventListener("click", async () => {
  const status = document.getElementById("status");
  const btn = document.getElementById("grant");
  btn.disabled = true;
  btn.textContent = "Requesting...";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop immediately — we just needed the permission grant
    stream.getTracks().forEach((track) => track.stop());
    status.textContent = "Microphone access granted! You can close this tab.";
    status.className = "success";
    btn.textContent = "Granted";
    // Notify background
    chrome.runtime.sendMessage({ type: "mic-permission-granted" });
  } catch (err) {
    status.textContent = "Permission denied. Please allow microphone access and try again.";
    status.className = "error";
    btn.disabled = false;
    btn.textContent = "Allow Microphone Access";
  }
});
