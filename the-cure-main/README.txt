THE CURE - pemutar lirik yang mengikuti audio
=============================================

CARA MENJALANKAN
----------------

Windows: klik dua kali start.bat.

Cara lain:
  - python start.py
  - buka index.html langsung di browser
  - pakai server statis lain (Live Server, http-server, dll.)

start.bat menjalankan start.py, menyalakan server di port 8000 (kalau
sudah dipakai, cari port kosong berikutnya), lalu membuka browser.
Tekan Ctrl+C di jendela server untuk menghentikannya.

Audio diputar otomatis. Kalau diblokir browser, klik halaman sekali atau
tekan Spasi. Tambahkan ?autoplay=0 di URL kalau tidak ingin autoplay.

Selesai lagu: tunggu 3 detik lalu putar ulang otomatis. Tidak ada kartu
judul di akhir. Tekan tombol apa saja saat jeda itu untuk langsung ulang.

Audio bawaan: the-cure.mp3. Bisa diganti lewat tombol LIRIK > Ganti audio.

STRUKTUR FILE
-------------

start.bat      menjalankan proyek di Windows
start.py       server lokal + membuka browser
index.html     struktur halaman
style.css      tampilan dan efek visual
lyrics.js      lirik, waktu muncul, dan lama tampil (file yang diedit)
app.js         animasi, kontrol, dan editor
the-cure.mp3   audio

MENGATUR WAKTU LIRIK
--------------------

Edit lyrics.js. Tiap baris berbentuk:

    cue(`teks lirik`, muncul, tahan, suasana)

  muncul   = detik dari awal audio saat teks mulai tampil
  tahan    = lama teks tampil, dalam detik
  suasana  = optional: "sad" mengubah latar saat lirik itu aktif

Contoh:

    cue(`why.can("you come stitch me up")`, 4.0, 2.6)

Artinya teks tampil di detik 4,0 selama 2,6 detik.

Penyesuaian yang sering dipakai:
  - ganti lebih cepat     -> kecilkan "tahan"
  - lebih lama tampil     -> besarkan "tahan"
  - mulai setelah intro   -> besarkan "muncul"

Pakai tanda backtick (`) untuk teks, bukan tanda kutip, karena dalam
teks ada tanda kutip ganda.

SUASANA LATAR
-------------

Efek "sad" hanya mengubah latar (warna, grid, garis hujan, denyut
lingkaran), tidak mengubah bentuk teks lirik. Berlaku selama baris
bersangkutan tampil. Di editor ditulis sebagai prefix:

    [sad] oh.because("my head is full of poison")

KONTROL
-------

  Spasi / klik halaman   play atau pause
  R                      ulang dari awal
  E                      buka atau tutup editor lirik
  Esc                    tutup editor
  Panah kiri / kanan     mundur / maju 5 detik
  [ / ]                  mundur / maju 1 detik
  Ctrl+Enter             terapkan lirik dari editor

Perintah di Console browser (F12):

  TheCure.cues()         lihat daftar waktu lirik
  TheCure.seek(20)       lompat ke detik 20
  TheCure.play()         play atau pause
  TheCure.replay()       ulang dari awal
  TheCure.editor()       buka editor
  TheCure.reset()        kembali ke lirik dari lyrics.js

EDITOR LIRIK
------------

Tombol LIRIK di pojok kanan membuka editor. Format yang diterima:

  1) muncul | tahan | teks
     4.0 | 2.6 | why.can("you come stitch me up")

  2) teks = 2 detik
     Waktu muncul dihitung otomatis dari baris sebelumnya.

  3) teks saja
     Memakai tahan default 2,5 detik.

Perubahan di editor hanya berlaku sampai halaman di-refresh. Supaya
permanen, edit langsung di lyrics.js.

CATATAN AUDIO
-------------

Durasi audio 77,27 detik. Vokal masuk sekitar detik 3,8, bagian yang
berulang ada di sekitar detik 16 dan 44, bagian terpadat antara 30-58.
Waktu di lyrics.js mengikuti angka-angka ini dan boleh diubah.
