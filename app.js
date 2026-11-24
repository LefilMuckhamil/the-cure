/* ==========================================================================
   THE CURE — MESIN VISUAL
   --------------------------------------------------------------------------
   Ubah timing lirik di lyrics.js, jangan di sini.

   Keyboard:
     Space / klik   play - pause        R       ulang dari awal
     E              buka / tutup editor Esc     tutup editor
     ← / →          geser 5 detik       [ / ]   geser 1 detik
     Ctrl+Enter     terapkan lirik dari editor
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ 1. */
  /* Konfigurasi                                                           */
  const CONFIG = {
    typeSpeed: 0.035,
    fallbackDuration: 77.27,
    defaultHold: 2.5,
    fftSize: 2048,
    beatWindow: 43,
    beatThreshold: 1.28,
    minBeatGap: 280,
    cameraTau: 220,
    lensTau: 420,
    focusTau: 360,
  };

  /* ------------------------------------------------------------------ 2. */
  /* Elemen                                                                */
  const $ = (id) => document.getElementById(id);
  const dom = {
    body: document.body,
    audio: $("audio"),
    file: $("audioFile"),
    field: $("field"),
    lens: $("lens"),
    camera: $("camera"),
    canvas: $("viz"),
    console: $("console"),
    script: $("script"),
    toast: $("toast"),
    mode: $("hudMode"),
    edit: $("edit"),
    close: $("close"),
    loadAudio: $("loadAudio"),
    styler: $("styler"),
    demo: $("demo"),
    apply: $("apply"),
  };
  const ctx = dom.canvas.getContext("2d");
  const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");

  /* ------------------------------------------------------------------ 3. */
  /* State                                                                 */
  const state = {
    customCues: null,
    cues: [],
    built: [],
    active: -1,
    objectUrl: null,
    toastTimer: 0,
    replayTimer: 0,
    lastFrame: performance.now(),
    reduced: !!motionQuery?.matches,

    energy: 0,
    bass: 0,
    treble: 0,
    beat: 0,
    lastBeat: 0,
    bpm: 0,
    beatHistory: [],

    cam: { x: 0, y: 0, tx: 0, ty: 0 },
    lens: { x: 0, y: 0, tx: 0, ty: 0 },
    focus: 0,
    focusTarget: 0,
    particles: [],
    ripples: [],
  };

  const sound = {
    ctx: null,
    analyser: null,
    freq: null,
    wave: null,
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const round3 = (n) => Math.round(n * 1000) / 1000;

  if (motionQuery?.addEventListener) {
    motionQuery.addEventListener("change", (e) => {
      state.reduced = e.matches;
    });
  }

  function toast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(
      () => dom.toast.classList.remove("show"),
      1800,
    );
  }

  function totalTime() {
    return Number.isFinite(dom.audio.duration) && dom.audio.duration > 0
      ? dom.audio.duration
      : CONFIG.fallbackDuration;
  }

  /* ------------------------------------------------------------------ 4. */
  /* Audio: graph + analisis beat                                          */
  sound.init = function init() {
    if (sound.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      sound.ctx = new AudioCtx();
      const source = sound.ctx.createMediaElementSource(dom.audio);
      sound.analyser = sound.ctx.createAnalyser();
      sound.analyser.fftSize = CONFIG.fftSize;
      sound.analyser.smoothingTimeConstant = 0.78;
      source.connect(sound.analyser);
      sound.analyser.connect(sound.ctx.destination);
      sound.freq = new Uint8Array(sound.analyser.frequencyBinCount);
      sound.wave = new Uint8Array(sound.analyser.fftSize);
    } catch {
      sound.analyser = null;
    }
  };

  sound.resume = function resume() {
    sound.init();
    if (sound.ctx?.state === "suspended") sound.ctx.resume().catch(() => {});
  };

  sound.analyse = function analyse(now, dt) {
    const { analyser, freq, wave } = sound;
    const playing = analyser && freq && !dom.audio.paused && !dom.audio.ended;

    if (playing) {
      analyser.getByteFrequencyData(freq);
      analyser.getByteTimeDomainData(wave);

      const loEnd = Math.floor(freq.length * 0.08);
      const midEnd = Math.floor(freq.length * 0.35);
      let lo = 0;
      let mid = 0;
      let hi = 0;

      for (let i = 0; i < freq.length; i++) {
        const value = freq[i] / 255;
        if (i < loEnd) lo += value;
        else if (i < midEnd) mid += value;
        else hi += value;
      }
      lo /= Math.max(1, loEnd);
      mid /= Math.max(1, midEnd - loEnd);
      hi /= Math.max(1, freq.length - midEnd);

      state.energy =
        state.energy * 0.82 + (lo * 0.5 + mid * 0.32 + hi * 0.18) * 0.18;
      state.bass = state.bass * 0.78 + lo * 0.22;
      state.treble = state.treble * 0.85 + hi * 0.15;

      const instant = lo * 0.72 + mid * 0.28;
      state.beatHistory.push(instant);
      if (state.beatHistory.length > CONFIG.beatWindow) state.beatHistory.shift();
      const average =
        state.beatHistory.reduce((sum, value) => sum + value, 0) /
        state.beatHistory.length;

      if (
        instant > average * CONFIG.beatThreshold &&
        instant > 0.14 &&
        now - state.lastBeat > CONFIG.minBeatGap
      ) {
        if (state.lastBeat && now - state.lastBeat < 1400) {
          state.bpm = Math.round(60000 / (now - state.lastBeat));
        }
        state.lastBeat = now;
        state.beat = 1;
        if (!state.reduced) state.ripples.push({ r: 0, a: 1 });
      }
    } else {
      state.energy *= 0.96;
      state.bass *= 0.96;
      state.treble *= 0.96;
    }

    state.beat = Math.max(0, state.beat - dt * 0.0038);
    const root = document.documentElement.style;
    root.setProperty("--energy", state.energy.toFixed(3));
    root.setProperty("--beat", state.beat.toFixed(3));
  };

  /* ------------------------------------------------------------------ 5. */
  /* Panggung: canvas, kamera, lens                                        */
  const scene = {
    palette() {
      return dom.body.dataset.mood === "sad"
        ? ["150, 123, 255", "120, 233, 255", "255, 107, 157"]
        : ["255, 43, 80", "198, 255, 74", "120, 233, 255"];
    },

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dom.canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
      dom.canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = state.reduced
        ? 24
        : clamp(
            Math.floor((window.innerWidth * window.innerHeight) / 15000),
            20,
            110,
          );
      state.particles = Array.from({ length: count }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.28,
        vy: -0.12 - Math.random() * 0.5,
        size: 0.6 + Math.random() * 2.1,
        phase: Math.random() * Math.PI * 2,
        tone: Math.floor(Math.random() * 3),
      }));
    },

    draw(now, dt) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const centerX = w * 0.5 + state.focus * w * 0.045;
      const centerY = h * 0.46;
      const colors = this.palette();

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      // Spectrum melingkar
      if (sound.freq && !dom.audio.paused) {
        const radius = Math.min(w, h) * 0.24 * (1 + state.beat * 0.035);
        ctx.lineWidth = 1.4;

        for (let i = 0; i < 96; i++) {
          const bin = Math.floor((i / 96) * sound.freq.length * 0.5);
          const level = sound.freq[bin] / 255;
          if (level < 0.06) continue;
          const angle = (i / 96) * Math.PI * 2 + now * 0.00007;
          const length = 6 + level * Math.min(w, h) * 0.15;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          ctx.strokeStyle = `rgba(${colors[i % 3]},${(0.1 + level * 0.55).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(
            centerX + Math.cos(angle) * (radius + length),
            centerY + Math.sin(angle) * (radius + length),
          );
          ctx.stroke();
        }
      }

      // Riak saat beat
      for (let i = state.ripples.length - 1; i >= 0; i--) {
        const ripple = state.ripples[i];
        ripple.r += dt * (0.32 + state.energy * 0.5);
        ripple.a -= dt * 0.0011;
        if (ripple.a <= 0) {
          state.ripples.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(centerX, centerY, ripple.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${colors[0]},${(ripple.a * 0.28).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Partikel
      const speed = 1 + state.energy * 3.5 + state.beat * 1.5;
      for (const p of state.particles) {
        p.x += (p.vx + Math.sin(now * 0.0004 + p.phase) * 0.16) * speed;
        p.y += p.vy * speed;
        if (p.y < -20) {
          p.y = h + 20;
          p.x = Math.random() * w;
        }
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;

        ctx.fillStyle = `rgba(${colors[p.tone]},${(0.12 + state.energy * 0.5).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + state.bass * 1.5 + state.beat * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }

      // Waveform
      if (sound.wave && !dom.audio.paused) {
        ctx.beginPath();
        for (let i = 0; i < sound.wave.length; i += 4) {
          const x = (i / (sound.wave.length - 1)) * w;
          const y =
            h * 0.5 +
            ((sound.wave[i] - 128) / 128) * h * (0.035 + state.energy * 0.05);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${colors[1]},${(0.1 + state.treble * 0.35).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.globalCompositeOperation = "source-over";
    },

    camera(now, dt) {
      if (state.reduced) return;
      const t = 1 - Math.exp(-dt / CONFIG.cameraTau);
      const focusT = 1 - Math.exp(-dt / CONFIG.focusTau);
      const cam = state.cam;
      state.focus = lerp(state.focus, state.focusTarget, focusT);

      cam.tx = Math.sin(now * 0.00021) * 8 + state.beat * 10 - state.focus * 10;
      cam.ty = Math.cos(now * 0.00017) * 5 + state.beat * 7;
      cam.x = lerp(cam.x, cam.tx, t);
      cam.y = lerp(cam.y, cam.ty, t);

      const z = state.beat * 30 + state.bass * 18;
      const ry = -state.focus * 4;
      const rz = Math.sin(now * 0.00013) * 0.4 + state.beat * 0.18;
      dom.camera.style.transform =
        `translate3d(${cam.x.toFixed(2)}px,${cam.y.toFixed(2)}px,${z.toFixed(1)}px) ` +
        `rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(3)}deg) ` +
        `scale(${(1 + state.beat * 0.01).toFixed(4)})`;
    },

    lens(dt) {
      const t = 1 - Math.exp(-dt / (state.reduced ? 1 : CONFIG.lensTau));
      const lens = state.lens;
      lens.x = lerp(lens.x, lens.tx, t);
      lens.y = lerp(lens.y, lens.ty, t);
      dom.lens.style.transform =
        `translate(calc(-50% + ${lens.x.toFixed(1)}px), ${lens.y.toFixed(1)}px)`;
    },
  };

  /* ------------------------------------------------------------------ 6. */
  /* Timeline lirik                                                        */
  function normalize(rows = []) {
    return rows
      .map((row) => {
        if (typeof row === "string") {
          return { text: row, at: 0, hold: CONFIG.defaultHold, mood: "" };
        }
        const raw = String(row.text || row.teks || "");
        const match = raw.match(/^\[([\w-]+)\]\s*([\s\S]*)$/);
        const mood = match ? match[1] : row.mood || "";
        const text = match ? match[2] : raw;
        if (!text.trim()) return null;

        const at = Number(
          row.at ?? row.muncul ?? 0,
        );
        const hold = Number(
          row.hold ?? row.tahan ?? row.detik ?? CONFIG.defaultHold,
        );
        return {
          text,
          at: Number.isFinite(at) ? Math.max(0, at) : 0,
          hold,
          mood,
        };
      })
      .filter(Boolean);
  }

  function buildTimeline() {
    const source = state.customCues?.length ? state.customCues : window.LYRICS || [];
    const cues = normalize(source).sort((a, b) => a.at - b.at);
    const total = totalTime();

    return cues
      .map((cue, i) => {
        const at = Math.max(0, Number(cue.at) || 0);
        const hold = Math.max(0.2, Number(cue.hold) || CONFIG.defaultHold);
        const nextAt = Number(cues[i + 1]?.at) || 0;
        return {
          text: cue.text,
          at,
          hold,
          end: nextAt ? Math.min(at + hold, Math.max(at, nextAt)) : at + hold,
          mood: cue.mood,
        };
      })
      .filter((cue) => cue.at < total + 2);
  }

  function refresh() {
    state.cues = buildTimeline();
    buildAll();
    render(dom.audio.currentTime || 0);
  }

  /* ------------------------------------------------------------------ 7. */
  /* Tokenizer + DOM lirik                                                 */
  const TOKEN =
    /("[^"]*"|'[^']*')|(\/\/\s*[^\n]*)|([A-Za-z_]\w*)(?=\s*\()|([A-Za-z_]\w*)(?=\s*:)|\b(why|it|me|you|i|oh|because|and|got|head|heart|blood|love|result|ever|never|dont|feels|good|matter)\b|([{}()[\]])|(\d+(?:\.\d+)?)/g;

  function tokenChars(text) {
    const out = [];
    const add = (value, cls) => {
      for (const char of value) out.push({ char, cls });
    };
    let last = 0;
    let match;
    TOKEN.lastIndex = 0;

    while ((match = TOKEN.exec(text))) {
      add(text.slice(last, match.index), "plain");
      const cls = match[1]
        ? "str"
        : match[2]
          ? "cm"
          : match[3]
            ? "fn"
            : match[4]
              ? "key"
              : match[5]
                ? "kw"
                : match[6]
                  ? "br"
                  : "num";
      add(match[0], cls);
      last = match.index + match[0].length;
    }
    add(text.slice(last), "plain");
    return out;
  }

  function buildAll() {
    const fragment = document.createDocumentFragment();

    state.built = state.cues.map((cue) => {
      const line = document.createElement("div");
      line.className = "line reff";
      line.dataset.text = cue.text;

      const text = document.createElement("span");
      text.className = "txt";
      let word = null;

      for (const { char, cls } of tokenChars(cue.text)) {
        if (/\s/.test(char)) {
          if (word) {
            text.append(word);
            word = null;
          }
          const space = document.createElement("span");
          space.className = "sp";
          space.textContent = char;
          text.append(space);
          continue;
        }
        if (!word) {
          word = document.createElement("span");
          word.className = "word";
        }
        const ch = document.createElement("span");
        ch.className = `ch c-${cls}`;
        ch.textContent = char;
        word.append(ch);
      }
      if (word) text.append(word);

      const cursor = document.createElement("span");
      cursor.className = "cur";
      cursor.style.display = "none";
      line.append(text, cursor);
      fragment.append(line);

      return { line, chars: [...text.querySelectorAll(".ch")], cursor, n: -1 };
    });

    dom.field.replaceChildren(fragment);
    state.active = -1;
  }

  function follow(index) {
    const { line, cursor } = state.built[index];
    const hasCursor = !!cursor.offsetParent;
    const y =
      line.offsetTop +
      (hasCursor ? cursor.offsetTop + cursor.offsetHeight / 2 : line.offsetHeight / 2);

    const center = dom.lens.clientWidth * 0.5;
    state.lens.tx = hasCursor ? -(cursor.offsetLeft - center) * 0.6 : 0;
    state.lens.ty = -(y + line.offsetHeight / 2);
    state.focusTarget = hasCursor
      ? clamp((cursor.offsetLeft - center) / center, -1, 1)
      : 0;
  }

  function updateMode() {
    dom.mode.textContent =
      dom.body.dataset.mood === "sad"
        ? "SAD // SIGNAL"
        : dom.body.classList.contains("is-reff")
          ? "REFF // LOCK"
          : "SIGNAL";
  }

  function render(t) {
    let active = -1;
    state.cues.forEach((cue, i) => {
      if (t >= cue.at && t < cue.end) active = i;
    });

    dom.body.classList.toggle("is-reff", active >= 0);
    const mood = active >= 0 ? state.cues[active].mood || "" : "";
    if (mood) {
      if (dom.body.dataset.mood !== mood) dom.body.dataset.mood = mood;
    } else if (dom.body.hasAttribute("data-mood")) {
      dom.body.removeAttribute("data-mood");
    }

    let typing = false;
    state.built.forEach((built, i) => {
      const cue = state.cues[i];
      const slot = Math.max(0, cue.end - cue.at);
      const duration = clamp(
        Math.min(slot * 0.82, cue.text.length * CONFIG.typeSpeed),
        0.12,
        Infinity,
      );
      let shown = 0;
      if (t >= cue.at) {
        shown =
          t >= cue.at + duration
            ? cue.text.length
            : Math.floor(((t - cue.at) / duration) * cue.text.length);
      }
      shown = clamp(shown, 0, cue.text.length);

      if (built.n !== shown) {
        built.chars.forEach((ch, k) => ch.classList.toggle("on", k < shown));
        built.n = shown;
        if (i === active) typing = true;
      }

      const isActive = i === active;
      built.line.classList.toggle("is-active", isActive);
      built.line.classList.toggle("is-past", t >= cue.end);
      built.line.classList.toggle("is-future", t < cue.at);
      built.cursor.style.display = isActive ? "" : "none";
    });

    if (active !== state.active) {
      state.active = active;
      if (active >= 0) follow(active);
    } else if (typing && active >= 0) {
      follow(active);
    }
  }

  function tick(now = performance.now()) {
    const dt = clamp(now - state.lastFrame, 0, 64);
    state.lastFrame = now;
    const t = dom.audio.currentTime || 0;

    sound.analyse(now, dt);
    render(t);
    scene.camera(now, dt);
    scene.lens(dt);
    scene.draw(now, dt);
    updateMode();

    if (
      !dom.body.classList.contains("intro-done") &&
      t > 0.8 &&
      !dom.audio.paused
    ) {
      dom.body.classList.add("intro-done");
    }
    if (!dom.audio.paused && !dom.audio.ended && t >= totalTime() - 0.05) {
      finish();
    }
    requestAnimationFrame(tick);
  }

  /* ------------------------------------------------------------------ 8. */
  /* Kontrol                                                               */
  function finish() {
    if (state.replayTimer) return;
    dom.audio.pause();
    state.replayTimer = setTimeout(() => {
      state.replayTimer = 0;
      replay();
    }, 3000);
  }

  async function togglePlay() {
    if (!dom.audio.paused) {
      dom.audio.pause();
      return;
    }
    sound.resume();
    if (dom.audio.ended || dom.audio.currentTime >= totalTime() - 0.05) restart();
    try {
      await dom.audio.play();
    } catch {
      toast("Audio belum bisa diputar — buka ✎ LIRIK › Ganti audio");
    }
  }

  function restart() {
    clearTimeout(state.replayTimer);
    state.replayTimer = 0;
    dom.audio.currentTime = 0;
    render(0);
  }

  async function replay() {
    sound.resume();
    restart();
    try {
      await dom.audio.play();
    } catch {
      toast("Ketuk layar dulu untuk memutar");
    }
  }

  function seek(delta) {
    clearTimeout(state.replayTimer);
    state.replayTimer = 0;
    const max = Math.max(0, totalTime() - 0.05);
    dom.audio.currentTime = clamp((dom.audio.currentTime || 0) + delta, 0, max);
    render(dom.audio.currentTime);
  }

  function toggleEditor() {
    const open = dom.console.classList.toggle("open");
    if (open) {
      if (!dom.script.value) dom.script.value = serialize();
      dom.script.focus();
    }
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = URL.createObjectURL(file);
    dom.audio.src = state.objectUrl;
    dom.audio.load();
    restart();
    sound.resume();
    dom.audio
      .play()
      .then(() => toast("Audio: " + file.name))
      .catch(() => toast("Ketuk layar untuk memutar"));
  }

  /* ------------------------------------------------------------------ 9. */
  /* Editor lirik                                                          */
  function serialize() {
    return state.cues
      .map(
        (cue) =>
          `${round3(cue.at)} | ${round3(cue.hold)} | ${cue.mood ? `[${cue.mood}] ` : ""}${cue.text}`,
      )
      .join("\n");
  }

  function parseScript(raw) {
    const rows = [];
    let at = 0;

    for (const line of raw.split(/\r?\n/)) {
      const text = line.trim();
      if (!text || text.startsWith("#") || text.startsWith("//")) continue;
      if (rows.length >= 400) break;

      const parts = text.split("|");
      if (parts.length >= 3) {
        const start = Number(parts[0].trim());
        const hold = Number(parts[1].trim());
        const cue = parts.slice(2).join("|").trim();
        if (Number.isFinite(start) && Number.isFinite(hold) && cue) {
          rows.push({ text: cue, at: start, hold });
          at = start;
          continue;
        }
      }

      const short = text.match(
        /^(.*?)\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*(?:detik|dtk|s)?\s*$/i,
      );
      if (short && short[1].trim()) {
        const hold = Number(short[2]);
        rows.push({ text: short[1].trim(), at, hold });
        at += hold;
        continue;
      }

      rows.push({ text, at, hold: CONFIG.defaultHold });
      at += CONFIG.defaultHold;
    }
    return rows;
  }

  function applyScript() {
    const rows = parseScript(dom.script.value);
    if (!rows.length) {
      toast("Lirik kosong");
      return;
    }
    state.customCues = rows;
    refresh();
    dom.console.classList.remove("open");
    toast(rows.length + " baris diterapkan");
  }

  /* ----------------------------------------------------------------- 10. */
  /* Event                                                                 */
  dom.audio.addEventListener("play", () => {
    dom.body.classList.add("is-playing");
    sound.resume();
  });
  dom.audio.addEventListener("pause", () => dom.body.classList.remove("is-playing"));
  dom.audio.addEventListener("ended", finish);
  dom.audio.addEventListener("loadedmetadata", refresh);
  dom.file.addEventListener("change", onFileChange);
  window.addEventListener("resize", scene.resize);

  dom.edit.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleEditor();
    if (dom.console.classList.contains("open")) dom.script.value = serialize();
  });

  const buttonActions = {
    close: () => dom.console.classList.remove("open"),
    loadAudio: () => dom.file.click(),
    styler: () => {
      dom.script.value = serialize();
      toast("Waktu dirapikan");
    },
    demo: () => {
      state.customCues = null;
      dom.script.value = serialize();
      refresh();
      toast("Lirik dari lyrics.js dikembalikan");
    },
    apply: applyScript,
  };
  Object.entries(buttonActions).forEach(([key, action]) =>
    dom[key].addEventListener("click", action),
  );

  const keyActions = {
    Space: togglePlay,
    KeyR: replay,
    KeyE: toggleEditor,
    ArrowLeft: () => seek(-5),
    ArrowRight: () => seek(5),
    BracketLeft: () => seek(-1),
    BracketRight: () => seek(1),
    "[": () => seek(-1),
    "]": () => seek(1),
  };

  document.addEventListener("keydown", (e) => {
    sound.resume();
    if (e.target === dom.script) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        applyScript();
      } else if (e.key === "Escape") {
        dom.console.classList.remove("open");
      }
      return;
    }

    if (["Space", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    const action = keyActions[e.code] || keyActions[e.key];
    if (action) action();
    else if (e.key === "Escape") dom.console.classList.remove("open");
  });

  document.addEventListener("click", (e) => {
    if (dom.console.contains(e.target)) return;
    sound.resume();
    togglePlay();
  });

  /* ----------------------------------------------------------------- 11. */
  /* API konsol + mulai                                                    */
  window.TheCure = {
    cues: () =>
      state.cues.map((cue) => ({
        text: cue.text,
        at: cue.at,
        hold: cue.hold,
        end: round3(cue.end),
        mood: cue.mood,
      })),
    seek,
    play: togglePlay,
    replay,
    editor: toggleEditor,
    renderAt: (t) => render(Number(t) || 0),
    viz: () => ({
      energy: round3(state.energy),
      bass: round3(state.bass),
      beat: round3(state.beat),
      bpm: state.bpm,
    }),
    reset: () => {
      state.customCues = null;
      refresh();
      toast("Kembali ke lyrics.js");
    },
  };

  scene.resize();
  refresh();
  requestAnimationFrame(tick);

  if (new URLSearchParams(location.search).get("autoplay") !== "0") {
    sound.init();
    dom.audio.play().catch(() => {});
  }
})();
