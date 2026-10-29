# E-LKPD Kekongruenan dan Kesebangunan

Lembar Kerja Peserta Didik elektronik untuk Matematika kelas VIII SMP, materi kekongruenan dan kesebangunan. Disusun oleh KELOMPOK 8.

Website ini punya server (Node.js, Express) dan database. Login, penyimpanan jawaban, validasi, kunci jawaban, penilaian, dan PDF semuanya diproses di server.

- Di **Vercel**: server berjalan sebagai Vercel Function (`api/index.js`), database memakai **PostgreSQL**, misalnya Supabase.
- Di **komputer sendiri**: `npm start`. Tanpa `DATABASE_URL`, data disimpan di SQLite (`data/elkpd.sqlite`).

## Kenapa versi pertama error 404 di Vercel

Vercel hanya menyajikan berkas statis dari folder `public/`. Server Node.js tidak dijalankan, sehingga semua alamat `/api/...` dibalas 404. Versi ini menambahkan `api/index.js` dan `vercel.json` agar Vercel menjalankan server sebagai Function. SQLite juga tidak bisa dipakai di Vercel karena disk Function tidak menyimpan data secara permanen, jadi data dipindahkan ke PostgreSQL.

## Memasang di Vercel dengan Supabase

1. **Buat database.** Buat proyek baru di https://supabase.com. Catat kata sandi database yang Anda buat.
2. **Ambil connection string.** Di dasbor Supabase, klik **Connect**, lalu pilih **Transaction pooler** (port `6543`). Mode ini disarankan Supabase untuk fungsi serverless. Ganti `[YOUR-PASSWORD]` dengan kata sandi database. Rujukan: https://supabase.com/docs/guides/database/connecting-to-postgres
3. **Isi Environment Variables di Vercel.** Buka proyek di Vercel, lalu **Settings > Environment Variables**:

   | Nama | Isi |
   |---|---|
   | `DATABASE_URL` | connection string dari langkah 2 |
   | `KODE_AKSES_GURU` | kode rahasia pendaftaran guru, minimal 8 karakter. Jangan dibagikan ke siswa. |
   | `DATABASE_CA_CERT` (tidak wajib) | isi sertifikat CA Supabase, agar sertifikat server diverifikasi |

4. **Deploy ulang.** Perubahan Environment Variables baru berlaku pada deployment berikutnya: buka **Deployments**, lalu pilih **Redeploy** pada deployment terbaru, atau push commit baru.
5. **Daftarkan guru pertama.** Buka website, klik **Masuk sebagai Guru > Daftar pakai kode akses guru**, lalu isi kode dari `KODE_AKSES_GURU`. Tabel database dibuat otomatis saat permintaan pertama.
6. **Buat kelas.** Di Dasbor Guru, buat kelas, lalu bagikan **kode kelas** kepada siswa. Siswa mendaftar sendiri dengan kode itu. Semua guru melihat kelas yang sama. Kelas bisa dihapus lewat tombol **Hapus kelas** dengan mengetik ulang nama kelasnya; akun siswa di kelas itu ikut terhapus.
7. **Guru berikutnya** sebaiknya memakai **kode undangan** (Dasbor Guru > Undang guru lain). Setelah semua guru terdaftar, `KODE_AKSES_GURU` boleh dihapus atau diganti di Vercel.

Jika `DATABASE_URL` belum diisi, website menampilkan pesan "Server belum terhubung ke database", bukan halaman kosong.

Tentang SSL: tanpa `DATABASE_CA_CERT`, koneksi ke Supabase tetap terenkripsi, tetapi sertifikat server tidak diverifikasi. Mengisi `DATABASE_CA_CERT` menutup celah itu. Letak tombol unduh sertifikat di dasbor Supabase belum saya pastikan; cek pengaturan Database atau SSL di proyek Anda.

## Keamanan akun guru

- Tidak ada pendaftaran guru terbuka. Akun guru hanya bisa dibuat dengan:
  - **kode akses guru** dari `KODE_AKSES_GURU` di server, atau
  - **kode undangan sekali pakai** yang dibuat guru terdaftar (berlaku 7 hari, bisa dibatalkan), atau
  - perintah `npm run buat-guru` oleh pengelola yang memegang `DATABASE_URL`.
- Kode diperiksa di server. Kode akses tidak ada di kode frontend. Kode undangan hanya disimpan sebagai hash.
- 5 kode salah dalam 15 menit dari alamat IP yang sama membuat percobaan berikutnya ditahan, walaupun kodenya benar. Login dibatasi 10 kegagalan per 15 menit per IP dan email. Catatan percobaan disimpan di database, jadi tetap berlaku di semua instance Vercel.
- Setelah kode valid, guru tetap masuk dengan email dan kata sandi (hash scrypt).
- Peran pengguna dibaca dari database pada setiap permintaan. Tombol "Masuk sebagai Guru" tidak memberi hak apa pun.
- Siswa yang membuka alamat guru diarahkan kembali ke LKPD. Semua endpoint guru membalas 403 untuk akun siswa.
- **Semua akun guru melihat kelas dan siswa yang sama.** Kelas yang dibuat satu guru langsung terlihat, bisa dinilai, dan bisa dihapus oleh guru lain. Siswa tetap tidak bisa membuka data guru.
- Sesi berupa token acak di cookie `HttpOnly`, `SameSite=Lax`, dan `Secure` di Vercel. Sesi berlaku 7 hari dan bisa diakhiri dengan Keluar atau "Keluar dari semua perangkat".
- **Row Level Security (RLS)** aktif di semua tabel PostgreSQL tanpa kebijakan apa pun, dan hak peran `anon` serta `authenticated` dicabut. Akibatnya API publik Supabase (misalnya dengan anon key) tidak bisa membaca atau menulis data. Semua akses lewat server. Website ini **tidak memakai Supabase Auth**: autentikasi dibuat di server sendiri, dan Supabase dipakai sebagai database PostgreSQL saja.

