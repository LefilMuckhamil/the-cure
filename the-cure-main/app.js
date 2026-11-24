/* ==========================================================================
   THE CURE — MESIN VISUAL
   --------------------------------------------------------------------------
   Jangan edit file ini kalau cuma mau ganti waktu lirik.
   Edit lyrics.js saja.

   Perintah yang bisa dipakai:
     Space / ketuk layar  play - pause
     R                    ulang dari awal
     E                    buka / tutup editor lirik
     Esc                  tutup editor
     ← / →                geser 5 detik
     [ / ]                geser 1 detik (buat nyetel timing)
     Ctrl+Enter           terapkan lirik dari editor
   ========================================================================== */

(function () {
  "use strict";

  /* ======================================================================
     1. KONSTANTA
     ====================================================================== */
  const TYPE_SPEED = 0.035; // detik per huruf saat efek mengetik
  const FALLBACK_DURATION = 77.27; // dipakai sebelum metadata audio siap
  const DEFAULT_HOLD = 2.5; // tahan default kalau tidak ditulis

  /* ======================================================================
     2. ELEMEN & STATE
     ====================================================================== */
  const $ = (id) => document.getElementById(id);
  const body = document.body;
  const audio = $("audio");
  const field = $("field");
  const lens = $("lens");
  const camera = $("camera");
  const canvas = $("viz");
  const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
  const consoleBox = $("console");
  const scriptBox = $("script");
  const toastEl = $("toast");
  const audioFile = $("audioFile");
  const hudTime = $("hudTime");
  const hudTotal = $("hudTotal");
  const hudFill = $("hudFill");
  const hudMode = $("hudMode");
  const motionQuery =
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)");
  let reduceMotion = !!(motionQuery && motionQuery.matches);
  if (motionQuery && motionQuery.addEventListener) {
    motionQuery.addEventListener("change", (e) => {
      reduceMotion = e.matches;
    });
  }

  let customCues = null; // null = pakai window.LYRICS dari lyrics.js
  let lyrics = []; // [{ text, at, hold, end }]
  let built = [];
  let activeIndex = -1;
  let objectUrl = null;
  let toastTimer = 0;
  let replayTimer = 0;

  // -- analisis audio --
  let audioCtx = null;
  let analyser = null;
  let freqData = null;
  let timeData = null;
  let energy = 0;
  let bass = 0;
  let treble = 0;
  let beat = 0;
  let lastBeat = 0;
  let bpmEstimate = 0;
  const beatHistory = [];

  // -- panggung canvas --
  let particles = [];
  let ripples = [];
  let lastFrame = performance.now();

  // -- target kamera & lens yang di-smooth --
  let camX = 0,
    camY = 0,
    camTargetX = 0,
    camTargetY = 0;
  let lensX = 0,
    lensY = 0,
    lensTargetX = 0,
    lensTargetY = 0;

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
  }

  function totalTime() {
    return isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : FALLBACK_DURATION;
  }

  /* ======================================================================
     2b. AUDIO REAKTIF — Web Audio API + panggung canvas
     ====================================================================== */
  function initAudioGraph() {
    if (audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      audioCtx = new AC();
      const src = audioCtx.createMediaElementSource(audio);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.78;
      src.connect(analyser);
      analyser.connect(audioCtx.destination);
      freqData = new Uint8Array(analyser.frequencyBinCount);
      timeData = new Uint8Array(analyser.fftSize);
    } catch (err) {
      analyser = null;
    }
  }

  function resumeAudio() {
    initAudioGraph();
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  }

  function fmtTime(s) {
    s = Math.max(0, Math.floor(Number(s) || 0));
    return (
      String(Math.floor(s / 60)).padStart(2, "0") +
      ":" +
      String(s % 60).padStart(2, "0")
    );
  }

  function updateHud(t) {
    const total = totalTime();
    hudFill.style.width = (Math.min(1, t / total) * 100).toFixed(2) + "%";
    hudTime.textContent = fmtTime(t);
    hudTotal.textContent = fmtTime(total);
    hudMode.textContent =
      body.dataset.mood === "sad"
        ? "SAD // SIGNAL"
        : body.classList.contains("is-reff")
          ? "REFF // LOCK"
          : "SIGNAL";
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function analyse(now, dt) {
    const playing = analyser && freqData && !audio.paused && !audio.ended;
    if (playing) {
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);

      const n = freqData.length;
      const loEnd = Math.floor(n * 0.08);
      const midEnd = Math.floor(n * 0.35);
      let lo = 0;
      let mid = 0;
      let hi = 0;
      for (let i = 0; i < n; i++) {
        const v = freqData[i] / 255;
        if (i < loEnd) lo += v;
        else if (i < midEnd) mid += v;
        else hi += v;
      }
      lo /= Math.max(1, loEnd);
      mid /= Math.max(1, midEnd - loEnd);
      hi /= Math.max(1, n - midEnd);

      energy = energy * 0.82 + (lo * 0.5 + mid * 0.32 + hi * 0.18) * 0.18;
      bass = bass * 0.78 + lo * 0.22;
      treble = treble * 0.85 + hi * 0.15;

      const instant = lo * 0.72 + mid * 0.28;
      beatHistory.push(instant);
      if (beatHistory.length > 43) beatHistory.shift();
      const avg = beatHistory.reduce((a, b) => a + b, 0) / beatHistory.length;
      if (instant > avg * 1.28 && instant > 0.14 && now - lastBeat > 280) {
        if (lastBeat && now - lastBeat < 1400) {
          bpmEstimate = Math.round(60000 / (now - lastBeat));
        }
        lastBeat = now;
        beat = 1;
        if (!reduceMotion) ripples.push({ r: 0, a: 1 });
      }
    } else {
      energy *= 0.96;
      bass *= 0.96;
      treble *= 0.96;
    }
    beat = Math.max(0, beat - dt * 0.0038);
    const root = document.documentElement.style;
    root.setProperty("--energy", energy.toFixed(3));
    root.setProperty("--beat", beat.toFixed(3));
  }

  function resizeCanvas() {
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(innerWidth * dpr));
    canvas.height = Math.max(1, Math.floor(innerHeight * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = reduceMotion
      ? 24
      : Math.min(110, Math.floor((innerWidth * innerHeight) / 15000));
    particles = Array.from({ length: Math.max(20, count) }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      vx: (Math.random() - 0.5) * 0.28,
      vy: -0.12 - Math.random() * 0.5,
      size: 0.6 + Math.random() * 2.1,
      phase: Math.random() * Math.PI * 2,
      tone: Math.floor(Math.random() * 3),
    }));
  }

  function drawViz(now, dt) {
    if (!ctx) return;
    const w = innerWidth;
    const h = innerHeight;
    const sad = body.dataset.mood === "sad";
    const palette = sad
      ? ["150, 123, 255", "120, 233, 255", "255, 107, 157"]
      : ["255, 43, 80", "198, 255, 74", "120, 233, 255"];

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    if (freqData && !audio.paused) {
      const cx = w * 0.5;
      const cy = h * 0.46;
      const radius = Math.min(w, h) * 0.24 * (1 + beat * 0.035);
      const bars = 96;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < bars; i++) {
        const bin = Math.floor((i / bars) * freqData.length * 0.5);
        const v = freqData[bin] / 255;
        if (v < 0.06) continue;
        const a = (i / bars) * Math.PI * 2 + now * 0.00007;
        const len = 6 + v * Math.min(w, h) * 0.15;
        const x1 = cx + Math.cos(a) * radius;
        const y1 = cy + Math.sin(a) * radius;
        ctx.strokeStyle =
          "rgba(" + palette[i % 3] + "," + (0.1 + v * 0.55).toFixed(3) + ")";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(
          cx + Math.cos(a) * (radius + len),
          cy + Math.sin(a) * (radius + len),
        );
        ctx.stroke();
      }
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.r += dt * (0.32 + energy * 0.5);
      rp.a -= dt * 0.0011;
      if (rp.a <= 0) {
        ripples.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.46, rp.r, 0, Math.PI * 2);
      ctx.strokeStyle =
        "rgba(" + palette[0] + "," + (rp.a * 0.28).toFixed(3) + ")";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const speed = 1 + energy * 3.5 + beat * 1.5;
    for (const p of particles) {
      p.x += (p.vx + Math.sin(now * 0.0004 + p.phase) * 0.16) * speed;
      p.y += p.vy * speed;
      if (p.y < -20) {
        p.y = h + 20;
        p.x = Math.random() * w;
      }
      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      const r = p.size * (1 + bass * 1.5 + beat * 0.6);
      ctx.fillStyle =
        "rgba(" + palette[p.tone] + "," + (0.12 + energy * 0.5).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (timeData && !audio.paused) {
      ctx.beginPath();
      for (let i = 0; i < timeData.length; i += 4) {
        const x = (i / (timeData.length - 1)) * w;
        const y =
          h * 0.5 +
          ((timeData[i] - 128) / 128) * h * (0.035 + energy * 0.05);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle =
        "rgba(" + palette[1] + "," + (0.1 + treble * 0.35).toFixed(3) + ")";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.globalCompositeOperation = "source-over";
  }

  function updateCamera(now, dt) {
    if (reduceMotion) return;
    const t = 1 - Math.exp(-dt / 170);
    camTargetX =
      Math.sin(now * 0.00021) * 9 + (Math.random() - 0.5) * beat * 16;
    camTargetY = Math.cos(now * 0.00017) * 6 + beat * 8;
    camX = lerp(camX, camTargetX, t);
    camY = lerp(camY, camTargetY, t);
    const z = beat * 34 + bass * 20;
    const rz = Math.sin(now * 0.00013) * 0.5 + beat * 0.22;
    camera.style.transform =
      "translate3d(" +
      camX.toFixed(2) +
      "px," +
      camY.toFixed(2) +
      "px," +
      z.toFixed(1) +
      "px) rotateZ(" +
      rz.toFixed(3) +
      "deg) scale(" +
      (1 + beat * 0.012).toFixed(4) +
      ")";
  }

  function updateLens(dt) {
    const t = 1 - Math.exp(-dt / (reduceMotion ? 1 : 300));
    lensX = lerp(lensX, lensTargetX, t);
    lensY = lerp(lensY, lensTargetY, t);
    lens.style.transform =
      "translate(calc(-50% + " +
      lensX.toFixed(1) +
      "px), " +
      lensY.toFixed(1) +
      "px)";
  }

  /* ======================================================================
     3. TIMING EKSPLISIT — diambil dari lyrics.js, bukan dibagi rata
     ====================================================================== */
  function normalize(raw) {
    return (raw || [])
      .map((row) => {
        if (typeof row === "string") {
          return { text: row, at: 0, hold: DEFAULT_HOLD };
        }
        const rawText = String(row.text || row.teks || "");
        const match = rawText.match(/^\[([\w-]+)\]\s*([\s\S]*)$/);
        const mood = match ? match[1] : row.mood || "";
        const text = match ? match[2] : rawText;
        if (!text) return null;
        const at = Number(
          row.at !== undefined ? row.at : row.muncul !== undefined ? row.muncul : 0,
        );
        const hold = Number(
          row.hold !== undefined
            ? row.hold
            : row.tahan !== undefined
              ? row.tahan
              : row.detik !== undefined
                ? row.detik
                : DEFAULT_HOLD,
        );
        return { text, at: isFinite(at) ? Math.max(0, at) : 0, hold, mood };
      })
      .filter(Boolean)
      .filter((r) => r.text.trim());
  }

  function baseCues() {
    return normalize(
      customCues && customCues.length ? customCues : window.LYRICS,
    );
  }

  function buildTimeline() {
    const cues = baseCues().sort((a, b) => a.at - b.at);
    const total = totalTime();

    return cues
      .map((c, i) => {
        const at = Math.max(0, Number(c.at) || 0);
        const hold = Math.max(0.2, Number(c.hold) || DEFAULT_HOLD);
        const next = cues[i + 1];
        // Kalau lirik berikutnya muncul lebih awal, lirik ini dipotong di situ.
        const end = next
          ? Math.min(at + hold, Math.max(at, Number(next.at) || 0))
          : at + hold;
        return { text: c.text, at, hold, end, mood: c.mood };
      })
      .filter((l) => l.at < total + 2);
  }

  function refreshLyrics() {
    const at = audio.currentTime || 0;
    lyrics = buildTimeline();
    buildAll();
    render(at);
  }

  /* ======================================================================
     4. TOKENIZER -> satu span per karakter
     ====================================================================== */
  const TOK =
    /("[^"]*"|'[^']*')|(\/\/\s*[^\n]*)|([A-Za-z_]\w*)(?=\s*\()|([A-Za-z_]\w*)(?=\s*:)|\b(why|it|me|you|i|oh|because|and|got|head|heart|blood|love|result|ever|never|dont|feels|good|matter)\b|([{}()[\]])|(\d+(?:\.\d+)?)/g;

  function tokenChars(text) {
    const out = [];
    let last = 0;
    let m;
    TOK.lastIndex = 0;
    const add = (s, cls) => {
      for (const c of s) out.push({ c, cls });
    };
    while ((m = TOK.exec(text))) {
      add(text.slice(last, m.index), "plain");
      let cls = "plain";
      if (m[1]) cls = "str";
      else if (m[2]) cls = "cm";
      else if (m[3]) cls = "fn";
      else if (m[4]) cls = "key";
      else if (m[5]) cls = "kw";
      else if (m[6]) cls = "br";
      else if (m[7]) cls = "num";
      add(m[0], cls);
      last = m.index + m[0].length;
    }
    add(text.slice(last), "plain");
    return out;
  }

  function buildAll() {
    field.innerHTML = "";
    built = lyrics.map((item) => {
      const el = document.createElement("div");
      el.className = "line reff";
      el.dataset.text = item.text;

      const txt = document.createElement("span");
      txt.className = "txt";
      let word = null;
      tokenChars(item.text).forEach(({ c, cls }) => {
        if (/\s/.test(c)) {
          if (word) {
            txt.appendChild(word);
            word = null;
          }
          const sp = document.createElement("span");
          sp.className = "sp";
          sp.textContent = c;
          txt.appendChild(sp);
        } else {
          if (!word) {
            word = document.createElement("span");
            word.className = "word";
          }
          const ch = document.createElement("span");
          ch.className = "ch c-" + cls;
          ch.textContent = c;
          word.appendChild(ch);
        }
      });
      if (word) txt.appendChild(word);

      const cur = document.createElement("span");
      cur.className = "cur";
      cur.style.display = "none";
      el.append(txt, cur);
      field.appendChild(el);

      return {
        el,
        chars: Array.from(txt.querySelectorAll(".ch")),
        cur,
        n: -1,
      };
    });
    activeIndex = -1;
  }

  /* ======================================================================
     5. KAMERA & RENDER
     ====================================================================== */
  function follow(el) {
    const cur = el.querySelector(".cur");
    const y =
      el.offsetTop +
      (cur && cur.offsetParent
        ? cur.offsetTop + cur.offsetHeight / 2
        : el.offsetHeight / 2);
    lensTargetX =
      cur && cur.offsetParent
        ? -(cur.offsetLeft - lens.clientWidth * 0.5) * 0.22
        : 0;
    lensTargetY = -(y + el.offsetHeight / 2);
  }

  function render(t) {
    let active = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (t >= lyrics[i].at && t < lyrics[i].end) active = i;
    }
    body.classList.toggle("is-reff", active >= 0);
    const activeMood = active >= 0 ? lyrics[active].mood || "" : "";
    if (activeMood) {
      if (body.dataset.mood !== activeMood) body.dataset.mood = activeMood;
    } else if (body.hasAttribute("data-mood")) {
      body.removeAttribute("data-mood");
    }

    let changed = false;
    built.forEach((b, i) => {
      const item = lyrics[i];
      const start = item.at;
      const slot = Math.max(0, item.end - start);
      const dur = Math.max(
        0.12,
        Math.min(slot * 0.82, item.text.length * TYPE_SPEED),
      );
      let n = 0;
      if (t >= start) {
        n =
          t >= start + dur
            ? item.text.length
            : Math.floor(((t - start) / dur) * item.text.length);
      }
      n = Math.max(0, Math.min(item.text.length, n));

      if (b.n !== n) {
        for (let k = 0; k < b.chars.length; k++) {
          b.chars[k].classList.toggle("on", k < n);
        }
        b.n = n;
        if (i === active) changed = true;
      }

      const isActive = i === active;
      b.el.classList.toggle("is-active", isActive);
      b.el.classList.toggle("is-past", t >= item.end);
      b.el.classList.toggle("is-future", t < item.at);
      b.cur.style.display = isActive ? "" : "none";
    });

    if (active !== activeIndex) {
      activeIndex = active;
      if (active >= 0) follow(built[active].el);
    } else if (changed && active >= 0) {
      follow(built[active].el);
    }
  }

  function tick(now) {
    if (!now) now = performance.now();
    const dt = Math.min(64, Math.max(0, now - lastFrame));
    lastFrame = now;
    const t = audio.currentTime || 0;

    analyse(now, dt);
    render(t);
    updateCamera(now, dt);
    updateLens(dt);
    drawViz(now, dt);
    updateHud(t);

    if (
      !body.classList.contains("intro-done") &&
      t > 0.8 &&
      !audio.paused
    ) {
      body.classList.add("intro-done");
    }
    if (
      !audio.paused &&
      !audio.ended &&
      audio.currentTime >= totalTime() - 0.05
    ) {
      finish();
    }
    requestAnimationFrame(tick);
  }

  function finish() {
    if (replayTimer) return;
    audio.pause();
    replayTimer = setTimeout(() => {
      replayTimer = 0;
      replay();
    }, 3000);
  }

  /* ======================================================================
     6. KONTROL
     ====================================================================== */
  async function togglePlay() {
    if (audio.paused) {
      resumeAudio();
      if (audio.ended || audio.currentTime >= totalTime() - 0.05) restart();
      try {
        await audio.play();
      } catch (err) {
        toast("Audio belum bisa diputar — buka ✎ LIRIK › Ganti audio");
      }
    } else {
      audio.pause();
    }
  }

  function restart() {
    clearTimeout(replayTimer);
    replayTimer = 0;
    audio.currentTime = 0;
    render(0);
  }

  async function replay() {
    resumeAudio();
    restart();
    try {
      await audio.play();
    } catch (err) {
      toast("Ketuk layar dulu untuk memutar");
    }
  }

  function seek(delta) {
    clearTimeout(replayTimer);
    replayTimer = 0;
    const max = Math.max(0, totalTime() - 0.05);
    audio.currentTime = Math.max(0, Math.min((audio.currentTime || 0) + delta, max));
    render(audio.currentTime);
  }

  function toggleEditor() {
    consoleBox.classList.toggle("open");
    if (consoleBox.classList.contains("open")) {
      if (!scriptBox.value) scriptBox.value = serialize();
      scriptBox.focus();
    }
  }

  audio.addEventListener("play", () => {
    body.classList.add("is-playing");
    resumeAudio();
  });
  audio.addEventListener("pause", () => body.classList.remove("is-playing"));
  audio.addEventListener("ended", finish);
  audio.addEventListener("loadedmetadata", refreshLyrics);

  audioFile.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    audio.src = objectUrl;
    audio.load();
    restart();
    resumeAudio();
    audio
      .play()
      .then(() => toast("Audio: " + f.name))
      .catch(() => toast("Ketuk layar untuk memutar"));
  });

  document.addEventListener("keydown", (e) => {
    resumeAudio();
    if (e.target === scriptBox) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        applyScript();
      } else if (e.key === "Escape") {
        consoleBox.classList.remove("open");
      }
      return;
    }
    const k = e.key.toLowerCase();
    if (e.code === "Space") {
      e.preventDefault();
      togglePlay();
    } else if (k === "r") replay();
    else if (k === "e") toggleEditor();
    else if (e.key === "Escape") consoleBox.classList.remove("open");
    else if (e.key === "ArrowLeft") {
      e.preventDefault();
      seek(-5);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      seek(5);
    } else if (e.key === "[") seek(-1);
    else if (e.key === "]") seek(1);
  });

  document.addEventListener("click", (e) => {
    if (consoleBox.contains(e.target)) return;
    resumeAudio();
    togglePlay();
  });

  window.addEventListener("resize", resizeCanvas);

  /* ======================================================================
     7. EDITOR LIRIK
     Format:  muncul | tahan | teks
     Juga menerima:  teks = 2 detik   (waktu muncul menyusul otomatis)
     ====================================================================== */
  const fmt = (n) => String(Math.round(Number(n) * 1000) / 1000);

  function serialize() {
    return baseCues()
      .map(
        (c) =>
          `${fmt(c.at)} | ${fmt(c.hold)} | ${c.mood ? "[" + c.mood + "] " : ""}${c.text}`,
      )
      .join("\n");
  }

  function parseScript(raw) {
    const rows = [];
    let at = 0;
    raw.split(/\r?\n/).forEach((line) => {
      const s = line.trim();
      if (!s || s.startsWith("#") || s.startsWith("//")) return;
      if (rows.length >= 400) return;

      // Format lengkap:  muncul | tahan | teks
      const parts = s.split("|");
      if (parts.length >= 3) {
        const a = Number(parts[0].trim());
        const h = Number(parts[1].trim());
        const text = parts.slice(2).join("|").trim();
        if (isFinite(a) && isFinite(h) && text) {
          at = a;
          rows.push({ text, at: a, hold: h });
          return;
        }
      }

      // Format singkat sesuai contoh:  teks = 2 detik
      const eq = s.match(
        /^(.*?)\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*(?:detik|dtk|s)?\s*$/i,
      );
      if (eq && eq[1].trim()) {
        const h = Number(eq[2]);
        rows.push({ text: eq[1].trim(), at, hold: h });
        at += h;
        return;
      }

      // Tanpa angka: pakai tahan default, muncul menyusul.
      rows.push({ text: s, at, hold: DEFAULT_HOLD });
      at += DEFAULT_HOLD;
    });
    return rows;
  }

  function applyScript() {
    const next = parseScript(scriptBox.value);
    if (!next.length) {
      toast("Lirik kosong");
      return;
    }
    customCues = next;
    refreshLyrics();
    consoleBox.classList.remove("open");
    toast(next.length + " baris diterapkan");
  }

  $("edit").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleEditor();
    if (consoleBox.classList.contains("open")) scriptBox.value = serialize();
  });
  $("close").addEventListener("click", () => consoleBox.classList.remove("open"));
  $("loadAudio").addEventListener("click", () => audioFile.click());
  $("apply").addEventListener("click", applyScript);
  $("styler").addEventListener("click", () => {
    scriptBox.value = serialize();
    toast("Waktu dirapikan");
  });
  $("demo").addEventListener("click", () => {
    customCues = null;
    scriptBox.value = serialize();
    refreshLyrics();
    toast("Lirik dari lyrics.js dikembalikan");
  });
  /* ======================================================================
     8. API KONSOL (perintah tambahan)
     ====================================================================== */
  window.TheCure = {
    cues: () =>
      lyrics.map((l) => ({
        text: l.text,
        at: l.at,
        hold: l.hold,
        end: Math.round(l.end * 1000) / 1000,
        mood: l.mood,
      })),
    seek: seek,
    play: togglePlay,
    replay: replay,
    editor: toggleEditor,
    renderAt: (t) => render(Number(t) || 0),
    viz: () => ({
      energy: Math.round(energy * 1000) / 1000,
      bass: Math.round(bass * 1000) / 1000,
      beat: Math.round(beat * 1000) / 1000,
      bpm: bpmEstimate,
    }),
    reset: () => {
      customCues = null;
      refreshLyrics();
      toast("Kembali ke lyrics.js");
    },
  };

  /* ======================================================================
     9. MULAI — langsung jalan begitu halaman dibuka dari server
     ====================================================================== */
  resizeCanvas();
  refreshLyrics();
  requestAnimationFrame(tick);

  // Coba autoplay. Kalau browser melarang, cukup ketuk layar / Space.
  // Tambahkan ?autoplay=0 di URL kalau tidak ingin langsung diputar.
  if (new URLSearchParams(location.search).get("autoplay") !== "0") {
    initAudioGraph();
    audio.play().catch(() => {});
  }
})();
