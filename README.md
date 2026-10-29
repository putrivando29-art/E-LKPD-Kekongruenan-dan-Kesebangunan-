# E-LKPD Kekongruenan dan Kesebangunan

Lembar Kerja Peserta Didik elektronik untuk Matematika kelas VIII SMP, materi kekongruenan dan kesebangunan. Disusun oleh Kelompok 8 PKD.

Website ini memiliki server sendiri (Node.js) dan database (SQLite). Login, penyimpanan jawaban, validasi, kunci jawaban, penilaian, dan pembuatan PDF semuanya berjalan di server, bukan hanya tampilan.

## Isi LKPD

| Bagian | Isi | Penilaian |
|---|---|---|
| Petunjuk | Identitas dari akun, nomor absen, tujuan, petunjuk | Tidak dinilai |
| Pemantik | 4 pertanyaan pemantik | Tidak dinilai, guru memberi umpan balik |
| Aktivitas 1: Mengamati | Bangun A, B, C, D pada petak 1 cm, alat perbesar tampilan, ukuran, putar dan tumpuk | 2 butir otomatis, 3 uraian dinilai guru |
| Aktivitas 2: Menanya | Pertanyaan buatan siswa dengan panduan | Dinilai guru |
| Aktivitas 3: Mencoba | Simulasi A (kongruen) dan Simulasi B (sebangun), catatan percobaan minimal 2 per simulasi | 5 butir otomatis, sisanya dinilai guru |
| Latihan | 7 soal bertahap: kongruen s.s.s, perbandingan dan faktor skala, mengenali bangun, benar atau salah, panjang sisi, besar sudut, soal kontekstual | Otomatis untuk jawaban pasti, langkah dan alasan dinilai guru |
| Aktivitas 4: Menalar | 5 pernyataan yang dilengkapi siswa | Dinilai guru dengan rubrik |
| Aktivitas 5: Refleksi | 4 pertanyaan refleksi | Tidak dinilai, guru memberi umpan balik |
| Ringkasan | Status setiap bagian, daftar yang belum diisi, Kumpulkan LKPD, unduh PDF | |

Ukuran bangun Aktivitas 1 (petak 1 cm): A segitiga siku-siku 3, 4, 5 cm; B segitiga sama kaki dengan alas 4 cm dan tinggi 3 cm; C adalah A diperbesar 1,5 kali; D kongruen dengan A. Keempat bangun diberi warna yang sama agar warna tidak membocorkan pasangan.

### Simulasi

- **Simulasi A**: ABC tetap (AB = 5, BC = 7, CA = 8 cm). DEF dapat digeser dengan mouse atau sentuhan, diputar lewat gagang, dicerminkan, diimpitkan ke ABC, dan diubah panjang sisinya (dengan pemeriksaan ketaksamaan segitiga). Panjang sisi dan besar sudut dihitung ulang dari koordinat hasil transformasi, lalu dibandingkan per pasangan A ke D, B ke E, C ke F.
- **Simulasi B**: PQR tetap (3, 4, 5 cm). STU dapat diatur dengan faktor skala k (0,5 sampai 3) atau sisi satu per satu. Tabel menampilkan hasil bagi sisi bersesuaian dan besar sudut, serta keterangan apakah sudut sama dan perbandingan tetap.
- Papan ketik: pilih segitiga lalu tekan tombol panah. Tombol "Atur Ulang Simulasi" tersedia di kedua simulasi.

## Aturan pengisian dan pemeriksaan

- Uraian dianggap terisi jika memuat minimal 3 huruf atau angka. Spasi atau tanda baca saja tidak dihitung. Isian bilangan dan perbandingan harus dapat dibaca sebagai bilangan.
- Server memeriksa ulang semua kolom wajib saat pengumpulan dan mengembalikan daftar pertanyaan yang belum diisi.
- Jawaban disimpan otomatis 1 detik setelah siswa berhenti mengetik, saat pindah bagian, dan saat halaman ditutup. Jika koneksi terputus, perubahan disimpan di `localStorage` perangkat dan dikirim ulang otomatis.
- Pengumpulan memerlukan konfirmasi dan dicegah ganda di server (pembaruan bersyarat). Setelah dikumpulkan, jawaban tidak dapat diubah.
- Guru dapat membuka kembali LKPD dengan alasan wajib. Pembukaan tercatat di riwayat dan terlihat oleh siswa. Aktivitas yang kuncinya sudah dilihat siswa tetap terkunci, kecuali guru memilih membukanya juga.
- **Kunci jawaban dan pembahasan hanya ada di `server/keys.js`** dan hanya dikirim setelah server memastikan syaratnya terpenuhi. Guru memilih per kelas kapan siswa boleh melihatnya:
  - *Sebelum pengumpulan*: setelah semua pertanyaan wajib aktivitas itu terisi. Setelah diperiksa, aktivitas itu terkunci agar siswa tidak bisa mencoba-coba jawaban.
  - *Setelah siswa mengumpulkan* (bawaan).
  - *Setelah seluruh kelas mengumpulkan*.