## Isi LKPD

| Bagian | Isi | Penilaian |
|---|---|---|
| 1. Kenalan dulu | Identitas dari akun, nomor absen, tujuan, petunjuk | Tidak dinilai |
| 2. Pemanasan | 2 pertanyaan pemantik (wajib sebelum aktivitas) | Umpan balik guru saja |
| 3. Aktivitas 1: Mengamati | Bangun A, B, C, D pada kotak 1 cm; 3 pertanyaan | 2 otomatis, 1 dinilai guru |
| 4. Aktivitas 2: Menanya | 1 pertanyaan buatan siswa | Dinilai guru |
| 5. Aktivitas 3: Mencoba | Simulasi A dan B, misi bertahap, 1 catatan per simulasi; 3 pertanyaan pilihan/isian | Otomatis |
| 6. Latihan | 4 soal: kongruen, sebangun, benar/salah, memperbesar foto | Otomatis untuk jawaban pasti, alasan dinilai guru |
| 7. Aktivitas 4: Menalar | 3 kalimat yang dilengkapi siswa | Dinilai guru dengan rubrik |
| 8. Aktivitas 5: Refleksi | 2 pertanyaan | Umpan balik guru saja |
| 9. Ringkasan | Status tiap bagian, Kumpulkan LKPD, unduh PDF | |

Totalnya 29 isian wajib: 13 pilihan atau isian angka (diperiksa otomatis) dan 12 uraian singkat. Di bagian atas setiap halaman tertulis posisinya, misalnya "Bagian 5 dari 9 · Aktivitas 3 dari 5".

Ukuran bangun Aktivitas 1: A segitiga siku-siku 3, 4, 5 cm; B segitiga sama kaki dengan alas 4 cm dan tinggi 3 cm; C adalah A diperbesar 1,5 kali; D kongruen dengan A. Keempatnya berwarna sama agar warna tidak membocorkan jawaban.

Simulasi menghitung panjang sisi dan sudut dari koordinat setelah digeser, diputar, atau dicerminkan. Animasi hanya untuk gambar; tabel ukuran selalu memakai keadaan akhir. Di layar di bawah 560 px, bidang simulasi disusun tegak agar label tetap terbaca.

## Aturan pengisian dan pemeriksaan

- Uraian dianggap terisi jika memuat minimal 3 huruf atau angka. Spasi atau tanda baca saja tidak dihitung.
- Server memeriksa ulang semua kolom wajib saat pengumpulan dan mengembalikan daftar yang belum diisi.
- Jawaban tersimpan otomatis 1 detik setelah berhenti mengetik. Saat internet putus, perubahan disimpan di perangkat dan dikirim ulang otomatis.
- Pengumpulan butuh konfirmasi dan tidak bisa terjadi dua kali. Setelah dikumpulkan, jawaban terkunci.
- Guru bisa membuka kembali LKPD dengan alasan yang tercatat.
- Kunci dan pembahasan hanya ada di `server/keys.js`. Guru memilih per kelas kapan siswa bisa melihatnya: sebelum mengumpulkan (aktivitas lalu terkunci), setelah mengumpulkan, atau setelah seluruh kelas mengumpulkan.
- Bentuk setara diterima: `1 : 2`, `3:6`, `1/2`, `0,5`, `1 banding 2`; `6 cm`, `12/2`; `60°`.

## Menjalankan di komputer sendiri

Kebutuhan: Node.js 22.

```bash
npm install
```

```bash
KODE_AKSES_GURU=kode-rahasia-anda npm start
```

Buka `http://localhost:3000`. Akun guru juga bisa dibuat lewat terminal:

```bash
npm run buat-guru -- --email guru@sekolah.sch.id --nama "Nama Guru" --kelas "VIII A"
```

Untuk memakai database Supabase dari komputer sendiri, isi `DATABASE_URL` sebelum perintah di atas.

## Pengujian

```bash
npm test
```

```bash
npm run test:pg
```

`npm test` menjalankan 25 uji dengan SQLite. `npm run test:pg` menjalankan 25 uji yang sama dengan PostgreSQL (butuh server Postgres lokal; atur `TEST_DATABASE_URL`). Yang diuji antara lain:

