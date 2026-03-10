let recognition = null;
let currentTabId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "check-mic-permission") {
    navigator.permissions.query({ name: "microphone" }).then((result) => {
      sendResponse({ granted: result.state === "granted" });
    });
    return true; // keep sendResponse alive for async
  }

  if (message.type === "start-speech") {
    currentTabId = message.tabId;
    startRecognition();
  }

  if (message.type === "stop-speech") {
    stopRecognition();
  }
});

function startRecognition() {
  if (recognition) {
    try { recognition.abort(); } catch {}
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    chrome.runtime.sendMessage({
      type: "speech-error",
      error: "not-supported",
      tabId: currentTabId,
    });
    return;
  }

  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      chrome.runtime.sendMessage({
        type: "speech-result",
        transcript: event.results[i][0].transcript,
        isFinal: event.results[i].isFinal,
        tabId: currentTabId,
      });
    }
  };

  recognition.onerror = (event) => {
    chrome.runtime.sendMessage({
      type: "speech-error",
      error: event.error,
      tabId: currentTabId,
    });
  };

  recognition.onend = () => {
    chrome.runtime.sendMessage({
      type: "speech-end",
      tabId: currentTabId,
    });
    recognition = null;
  };

  recognition.start();
}

function stopRecognition() {
  if (recognition) {
    try { recognition.stop(); } catch {}
    recognition = null;
  }
}
