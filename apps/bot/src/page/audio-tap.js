/*
 * Injected before every page navigation.
 *
 * Meet, Zoom web, Teams web and Jitsi all decode remote participant audio in
 * WebRTC. The browser already has PCM; there is no need for a virtual sound
 * card. Patch RTCPeerConnection, mirror each remote audio track into a hidden
 * <audio> element, mix the streams in a Web Audio graph and forward 16 kHz
 * mono PCM to the bot runner through the binding it exposes.
 */
(() => {
  if (window.__clickTapInstalled) return;
  window.__clickTapInstalled = true;

  const TARGET_RATE = 16000;
  const state = {
    context: null,
    mixer: null,
    processor: null,
    silent: null,
    started: false,
    streams: [],
    tracks: new Set(),
    nodes: new Map(),
    pending: new Float32Array(0),
    chunks: 0,
    bytes: 0,
    peak: 0,
    lastAudioAt: 0,
  };
  window.__clickTapStats = state;

  function log(message) {
    try {
      if (typeof window.__clickTapLog === "function") window.__clickTapLog(message);
    } catch {
      /* logging must never break capture */
    }
  }

  function createContext() {
    if (state.context) return state.context;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    try {
      const context = new AudioContextCtor({ latencyHint: "interactive" });
      const mixer = context.createGain();
      mixer.gain.value = 0.85;
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silent = context.createGain();
      silent.gain.value = 0;
      mixer.connect(processor);
      processor.connect(silent);
      silent.connect(context.destination);
      processor.onaudioprocess = (event) => {
        if (!state.started) return;
        const input = event.inputBuffer.getChannelData(0);
        if (!input || input.length === 0) return;
        let peak = 0;
        for (let i = 0; i < input.length; i += 1) {
          const value = Math.abs(input[i]);
          if (value > peak) peak = value;
        }
        if (peak > state.peak) state.peak = peak;
        if (peak > 0.0015) state.lastAudioAt = Date.now();
        appendResampled(input, context.sampleRate);
      };
      state.context = context;
      state.mixer = mixer;
      state.processor = processor;
      state.silent = silent;
      return context;
    } catch (error) {
      log(`audio context failed: ${error && error.message ? error.message : error}`);
      return null;
    }
  }

  function appendResampled(input, inputRate) {
    const ratio = inputRate / TARGET_RATE;
    const outputLength = Math.max(1, Math.floor(input.length / ratio));
    const resampled = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i += 1) {
      const position = i * ratio;
      const left = Math.floor(position);
      const right = Math.min(input.length - 1, left + 1);
      const fraction = position - left;
      resampled[i] = input[left] * (1 - fraction) + input[right] * fraction;
    }

    const merged = new Float32Array(state.pending.length + resampled.length);
    merged.set(state.pending, 0);
    merged.set(resampled, state.pending.length);
    state.pending = merged;

    // 200 ms batches keep the binding traffic low without adding noticeable
    // latency for the batch pipeline that consumes the WAV.
    const batch = TARGET_RATE / 5;
    while (state.pending.length >= batch) {
      const slice = state.pending.slice(0, batch);
      state.pending = state.pending.slice(batch);
      send(slice);
    }
  }

  function send(samples) {
    const pcm = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i += 1) {
      const value = Math.max(-1, Math.min(1, samples[i]));
      pcm[i] = value < 0 ? value * 0x8000 : value * 0x7fff;
    }
    const bytes = new Uint8Array(pcm.buffer);
    let binary = "";
    const stride = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += stride) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + stride));
    }
    try {
      if (typeof window.__clickAudioChunk === "function") window.__clickAudioChunk(window.btoa(binary));
      state.chunks += 1;
      state.bytes += bytes.length;
    } catch (error) {
      log(`audio chunk failed: ${error && error.message ? error.message : error}`);
    }
  }

  function flush() {
    if (state.pending.length === 0) return;
    const slice = state.pending;
    state.pending = new Float32Array(0);
    send(slice);
  }

  function attachStream(stream) {
    if (!stream || typeof stream.getAudioTracks !== "function") return;
    if (state.streams.indexOf(stream) === -1) state.streams.push(stream);
    if (!state.started) return;
    const context = createContext();
    if (!context) return;
    for (const track of stream.getAudioTracks()) {
      if (!track || state.tracks.has(track.id)) continue;
      if (track.readyState === "ended") continue;
      state.tracks.add(track.id);
      try {
        const source = context.createMediaStreamSource(new MediaStream([track]));
        source.connect(state.mixer);
        state.nodes.set(track.id, source);
        track.addEventListener("ended", () => {
          try {
            source.disconnect();
          } catch {
            /* already disconnected */
          }
          state.nodes.delete(track.id);
          state.tracks.delete(track.id);
        });
        log(`capturing remote audio track ${track.id.slice(0, 8)}`);
      } catch (error) {
        state.tracks.delete(track.id);
        log(`track attach failed: ${error && error.message ? error.message : error}`);
      }
    }
  }

  function mirrorTrack(event) {
    try {
      if (!event.track || event.track.kind !== "audio") return;
      const stream = (event.streams && event.streams[0]) || new MediaStream([event.track]);
      if (!state.streams.includes(stream)) state.streams.push(stream);

      if (!document.querySelector(`audio[data-click-tap="${event.track.id}"]`)) {
        const audio = document.createElement("audio");
        audio.autoplay = true;
        audio.muted = false;
        audio.volume = 1;
        audio.dataset.clickTap = event.track.id;
        audio.style.position = "absolute";
        audio.style.left = "-9999px";
        audio.style.width = "1px";
        audio.style.height = "1px";
        audio.srcObject = stream;
        (document.body || document.documentElement).appendChild(audio);
        const played = audio.play();
        if (played && played.catch) played.catch(() => {});
      }
      attachStream(stream);
    } catch (error) {
      log(`mirror failed: ${error && error.message ? error.message : error}`);
    }
  }

  const OriginalPeerConnection = window.RTCPeerConnection;
  if (typeof OriginalPeerConnection === "function") {
    function ClickPeerConnection(...args) {
      const connection = new OriginalPeerConnection(...args);
      connection.addEventListener("track", mirrorTrack);
      return connection;
    }
    ClickPeerConnection.prototype = OriginalPeerConnection.prototype;
    Object.setPrototypeOf(ClickPeerConnection, OriginalPeerConnection);
    window.RTCPeerConnection = ClickPeerConnection;
    log("RTCPeerConnection tapped");
  }

  // Some apps attach remote audio directly to <audio srcObject> without exposing
  // the track event to us (or before the tap was installed).
  function scanExisting() {
    if (!state.started) return;
    for (const element of document.querySelectorAll("audio")) {
      if (element.dataset && element.dataset.clickTap) continue;
      const stream = element.srcObject;
      if (stream && typeof stream.getAudioTracks === "function") attachStream(stream);
    }
  }
  const scanTimer = setInterval(scanExisting, 2000);
  if (scanTimer.unref) scanTimer.unref();

  window.__clickStartTap = async () => {
    state.started = true;
    const context = createContext();
    if (context && context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        /* resume may need a gesture; the autoplay flag usually makes it work */
      }
    }
    for (const stream of state.streams.slice()) attachStream(stream);
    scanExisting();
    return {
      sampleRate: context ? context.sampleRate : 0,
      tracks: state.tracks.size,
    };
  };

  window.__clickStopTap = async () => {
    state.started = false;
    flush();
    for (const source of state.nodes.values()) {
      try {
        source.disconnect();
      } catch {
        /* ignore */
      }
    }
    state.nodes.clear();
    state.tracks.clear();
    if (state.processor) {
      try {
        state.processor.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (state.context) {
      try {
        await state.context.close();
      } catch {
        /* ignore */
      }
    }
    return { chunks: state.chunks, bytes: state.bytes };
  };
})();