- pendaftaran guru tanpa kode, dengan kode salah, kode benar, undangan dipakai ulang, dan undangan dibatalkan;
- batas 5 kode salah;
- siswa memanggil endpoint guru (403), dan guru kedua melihat kelas serta siswa guru pertama;
- hapus kelas: nama konfirmasi salah ditolak, siswa tidak bisa menghapus, akun siswa di kelas ikut terhapus;
- kolom berisi spasi dan pengumpulan yang belum lengkap;
- pengumpulan ganda yang dikirim bersamaan;
- ketiga mode pembahasan, penilaian, pembukaan kembali, PDF, CSV, dan keluar dari semua perangkat.

Uji di browser (Playwright dan Chromium), terhadap server yang sedang berjalan dengan `KODE_AKSES_GURU` yang sama:

```bash
KODE_AKSES_GURU=kode-rahasia-anda node test/ui-flow.js http://localhost:3000 folder-hasil
```

## Desain

Arah visual dari pemilik: ceria, lembut, bergaya stiker, untuk siswa kelas VIII.

- Palet: cream `#FFF8EF`, peach `#F6C6AD`, coral `#E98B73`, butter `#F5DF91`, dusty pink `#E8B7C5`, lilac `#C9BCE5`, cokelat `#493B37`, putih.
- Setiap aktivitas punya aksen sendiri: Mengamati peach, Menanya pink, Mencoba butter, Menalar lilac, Refleksi cream dengan hiasan.
- Kontras dihitung dengan rumus WCAG. Teks putih di atas coral hanya 2,5 : 1 dan `#493B37` di atas coral 4,3 : 1, keduanya gagal untuk teks biasa. Karena itu teks tombol coral memakai cokelat lebih gelap `#2E2422` (6,0 : 1), dan teks aksen memakai coral tua `#A4503B` (5,3 : 1 di atas cream).
- Huruf: Nunito (SIL Open Font License) untuk judul dan isi. PDF memakai DejaVu Sans karena memuat simbol °, ∠, dan ≅.
- Ilustrasi dan ikon digambar sendiri dalam satu gaya (`public/js/art.js`): garis cokelat berujung bulat, isian pastel solid, tepi putih seperti stiker. Tidak ada gambar dari luar.
- Kotak 1 cm dan penggaris pada simulasi adalah alat ukur, bukan hiasan.

## Yang belum tersedia

- Website versi ini belum saya deploy sendiri ke Vercel (saya tidak punya akses ke akun Vercel atau Supabase Anda). Function, rewrite, dan PostgreSQL sudah diuji di lingkungan lokal yang meniru alur itu.
- Belum ada reset kata sandi lewat email. Guru mengatur ulang kata sandi siswa dari dasbor.
- Satu akun siswa mengerjakan satu LKPD di satu kelas.
- PDF LKPD asli dari kelompok tidak pernah saya terima. Isi mengikuti spesifikasi tertulis.

## Struktur

```
api/index.js        titik masuk Vercel Function
vercel.json         rewrite /api/* ke Function, berkas font ikut dibundel
server/app.js       rute API, hak akses, pengumpulan, pembahasan, penilaian, undangan guru
server/db.js        PostgreSQL (DATABASE_URL) atau SQLite, skema, penguncian RLS
server/auth.js      hash kata sandi, sesi, pembatas percobaan
server/lkpd.js      isi LKPD yang boleh dilihat siswa
server/keys.js      kunci jawaban, pembahasan, rubrik (hanya server)
server/grading.js   validasi isian, pengurai bilangan dan perbandingan, skor
server/pdf.js       PDF dari data tersimpan
server/index.js     menjalankan server di komputer sendiri
scripts/buat-guru.js  membuat akun guru dan kelas dari terminal
public/             halaman, CSS, JavaScript, huruf Nunito
test/               uji API, uji penilaian, uji browser
```

## Rujukan materi

Syarat kekongruenan segitiga (s.s.s, s.sd.s, sd.s.sd) dan kesebangunan (sudut yang berpasangan sama besar, sisi yang berpasangan sebanding) adalah materi baku geometri SMP. Rujukan gratis:

- Kemendikbudristek. *Matematika SMP/MTs Kelas IX* (Buku Siswa, Kurikulum 2021): https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Matematika_BS_KLS_IX.pdf
- Kemendikbudristek. *Buku Panduan Guru Matematika SMP Kelas IX*: https://static.buku.kemdikbud.go.id/content/pdf/bukuteks/kurikulum21/Matematika_BG_KLS_IX_Lc.pdf
- Capaian Pembelajaran Matematika Fase D (SK BSKAP No. 032/H/KR/2024) memuat sifat kekongruenan dan kesebangunan segitiga dan segiempat. Rujukan yang ditemukan berupa dokumen sekunder; cek naskah resmi di laman BSKAP.

Bab pada kedua buku di atas belum diverifikasi halaman per halaman.

## Lisensi pihak ketiga

- Nunito: SIL Open Font License 1.1 (`public/fonts/LICENSE-Nunito.txt`).
- DejaVu Sans: lisensi Bitstream Vera dan domain publik (`server/fonts/LICENSE-DejaVu.txt`).
- Express, PDFKit, node-postgres (`pg`): lisensi MIT.
