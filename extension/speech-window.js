const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SR) {
  document.getElementById("transcript").textContent = "Speech recognition not supported.";
  document.getElementById("transcript").className = "error";
} else {
  let retryCount = 0;
  const MAX_RETRIES = 3;

  function startRecognition() {
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      retryCount = 0; // Reset retries on successful result
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
        return;
      }
      // Network errors are transient — retry silently
      if (event.error === "network" || event.error === "service-not-allowed") {
        retryCount++;
        if (retryCount <= MAX_RETRIES) {
          document.getElementById("transcript").textContent = "Reconnecting...";
          setTimeout(() => startRecognition(), 1000);
        } else {
          document.getElementById("transcript").textContent = "Speech service unavailable. Close and try again.";
          document.getElementById("transcript").className = "error";
          document.getElementById("dot").style.background = "#fbbf24";
          document.getElementById("dot").style.animation = "none";
          chrome.runtime.sendMessage({ type: "speech-error", error: event.error });
        }
        return;
      }
      // Ignore no-speech and aborted
      if (event.error === "no-speech" || event.error === "aborted") return;
      // Other errors — relay to content script
      chrome.runtime.sendMessage({ type: "speech-error", error: event.error });
    };

    recognition.onend = () => {
      // Auto-restart for continuous listening
      setTimeout(() => startRecognition(), 200);
    };

    recognition.start();
  }

  startRecognition();
  chrome.runtime.sendMessage({ type: "speech-window-ready" });
}