- Pemeriksaan otomatis menerima bentuk setara: `1 : 2`, `3:6`, `1/2`, `0,5`, `1 banding 2`; `6 cm`, `6,0`, `12/2`; `60°`, `60 derajat`.
- Skor dan komentar guru baru terlihat siswa setelah guru menandai penilaian selesai.

## Menjalankan

Kebutuhan: Node.js 22.5 atau lebih baru (memakai modul bawaan `node:sqlite`).

```bash
npm install
```

```bash
npm run buat-guru -- --email guru@sekolah.sch.id --nama "Nama Guru" --kelas "VIII A"
```

Perintah di atas menanyakan kata sandi guru dan mencetak **kode kelas**. Siswa mendaftar sendiri di website dengan kode kelas itu. Akun guru tidak dapat dibuat dari website.

```bash
npm start
```

Buka `http://localhost:3000`. Guru dapat membuat kelas tambahan dari Dasbor Guru.

### Variabel lingkungan

| Nama | Bawaan | Fungsi |
|---|---|---|
| `PORT` | `3000` | Port server |
| `DB_FILE` | `data/elkpd.sqlite` | Lokasi berkas database |
| `COOKIE_SECURE` | kosong | Isi `1` bila situs dibuka lewat HTTPS |
| `TRUST_PROXY` | kosong | Isi `1` bila server berada di belakang reverse proxy |
| `ZONA_WAKTU`, `LABEL_ZONA_WAKTU` | `Asia/Jakarta`, `WIB` | Zona waktu pada PDF |

Tidak ada kunci rahasia di kode frontend. Sesi disimpan sebagai token acak di cookie `HttpOnly`, kata sandi di-hash dengan scrypt.

## Pengujian

```bash
npm test
```

21 uji otomatis (`test/api.test.js`, `test/grading.test.js`) memeriksa: pendaftaran dan validasinya, pembatasan akses siswa dan guru (termasuk guru lain), penyimpanan progres, kolom berisi spasi, pengumpulan yang belum lengkap, pengumpulan ganda serentak, penguncian setelah pengumpulan, ketiga mode pembahasan, bentuk jawaban setara, penilaian guru, pembukaan kembali, unduhan PDF dan CSV, serta atur ulang kata sandi.

Uji antarmuka di browser (butuh Playwright dan Chromium) terhadap server yang sedang berjalan:

```bash
node test/ui-flow.js http://localhost:3000 KODEKELAS guru@sekolah.sch.id sandiguru folder-hasil
```

Skrip ini menjalankan alur siswa (daftar, pemantik, muat ulang, mode luring, Aktivitas 1, simulasi dengan seret mouse, kumpul saat belum lengkap, konfirmasi, unduh PDF, pembahasan), alur guru (dasbor, unduh PDF, penilaian, buka kembali), dan tampilan HP 375 px dengan seret sentuh, sambil memeriksa galat konsol dan luapan horizontal.

## Deploy

Website ini **tidak bisa** dipasang di hosting statis (Netlify Drop, GitHub Pages, Vercel statis), karena membutuhkan server Node.js yang terus berjalan dan penyimpanan berkas yang tidak terhapus saat server dimulai ulang. Pilihan yang sesuai:

- Komputer atau server sekolah di jaringan lokal: jalankan `npm start`, siswa membuka `http://alamat-ip:3000`.
- VPS atau layanan hosting Node.js yang menyediakan disk persisten. Arahkan `DB_FILE` ke disk persisten, aktifkan HTTPS, lalu set `COOKIE_SECURE=1` dan `TRUST_PROXY=1`.

