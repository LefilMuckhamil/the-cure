/* ==========================================================================
   THE CURE — LIRIK & WAKTU
   --------------------------------------------------------------------------
   FILE INI YANG KAMU EDIT SENDIRI UNTUK MENGATUR LIRIK.

   Setiap baris ditulis begini:

       cue( teks, muncul, tahan, suasana )

     • teks    = lirik (pakai tanda backtick ` karena ada tanda kutip " di dalam)
     • muncul  = detik dari awal lagu saat lirik ini mulai muncul
     • tahan   = berapa detik lirik ini nampak sebelum berganti
     • suasana = optional: sad (mengubah latar, bukan tipografi)

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

const cue = (text, muncul, tahan, mood = "") => ({
  text: text,
  at: Number(muncul) || 0,
  hold: Math.max(0.2, Number(tahan) || 2.5),
  mood: mood,
});

window.LYRICS = [
  cue(`why.can("you come stitch me up")`, 4.0, 3.6),
  cue(`why.can("it") { ever: "enough?" }`, 7.6, 2.9),
  cue(`why.can("you come stitch me up")`, 10.5, 3.5),
  cue(`why.can("it") { ever: "enoughhhhhhhhhhh?" }`, 14.0, 9.0),
  cue(`result: "not enough"`, 23.0, 5.5),

  cue(`oh.because("my head is full of poison")`, 28.5, 4.5, "sad"),
  cue(`and.heart("is full of doubt")`, 33.0, 3.0, "sad"),
  cue(`i.got("toxins in my bloodstream")`, 36.0, 4.0, "sad"),
  cue(`you.tried("so hard to suck out")`, 40.0, 3.0, "sad"),
  cue(`it.feels("like medication")`, 43.0, 3.0, "sad"),
  cue(`it.good("for me, I'm sure")`, 46.0, 4.0, "sad"),

  cue(`love.dont("matter anymore")`, 50.0, 5.0),
  cue(`it.never("be the cure")`, 55.0, 8.0),
  cue(`it.never("be the cure")`, 63.0, 7.1),
  cue(`it.never("be")`, 70.1, 7.17),
];
