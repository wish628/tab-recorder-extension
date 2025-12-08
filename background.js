console.log("Background (service worker) loaded.");

let recorder = null;
let chunks = [];
let activeStream = null; // the screen (video) stream
let micStream = null;    // microphone stream (optional)
let isRecording = false;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.cmd === "start-recording") {
    startRecording()
      .then(() => sendResponse({ ok: true, message: "Recording started." }))
      .catch((err) => sendResponse({ ok: false, message: err?.message || "Start failed." }));
    return true; // keep message channel open for async response
  }

  if (msg?.cmd === "stop-recording") {
    stopRecording()
      .then(() => sendResponse({ ok: true, message: "Recording stopped (saving file)." }))
      .catch((err) => sendResponse({ ok: false, message: err?.message || "Stop failed." }));
    return true;
  }
});

async function startRecording() {
  if (isRecording) throw new Error("Already recording.");

  // 1) Ask user what to share (this must run in the extension context—background/service worker)
  const streamId = await new Promise((resolve, reject) => {
    chrome.desktopCapture.chooseDesktopMedia(["screen", "window", "tab"], (id) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!id) return reject(new Error("User cancelled screen selection."));
      resolve(id);
    });
  });

  // 2) Get the screen stream (video)
  const screenConstraints = {
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: streamId,
        maxWidth: 1920,
        maxHeight: 1080,
        maxFrameRate: 30
      }
    },
    audio: false
  };

  activeStream = await navigator.mediaDevices.getUserMedia(screenConstraints);

  // 3) Optional: microphone (if user allows). If they deny, we still record video-only.
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (e) {
    micStream = null;
  }

  // 4) Merge audio (if available) with screen video
  let finalStream;
  if (micStream && micStream.getAudioTracks().length > 0) {
    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    const micSource = audioCtx.createMediaStreamSource(micStream);
    micSource.connect(dest);

    finalStream = new MediaStream([
      ...activeStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);
  } else {
    finalStream = activeStream;
  }

  // 5) Create MediaRecorder and start
  const mime = pickSupportedMime();
  chunks = [];
  recorder = new MediaRecorder(finalStream, mime ? { mimeType: mime } : undefined);

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  recorder.onstop = () => {
    // nothing here; we handle save in stopRecording() after recorder stops
  };

  recorder.start(1000);
  isRecording = true;
  notifyStatus("Recording… (click STOP to finish)");
}

async function stopRecording() {
  if (!isRecording || !recorder) throw new Error("Not currently recording.");

  // Stop recorder and wait for it to finish flushing data
  await new Promise((resolve) => {
    recorder.onstop = resolve;
    recorder.stop();
  });

  isRecording = false;
  notifyStatus("Processing and saving…");

  // Stop media tracks to free capture resources
  try { activeStream?.getTracks().forEach(t => t.stop()); } catch (_) {}
  try { micStream?.getTracks().forEach(t => t.stop()); } catch (_) {}

  // Save file
  const blob = new Blob(chunks, { type: (recorder?.mimeType || "video/webm") });
  chunks = [];

  if (blob.size === 0) throw new Error("No data captured (empty recording).");

  const url = URL.createObjectURL(blob);
  const filename = `screen-recording-${Date.now()}.webm`;

  await new Promise((resolve, reject) => {
    chrome.downloads.download({ url, filename }, (id) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      // revoke after a moment (download has already read from the blob URL)
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      resolve(id);
    });
  });

  notifyStatus("Saved: " + filename);
}

function pickSupportedMime() {
  const candidates = [
    'video/webm;codecs="vp9,opus"',
    'video/webm;codecs="vp8,opus"',
    'video/webm;codecs="vp8,vorbis"',
    "video/webm"
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function notifyStatus(text) {
  // Best-effort UI update (popup may or may not be open)
  chrome.runtime.sendMessage({ type: "status", text });
}