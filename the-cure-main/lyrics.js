/* ==========================================================================
   THE CURE — LIRIK & WAKTU
   --------------------------------------------------------------------------
   FILE INI YANG KAMU EDIT SENDIRI UNTUK MENGATUR LIRIK.

   Setiap baris ditulis begini:

       cue( teks, muncul, tahan )

     • teks    = lirik (pakai tanda backtick ` karena ada tanda kutip " di dalam)
     • muncul  = detik dari awal lagu saat lirik ini mulai muncul
     • tahan   = berapa detik lirik ini nampak sebelum berganti

   CONTOH:
       cue(`why.can("you come stitch me up")`, 4.0, 2.6)
       -> muncul di detik 4,0, nahan 2,6 detik, lalu ganti ke lirik berikutnya.

   Ingin lebih cepat? Kecilkan angka "tahan".
   Ingin lebih lambat? Besarkan angka "tahan".
   Ingin lirik mulai lebih akhir? Besarkan angka "muncul".

   Catatan audio: durasi terdekode 77,27 detik.
     ~3,8 dtk  perubahan pertama / vokal mulai masuk
     ~16 dtk   bagian berulang pertama
     ~44 dtk   pengulangan berikutnya
     30-58 dtk bagian paling padat
   ========================================================================== */

const cue = (text, muncul, tahan) => ({
  text: text,
  at: Number(muncul) || 0,
  hold: Math.max(0.2, Number(tahan) || 2.5),
});

window.LYRICS = [
  /* ---- BAGIAN 1: why.can ... result: "not enough" ---------------------- */
  cue(`im unraveled")`, 4.0, 2.6),
  cue(`why.can("you come stitch me up")`, 4.0, 2.6),
  cue(`why.can("it") { ever: "enough?" }`, 6.6, 2.6),
  cue(`why.can("you come stitch me up")`, 9.2, 2.6),
  cue(`why.can("it") { ever: "enough?" }`, 11.8, 2.6),
  cue(`result: "not enough"`, 14.4, 2.6),

  /* ---- BAGIAN 2: reff --------------------------------------------------- */
  cue(`oh.because("my head is full of poison")`, 17.2, 2.4),
  cue(`and.heart("is full of doubt")`, 19.6, 2.4),
  cue(`i.got("toxins in my bloodstream")`, 22.0, 2.4),
  cue(`you.tried("so hard to suck out")`, 24.4, 2.4),
  cue(`it.feels("like medication")`, 26.8, 2.4),
  cue(`it.good("for me, I'm sure")`, 29.2, 2.4),
  cue(`love.dont("matter anymore")`, 31.6, 2.4),
  cue(`it.never("be the cure")`, 34.0, 2.4),
  cue(`it.never("be the cure")`, 36.4, 2.4),
  cue(`it.never("be")`, 38.8, 2.4),
];

/* --------------------------------------------------------------------------
   PENGULANGAN
   Lagu ini mengulang bagian yang sama. Supaya layar tidak kosong sampai lagu
   habis, blok 15 lirik di atas diulang dengan jeda berikut.

     ULANGI_SETIAP = jeda (detik) sebelum blok dimulai lagi. 0 = tidak diulang.
     ULANGI_MAKS   = berapa kali diulang. 0 = tidak diulang.

   Dengan nilai 40, blok kedua mulai di detik 4 + 40 = 44 (pas dengan bagian
   yang terdeteksi berulang di audio).
   -------------------------------------------------------------------------- */
window.ULANGI_SETIAP = 40;
window.ULANGI_MAKS = 1;
