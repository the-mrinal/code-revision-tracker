const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SR) {
  document.getElementById("transcript").textContent = "Speech recognition not supported.";
  document.getElementById("transcript").className = "error";
} else {
  const recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    let text = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      text += result[0].transcript;
      chrome.runtime.sendMessage({
        type: "speech-result",
        transcript: result[0].transcript,
        isFinal: result.isFinal,
      });
    }
    document.getElementById("transcript").textContent = text;
  };

  recognition.onerror = (event) => {
    if (event.error === "not-allowed") {
      document.getElementById("transcript").textContent = "Microphone access denied. Please allow in Chrome settings.";
      document.getElementById("transcript").className = "error";
      document.querySelector("h3").textContent = "Permission Needed";
      document.getElementById("dot").style.background = "#fbbf24";
      document.getElementById("dot").style.animation = "none";
    } else if (event.error !== "aborted" && event.error !== "no-speech") {
      chrome.runtime.sendMessage({
        type: "speech-error",
        error: event.error,
      });
    }
  };

  recognition.onend = () => {
    // Restart if window is still open (continuous listening)
    try { recognition.start(); } catch {}
  };

  recognition.start();
  chrome.runtime.sendMessage({ type: "speech-window-ready" });
}
