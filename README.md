THE CURE — LYRIC.SYSTEM
=======================

CARA JALANKAN (PALING MUDAH)
----------------------------
Klik 2x start.bat.

Itu saja. Server langsung nyala, browser langsung terbuka di halaman
proyek, dan audio langsung diputar. Tekan Ctrl+C di jendela server untuk
berhenti. Kalau port 8000 dipakai, otomatis cari port kosong berikutnya.

Alternatif lain:
  - Klik 2x index.html -> langsung jalan tanpa server (tetap autoplay).
  - Dari terminal: python start.py
  - Server lain (Live Server, http-server, dll) -> buka index.html.

Kalau browser melarang autoplay, ketuk layar sekali atau tekan Space.
Untuk mematikan autoplay, buka: index.html?autoplay=0

File audio: the-cure.mp3 (bisa diganti lewat tombol ✎ LIRIK > Ganti audio).

ISI FILE
--------
start.bat      klik 2x untuk menjalankan proyek (Windows)
start.py       mesin server + buka browser otomatis
index.html     kerangka halaman (jarang diubah)
style.css      background, warna, tipografi, efek (jangan diubah kalau suka)
lyrics.js      PENTING: semua lirik + waktu muncul + lama tampil
app.js         mesin animasi & kontrol (tidak perlu diubah)
the-cure.mp3   audio

CARA ATUR WAKTU LIRIK
---------------------
Buka lyrics.js dengan Notepad / VS Code. Tiap baris begini:

    cue(`why.can("you come stitch me up")`, 4.0, 2.6)
        \\____________ teks ______________/   ^     ^
                                           |     |
                                    muncul(dtk) tahan(dtk)

Artinya: lirik muncul di detik 4,0, nampak 2,6 detik, lalu berganti.

Contoh mengubah:
  - Mau lebih cepat ganti       -> kecilkan "tahan": 2.6 jadi 1.5
  - Mau lebih lama nahan        -> besarkan "tahan": 2.6 jadi 4.0
  - Mau mulai setelah musik masuk -> besarkan "muncul": 4.0 jadi 8.0

Pakai tanda backtick ` untuk teks, bukan tanda kutip ", karena di dalam
teks ada tanda kutip (contoh: why.can("it") { ever: "enough?" }).

PENGULANGAN
-----------
Di bawah daftar lirik ada:

    window.ULANGI_SETIAP = 40;  // jeda sebelum blok 15 lirik diulang
    window.ULANGI_MAKS = 1;     // berapa kali diulang (0 = tidak diulang)

Nilai 40 membuat blok kedua mulai di detik 4 + 40 = 44, mengikuti bagian
lagu yang terdeteksi berulang. Ubah sesuai kebutuhan.

PERINTAH / KONTROL
------------------
  Space  atau ketuk layar   play / pause
  R                         putar ulang dari awal
  E                         buka / tutup editor lirik
  Esc                       tutup editor
  ←  / →                    mundur / maju 5 detik
  [  / ]                    mundur / maju 1 detik (cocok buat nyetel timing)
  Ctrl+Enter di editor      terapkan lirik langsung

Di browser (Console / F12) juga tersedia:
  TheCure.cues()           lihat daftar waktu yang dipakai
  TheCure.seek(20)         lompat ke detik 20
  TheCure.play()           play / pause
  TheCure.replay()         ulang dari awal
  TheCure.editor()         buka editor
  TheCure.reset()          kembali ke lirik dari lyrics.js

EDITOR DALAM APLIKASI
---------------------
Tombol ✎ LIRIK membuka editor. Tiga format yang diterima:

  1) muncul | tahan | teks
     4.0 | 2.6 | why.can("you come stitch me up")

  2) teks = 2 detik
     why.can("you come stitch me up") = 2 detik
     (waktu muncul dihitung otomatis dari lirik sebelumnya)

  3) teks saja
     (memakai tahan default 2,5 detik)

Perubahan di editor hanya sementara (hilang setelah refresh).
Supaya permanen, ubah langsung di lyrics.js.

CATATAN AUDIO
-------------
Durasi terdekode 77,27 detik. Vokal/perubahan pertama ~3,8 detik,
bagian berulang ~16 detik dan ~44 detik, bagian paling padat 30-58 detik.
Angka di lyrics.js sudah disesuaikan dengan itu, tapi bebas kamu ubah.
