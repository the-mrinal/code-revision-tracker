(function() {
  let recognition = null;
  window.addEventListener("message", function(e) {
    if (e.source !== window) return;
    if (e.data && e.data.type === "revise-speech-start") {
      if (recognition) { try { recognition.stop(); } catch {} }
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        window.postMessage({ type: "revise-speech-error", error: "not-supported", id: e.data.id }, "*");
        return;
      }
      recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = function(evt) {
        let interim = "", final = "";
        for (let i = 0; i < evt.results.length; i++) {
          if (evt.results[i].isFinal) final += evt.results[i][0].transcript;
          else interim += evt.results[i][0].transcript;
        }
        window.postMessage({ type: "revise-speech-result", final: final, interim: interim, id: e.data.id }, "*");
      };
      recognition.onend = function() {
        window.postMessage({ type: "revise-speech-end", id: e.data.id }, "*");
        recognition = null;
      };
      recognition.onerror = function(evt) {
        window.postMessage({ type: "revise-speech-error", error: evt.error, id: e.data.id }, "*");
      };
      recognition.start();
    } else if (e.data && e.data.type === "revise-speech-stop") {
      if (recognition) { try { recognition.stop(); } catch {} }
    }
  });
})();
