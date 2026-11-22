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
  cue(`why.can("you come stitch me up")`, 4.0, 3.6),
  cue(`why.can("it") { ever: "enough?" }`, 7.6, 2.6),
  cue(`why.can("you come stitch me up")`, 10.2, 4.6),
  cue(`why.can("it") { ever: "enoughhhhhhhhhhhhhhhhh?" }`, 14.8, 5.2),
  cue(`result: "not enough"`, 23.0, 5.2),

  cue(`oh.because("my head is full of poison")`, 29, 2.4),
  cue(`and.heart("is full of doubt")`, 31.6, 2.4),
  cue(`i.got("toxins in my bloodstream")`, 34.0, 2.4),
  cue(`you.tried("so hard to suck out")`, 36.4, 2.4),
  cue(`it.feels("like medication")`, 38.8, 2.4),
  cue(`it.good("for me, I'm sure")`, 41.2, 15.8),

  cue(`love.dont("matter anymore")`, 53.0, 5.6),
  cue(`it.never("be the cure")`, 58.6, 6.8),
  cue(`it.never("be the cure")`, 65.4, 6.7),
  cue(`it.never("be")`, 72.1, 5.17),
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