Jika hosting tidak menyediakan disk persisten, data akan hilang saat server dimulai ulang. Untuk kasus itu, lapisan `server/db.js` perlu diganti ke database terkelola (misalnya PostgreSQL). Penggantian ini belum dibuat.

Cadangkan database dengan menyalin berkas `DB_FILE` saat server berhenti.

## Yang belum tersedia

- Berkas PDF LKPD asli tidak ada di sesi pembuatan. Isi dan urutan mengikuti spesifikasi tertulis. Warna memakai hijau tua `#1F5C4F` dan jingga bata `#B5541C` sebagai dugaan; semua warna diatur di bagian `:root` pada `public/css/style.css` dan `server/pdf.js` sehingga mudah disamakan dengan PDF asli.
- Belum ada reset kata sandi lewat email. Guru mengatur ulang kata sandi siswa dari Dasbor Guru dan mendapat kata sandi sementara.
- Satu akun siswa mengerjakan satu LKPD dan terdaftar di satu kelas.
- Pembatas percobaan masuk disimpan di memori server dan hilang saat server dimulai ulang.
- Pada Node.js 22, `node:sqlite` masih berlabel eksperimental. Skrip `npm start` menyembunyikan peringatannya.

## Struktur

```
server/index.js     titik masuk server
server/app.js       rute API, hak akses, pengumpulan, pembahasan, penilaian
server/lkpd.js      isi LKPD yang boleh dilihat siswa
server/keys.js      kunci jawaban, pembahasan, rubrik (hanya server)
server/grading.js   validasi isian, pengurai bilangan dan perbandingan, skor
server/pdf.js       PDF dari data tersimpan (PDFKit, huruf DejaVu Sans)
server/db.js        skema dan akses SQLite
server/auth.js      hash kata sandi, sesi, pembatas percobaan masuk
scripts/buat-guru.js  membuat akun guru dan kelas
public/             halaman, CSS, JavaScript, huruf Atkinson Hyperlegible
test/               uji API, uji penilaian, uji browser
```

## Keputusan desain

- Arah visual: lembar kerja cetak di layar. Latar kertas hangat, kartu putih sebagai lembar, label kegiatan berwarna solid seperti tab nomor kegiatan. Tidak ada gradasi, efek kaca, atau animasi dekoratif.
- Huruf Atkinson Hyperlegible (SIL Open Font License) dipilih karena dirancang untuk membedakan huruf dan angka yang mirip, penting untuk membaca label titik dan ukuran. PDF memakai DejaVu Sans karena memuat simbol °, ∠, dan ≅.
- Petak 1 cm pada gambar adalah alat ukur, bukan hiasan.
- Kontras teks diperiksa dengan rumus WCAG; pasangan utama berada pada rasio 4,9 sampai 7,2 (lulus AA).
- Hanya tema terang, mengikuti tampilan LKPD kertas.

## Rujukan materi

Definisi dan syarat kekongruenan (s.s.s, s.sd.s, sd.s.sd) dan kesebangunan (sudut bersesuaian sama besar, sisi bersesuaian sebanding) adalah materi baku geometri SMP. Rujukan yang dapat diakses gratis:

- Kemendikbudristek. *Matematika SMP/MTs Kelas IX* (Buku Siswa, Kurikulum 2021): https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Matematika_BS_KLS_IX.pdf
- Kemendikbudristek. *Buku Panduan Guru Matematika SMP Kelas IX* (Kurikulum 2021): https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Matematika_BG_KLS_IX_Lc.pdf
- Capaian Pembelajaran Matematika Fase D (SK BSKAP No. 032/H/KR/2024) memuat kemampuan menjelaskan sifat kekongruenan dan kesebangunan segitiga dan segiempat serta memakainya untuk menyelesaikan masalah. Naskah resmi perlu dicek langsung di laman BSKAP Kemendikdasmen, karena rujukan yang ditemukan saat penyusunan berupa dokumen sekunder.

Bab yang memuat materi ini pada kedua buku di atas belum diverifikasi halaman per halaman.

## Lisensi pihak ketiga

- Atkinson Hyperlegible: SIL Open Font License 1.1 (`public/fonts/LICENSE-AtkinsonHyperlegible.txt`).
- DejaVu Sans: lisensi Bitstream Vera dan domain publik (`server/fonts/LICENSE-DejaVu.txt`).
- Express dan PDFKit: lisensi MIT (lewat npm).
