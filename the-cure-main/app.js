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
  const consoleBox = $("console");
  const scriptBox = $("script");
  const endcard = $("endcard");
  const toastEl = $("toast");
  const audioFile = $("audioFile");

  let customCues = null; // null = pakai window.LYRICS dari lyrics.js
  let lyrics = []; // [{ text, at, hold, end, reff }]
  let built = [];
  let activeIndex = -1;
  let objectUrl = null;
  let toastTimer = 0;

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
     3. TIMING EKSPLISIT — diambil dari lyrics.js, bukan dibagi rata
     ====================================================================== */
  function normalize(raw) {
    return (raw || [])
      .map((row) => {
        if (typeof row === "string") {
          return { text: row, at: 0, hold: DEFAULT_HOLD };
        }
        const text = String(row.text || row.teks || "");
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
        return { text, at: isFinite(at) ? Math.max(0, at) : 0, hold };
      })
      .filter(Boolean)
      .filter((r) => r.text.trim());
  }

  function baseCues() {
    return normalize(
      customCues && customCues.length ? customCues : window.LYRICS,
    );
  }

  function sourceCues() {
    const base = baseCues();
    const every = Number(window.ULANGI_SETIAP) || 0;
    const max = every > 0 ? Math.max(0, Number(window.ULANGI_MAKS) || 0) : 0;

    const out = [];
    for (let r = 0; r <= max; r++) {
      base.forEach((c) =>
        out.push({ text: c.text, at: c.at + r * every, hold: c.hold }),
      );
    }
    return out.sort((a, b) => a.at - b.at);
  }

  function buildTimeline() {
    const cues = sourceCues();
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
        return { text: c.text, at, hold, end, reff: true };
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
      el.className = "line" + (item.reff ? " reff" : "");
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
  function follow(el, panning) {
    const cur = el.querySelector(".cur");
    const y =
      el.offsetTop +
      (cur && cur.offsetParent
        ? cur.offsetTop + cur.offsetHeight / 2
        : el.offsetHeight / 2);
    const x =
      cur && cur.offsetParent
        ? -(cur.offsetLeft - lens.clientWidth * 0.5) * 0.22
        : 0;
    lens.classList.toggle("panning", !!panning);
    lens.style.transform =
      "translate(calc(-50% + " +
      x.toFixed(1) +
      "px), " +
      (-(y + el.offsetHeight / 2)).toFixed(1) +
      "px)";
  }

  function render(t) {
    let active = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (t >= lyrics[i].at && t < lyrics[i].end) active = i;
    }
    body.classList.toggle("is-reff", active >= 0 && !!lyrics[active].reff);

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
      if (active >= 0) follow(built[active].el, false);
    } else if (changed && active >= 0) {
      follow(built[active].el, true);
    }
  }

  function tick() {
    render(audio.currentTime || 0);
    if (
      !audio.paused &&
      !audio.ended &&
      audio.currentTime >= totalTime() - 0.05
    ) {
      finish();
      return;
    }
    requestAnimationFrame(tick);
  }

  function finish() {
    audio.pause();
    body.classList.add("is-ended");
    endcard.classList.add("show");
  }

  /* ======================================================================
     6. KONTROL
     ====================================================================== */
  async function togglePlay() {
    if (audio.paused) {
      if (body.classList.contains("is-ended")) restart();
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
    endcard.classList.remove("show");
    body.classList.remove("is-ended");
    audio.currentTime = 0;
    render(0);
  }

  async function replay() {
    restart();
    try {
      await audio.play();
    } catch (err) {
      toast("Ketuk layar dulu untuk memutar");
    }
  }

  function seek(delta) {
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

  audio.addEventListener("play", () => body.classList.add("is-playing"));
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
    audio
      .play()
      .then(() => toast("Audio: " + f.name))
      .catch(() => toast("Ketuk layar untuk memutar"));
  });

  document.addEventListener("keydown", (e) => {
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
    if (consoleBox.contains(e.target) || endcard.classList.contains("show"))
      return;
    togglePlay();
  });

  /* ======================================================================
     7. EDITOR LIRIK
     Format:  muncul | tahan | teks
     Juga menerima:  teks = 2 detik   (waktu muncul menyusul otomatis)
     ====================================================================== */
  const fmt = (n) => String(Math.round(Number(n) * 1000) / 1000);

  function serialize() {
    return baseCues()
      .map((c) => `${fmt(c.at)} | ${fmt(c.hold)} | ${c.text}`)
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
  $("again").addEventListener("click", (e) => {
    e.stopPropagation();
    replay();
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
      })),
    seek: seek,
    renderAt: render,
    play: togglePlay,
    replay: replay,
    editor: toggleEditor,
    reset: () => {
      customCues = null;
      refreshLyrics();
      toast("Kembali ke lyrics.js");
    },
  };

  /* ======================================================================
     9. MULAI — langsung jalan begitu halaman dibuka dari server
     ====================================================================== */
  refreshLyrics();
  requestAnimationFrame(tick);

  // Coba autoplay. Kalau browser melarang, cukup ketuk layar / Space.
  // Tambahkan ?autoplay=0 di URL kalau tidak ingin langsung diputar.
  if (new URLSearchParams(location.search).get("autoplay") !== "0") {
    audio.play().catch(() => {});
  }
})();
