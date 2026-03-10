let recognition = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "speech-start") {
    if (recognition) { try { recognition.stop(); } catch {} }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      chrome.runtime.sendMessage({ type: "speech-error", error: "not-supported", id: msg.id });
      return;
    }
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (evt) => {
      let interim = "", final = "";
      for (let i = 0; i < evt.results.length; i++) {
        if (evt.results[i].isFinal) final += evt.results[i][0].transcript;
        else interim += evt.results[i][0].transcript;
      }
      chrome.runtime.sendMessage({ type: "speech-result", final, interim, id: msg.id });
    };
    recognition.onend = () => {
      chrome.runtime.sendMessage({ type: "speech-end", id: msg.id });
      recognition = null;
    };
    recognition.onerror = (evt) => {
      chrome.runtime.sendMessage({ type: "speech-error", error: evt.error, id: msg.id });
    };
    recognition.start();
  } else if (msg.type === "speech-stop") {
    if (recognition) { try { recognition.stop(); } catch {} }
  }
});
