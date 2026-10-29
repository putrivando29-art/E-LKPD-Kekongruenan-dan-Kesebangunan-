'use strict';
// Definisi isi E-LKPD yang boleh dilihat siswa (soal, pilihan, petunjuk).
// Kunci jawaban, pembahasan, dan rubrik TIDAK ada di berkas ini: lihat server/keys.js.
//
// Jenis butir:
//   text    : uraian (textarea). graded 'teacher' = dinilai guru, 'none' = hanya umpan balik guru.
//   short   : isian singkat (input satu baris), tidak dinilai.
//   confirm : kotak centang konfirmasi.
//   single  : pilihan tunggal (dinilai otomatis bila auto: true).
//   multi   : pilihan ganda kompleks (dinilai otomatis).
//   ratio   : isian perbandingan, misalnya 1 : 2 (dinilai otomatis, bentuk setara diterima).
//   number  : isian bilangan (dinilai otomatis dengan toleransi).
//   simlog  : catatan hasil percobaan simulasi (diisi lewat tombol "Catat hasil").

const PAIRS = [
  { value: 'A-B', label: 'A dan B' },
  { value: 'A-C', label: 'A dan C' },
  { value: 'A-D', label: 'A dan D' },
  { value: 'B-C', label: 'B dan C' },
  { value: 'B-D', label: 'B dan D' },
  { value: 'C-D', label: 'C dan D' }
];
const YA_TIDAK = [
  { value: 'ya', label: 'Ya' },
  { value: 'tidak', label: 'Tidak' }
];
const BENAR_SALAH = [
  { value: 'benar', label: 'Benar' },
  { value: 'salah', label: 'Salah' }
];

const META = {
  title: 'E-LKPD Kekongruenan dan Kesebangunan',
  subject: 'Matematika',
  grade: 'Kelas VIII SMP',
  author: 'Kelompok 8 PKD',
  goals: [
    'Menentukan apakah dua bangun kongruen atau tidak.',
    'Menentukan apakah dua bangun sebangun atau tidak.',
    'Menjelaskan alasan berdasarkan konsep yang benar.'
  ],
  instructions: [
    'Bacalah setiap soal dengan teliti.',
    'Kerjakan secara mandiri.',
    'Tuliskan jawaban dengan langkah yang jelas.',
    'Sertakan alasan atau penjelasan pada pertanyaan yang memerlukannya.',
    'Gunakan konsep yang telah dipelajari, bukan sekadar menebak.',
    'Selesaikan seluruh aktivitas sebelum mengumpulkan LKPD.'
  ],
  usage: [
    'Masuk dengan akun siswa. Jawabanmu tersimpan otomatis di server setiap kali kamu berhenti mengetik.',
    'Kerjakan bagian secara berurutan memakai tombol Sebelumnya dan Selanjutnya, atau pilih bagian di daftar isi.',
    'Tanda di daftar isi menunjukkan bagian yang belum diisi, sebagian, lengkap, atau sudah diperiksa.',
    'Tombol Periksa Jawaban baru aktif setelah semua pertanyaan wajib di aktivitas itu terisi, dan mengikuti aturan yang dipilih gurumu.',
    'Jika koneksi terputus, jawaban disimpan sementara di perangkat ini dan dikirim ulang saat koneksi kembali.',
    'Setelah semua bagian wajib lengkap, buka Ringkasan lalu klik Kumpulkan LKPD. Setelah dikumpulkan, kamu dapat mengunduh LKPD dalam bentuk PDF.'
  ]
};

const SECTIONS = [
  {
    id: 'petunjuk',
    nav: 'Petunjuk',
    title: 'Identitas, Tujuan, dan Petunjuk',
    intro: 'Periksa identitasmu, baca tujuan pembelajaran dan petunjuk pengerjaan, lalu lengkapi isian di bawah.',
    items: [
      { id: 'id_absen', type: 'short', label: 'Nomor absen', required: true, maxLength: 10, graded: 'none' },
      { id: 'id_baca', type: 'confirm', label: 'Saya sudah membaca tujuan pembelajaran dan petunjuk pengerjaan.', required: true, graded: 'none' }
    ]
  },
  {
    id: 'pemantik',
    nav: 'Pemantik',
    title: 'Pertanyaan Pemantik',
    intro: 'Jawablah menurut pengalaman dan pendapatmu sendiri. Tidak ada jawaban benar atau salah pada bagian ini. Gurumu akan membaca jawabanmu.',
    items: [
      { id: 'p1', type: 'text', label: 'Pernahkah kamu melihat dua benda yang bentuk dan ukurannya sama persis? Sebutkan contohnya.', required: true, graded: 'none' },
      { id: 'p2', type: 'text', label: 'Apakah dua benda yang bentuknya sama tetapi ukurannya berbeda dapat dikatakan sama? Mengapa?', required: true, graded: 'none' },
      { id: 'p3', type: 'text', label: 'Jika sebuah gambar diperbesar, apakah bentuknya akan berubah?', required: true, graded: 'none' },
      { id: 'p4', type: 'text', label: 'Menurutmu, apa perbedaan antara bangun yang memiliki bentuk dan ukuran sama dengan bangun yang hanya memiliki bentuk sama?', required: true, graded: 'none' }
    ]
  },
  {
    id: 'a1',
    nav: 'Aktivitas 1',
    kicker: 'Aktivitas 1',
    title: 'Mengamati',
    intro: 'Amati bangun A, B, C, dan D. Semua bangun digambar pada petak berukuran 1 cm × 1 cm dengan skala yang sama. Gunakan alat bantu untuk memperbesar tampilan, menampilkan ukuran, serta memutar dan menumpuk dua bangun.',
    figure: 'observe',
    checkable: true,
    items: [
      { id: 'a1_q1', type: 'multi', label: '1. Pasangan bangun mana yang memiliki bentuk dan ukuran yang sama persis? Pilih semua pasangan yang tepat.', options: PAIRS, required: true, auto: true, points: 2 },
      { id: 'a1_q1_alasan', type: 'text', label: 'Alasan jawaban nomor 1', required: true, graded: 'teacher', points: 2 },
      { id: 'a1_q2', type: 'multi', label: '2. Pasangan bangun mana yang memiliki bentuk sama tetapi ukuran berbeda? Pilih semua pasangan yang tepat.', options: PAIRS, required: true, auto: true, points: 2 },
      { id: 'a1_q2_alasan', type: 'text', label: 'Alasan jawaban nomor 2', required: true, graded: 'teacher', points: 2 },
      { id: 'a1_q3', type: 'text', label: '3. Apa perbedaan utama kedua jenis pasangan bangun tersebut?', required: true, graded: 'teacher', points: 3 }
    ]
  },
  {
    id: 'a2',
    nav: 'Aktivitas 2',
    kicker: 'Aktivitas 2',
    title: 'Menanya',
    intro: 'Berdasarkan gambar dan hasil pengamatanmu, tuliskan pertanyaan yang menurutmu penting untuk memahami perbedaan bangun kongruen dan sebangun.',
    figure: 'observe',
    guide: [
      'Mulailah dengan kata tanya: apa, mengapa, bagaimana, atau apakah.',
      'Pertanyaan yang baik membandingkan sesuatu, misalnya panjang sisi atau besar sudut dua bangun.',
      'Contoh awal: "Apa yang terjadi pada besar sudut jika sebuah bangun diperbesar?"'
    ],
    items: [
      { id: 'a2_q1', type: 'text', label: 'Pertanyaanku (tulis minimal satu pertanyaan, boleh lebih)', rows: 6, required: true, graded: 'teacher', points: 3 },
      { id: 'a2_q2', type: 'text', label: 'Dugaan jawabanku untuk pertanyaan di atas', rows: 4, required: false, graded: 'none' }
    ]
  },
  {
    id: 'a3',
    nav: 'Aktivitas 3',
    kicker: 'Aktivitas 3',
    title: 'Mencoba dengan Simulasi',
    intro: 'Lakukan percobaan pada dua simulasi berikut. Setiap kali kamu mencoba keadaan baru, klik "Catat hasil" agar ukurannya tersimpan sebagai catatan percobaan. Setiap simulasi membutuhkan minimal 2 catatan.',
    checkable: true,
    groups: [
      {
        id: 'simA',
        title: 'Simulasi A: Kekongruenan',
        sim: 'congruence',
        steps: [
          'Seret segitiga DEF untuk menggeser posisinya. Seret titik bulat di atasnya untuk memutar.',
          'Gunakan tombol Cerminkan untuk membalik segitiga DEF.',
          'Ubah panjang sisi DEF dengan penggeser untuk mencoba keadaan yang berbeda.',
          'Klik "Impitkan ke ABC" untuk menumpuk DEF tepat di atas ABC dengan A ke D dan B ke E.'
        ],
        items: [
          { id: 'simA_log', type: 'simlog', sim: 'congruence', label: 'Catatan percobaan Simulasi A', required: true, minEntries: 2, graded: 'none' },
          { id: 'a3a_q1', type: 'text', label: '1. Apa yang terjadi ketika posisi segitiga diubah tanpa mengubah panjang sisinya?', required: true, graded: 'teacher', points: 2 },
          { id: 'a3a_q2', type: 'text', label: '2. Bagaimana kamu menentukan bahwa kedua segitiga kongruen?', required: true, graded: 'teacher', points: 2 },
          { id: 'a3a_q3', type: 'single', label: '3. Apakah dua segitiga tetap kongruen jika salah satu sisinya diperbesar?', options: YA_TIDAK, required: true, auto: true, points: 1 },
          { id: 'a3a_q3_alasan', type: 'text', label: 'Jelaskan alasanmu untuk nomor 3.', required: true, graded: 'teacher', points: 2 }
        ]
      },
      {
        id: 'simB',
        title: 'Simulasi B: Kesebangunan',
        sim: 'similarity',
        steps: [
          'Segitiga PQR bersisi PQ = 3 cm, QR = 4 cm, dan PR = 5 cm. Segitiga STU berpasangan dengan P ke S, Q ke T, dan R ke U.',
          'Mode "Faktor skala": geser faktor skala k. Semua sisi STU dikalikan k.',
          'Mode "Ubah sisi satu per satu": ubah panjang ST, TU, dan SU sendiri-sendiri, lalu amati sudut dan perbandingannya.',
          'Atur faktor skala menjadi 2, lalu bandingkan dengan segitiga STU bersisi 6 cm, 8 cm, dan 10 cm.'
        ],
        items: [
          { id: 'simB_log', type: 'simlog', sim: 'similarity', label: 'Catatan percobaan Simulasi B', required: true, minEntries: 2, graded: 'none' },
          { id: 'a3b_q1', type: 'text', label: '1. Apa yang terjadi pada ukuran segitiga ketika faktor skala diperbesar?', required: true, graded: 'teacher', points: 2 },
          { id: 'a3b_q2', type: 'single', label: '2. Apakah bentuk segitiga berubah jika semua sisi diperbesar dengan faktor yang sama?', options: [{ value: 'berubah', label: 'Bentuknya berubah' }, { value: 'tetap', label: 'Bentuknya tetap' }], required: true, auto: true, points: 1 },
          { id: 'a3b_q2_alasan', type: 'text', label: 'Jelaskan alasanmu untuk nomor 2.', required: true, graded: 'teacher', points: 2 },
          { id: 'a3b_q3', type: 'text', label: '3. Bagaimana cara menentukan apakah dua bangun sebangun?', required: true, graded: 'teacher', points: 2 },
          { id: 'a3b_q4_pq', type: 'ratio', label: '4. Tentukan perbandingan sisi-sisi yang bersesuaian pada segitiga PQR (3, 4, 5 cm) dan STU (6, 8, 10 cm). PQ : ST =', placeholder: 'contoh: 2 : 3', required: true, auto: true, points: 1 },
          { id: 'a3b_q4_qr', type: 'ratio', label: 'QR : TU =', placeholder: 'contoh: 2 : 3', required: true, auto: true, points: 1 },
          { id: 'a3b_q4_pr', type: 'ratio', label: 'PR : SU =', placeholder: 'contoh: 2 : 3', required: true, auto: true, points: 1 }
        ]
      }
    ]
  },
  {
    id: 'latihan',
    nav: 'Latihan',
    title: 'Latihan Penerapan Konsep',
    intro: 'Kerjakan soal secara berurutan. Soal disusun dari mengenali hubungan bangun sampai menerapkan konsep. Tuliskan langkah pengerjaan dan alasanmu.',
    checkable: true,
    groups: [
      {
        id: 'soal1',
        title: 'Soal 1: Kekongruenan',
        figure: 'soal1',
        given: [
          'Segitiga ABC: AB = 5 cm, BC = 7 cm, CA = 8 cm.',
          'Segitiga DEF: DE = 5 cm, EF = 7 cm, FD = 8 cm.',
          'Pasangan titik yang bersesuaian: A dengan D, B dengan E, C dengan F. Tanda garis yang sama pada gambar menunjukkan sisi yang sama panjang.'
        ],
        items: [
          { id: 's1a', type: 'single', label: 'a. Apakah segitiga ABC dan segitiga DEF kongruen?', options: YA_TIDAK, required: true, auto: true, points: 1 },
          { id: 's1_langkah', type: 'text', label: 'Langkah pengerjaan: tuliskan pasangan sisi yang bersesuaian dan bandingkan panjangnya.', required: true, graded: 'teacher', points: 3 },
          { id: 's1b', type: 'text', label: 'b. Jelaskan alasanmu.', required: true, graded: 'teacher', points: 2 },
          { id: 's1c', type: 'single', label: 'c. Syarat kekongruenan yang kamu gunakan adalah ...', options: [
            { value: 'sss', label: 'Sisi, sisi, sisi (s.s.s): ketiga pasang sisi bersesuaian sama panjang' },
            { value: 'sas', label: 'Sisi, sudut, sisi (s.sd.s)' },
            { value: 'asa', label: 'Sudut, sisi, sudut (sd.s.sd)' },
            { value: 'aaa', label: 'Sudut, sudut, sudut (sd.sd.sd)' }
          ], required: true, auto: true, points: 1 }
        ]
      },
      {
        id: 'soal2',
        title: 'Soal 2: Kesebangunan',
        figure: 'soal2',
        given: [
          'Segitiga PQR: PQ = 3 cm, QR = 4 cm, PR = 5 cm.',
          'Segitiga STU: ST = 6 cm, TU = 8 cm, SU = 10 cm.',
          'Pasangan titik yang bersesuaian: P dengan S, Q dengan T, R dengan U.'
        ],
        items: [
          { id: 's2a', type: 'single', label: 'a. Apakah segitiga PQR dan segitiga STU sebangun?', options: YA_TIDAK, required: true, auto: true, points: 1 },
          { id: 's2b_pq', type: 'ratio', label: 'b. Perbandingan sisi yang bersesuaian. PQ : ST =', placeholder: 'contoh: 2 : 3', required: true, auto: true, points: 1 },
          { id: 's2b_qr', type: 'ratio', label: 'QR : TU =', placeholder: 'contoh: 2 : 3', required: true, auto: true, points: 1 },
          { id: 's2b_pr', type: 'ratio', label: 'PR : SU =', placeholder: 'contoh: 2 : 3', required: true, auto: true, points: 1 },
          { id: 's2c', type: 'number', label: 'c. Faktor skala dari segitiga PQR ke segitiga STU adalah k =', placeholder: 'tulis bilangan', required: true, auto: true, points: 1 },
          { id: 's2_langkah', type: 'text', label: 'Langkah pengerjaan untuk b dan c.', required: true, graded: 'teacher', points: 3 },
          { id: 's2d', type: 'text', label: 'd. Jelaskan alasanmu berdasarkan perbandingan sisi.', required: true, graded: 'teacher', points: 2 }
        ]
      },
      {
        id: 'soal3',
        title: 'Soal 3: Mengenali hubungan dua bangun',
        figure: 'soal3',
        given: [
          'Persegi panjang KLMN berukuran 6 cm × 4 cm.',
          'Persegi panjang WXYZ berukuran 9 cm × 6 cm.'
        ],
        items: [
          { id: 's3', type: 'single', label: 'Pernyataan yang benar tentang kedua persegi panjang adalah ...', options: [
            { value: 'kongruen', label: 'Kongruen' },
            { value: 'sebangun', label: 'Sebangun, tetapi tidak kongruen' },
            { value: 'tidak', label: 'Tidak sebangun dan tidak kongruen' }
          ], required: true, auto: true, points: 2 },
          { id: 's3_alasan', type: 'text', label: 'Tuliskan perhitungan atau alasanmu.', required: true, graded: 'teacher', points: 2 }
        ]
      },
      {
        id: 'soal4',
        title: 'Soal 4: Benar atau salah',
        intro: 'Tentukan apakah setiap pernyataan berikut benar atau salah.',
        items: [
          { id: 's4_1', type: 'single', label: '1) Dua bangun yang kongruen pasti sebangun.', options: BENAR_SALAH, required: true, auto: true, points: 1 },
          { id: 's4_2', type: 'single', label: '2) Dua bangun yang sebangun pasti kongruen.', options: BENAR_SALAH, required: true, auto: true, points: 1 },
          { id: 's4_3', type: 'single', label: '3) Setiap dua persegi pasti sebangun.', options: BENAR_SALAH, required: true, auto: true, points: 1 },
          { id: 's4_4', type: 'single', label: '4) Setiap dua persegi panjang pasti sebangun.', options: BENAR_SALAH, required: true, auto: true, points: 1 },
          { id: 's4_5', type: 'single', label: '5) Dua segitiga yang ketiga pasang sudutnya sama besar pasti kongruen.', options: BENAR_SALAH, required: true, auto: true, points: 1 }
        ]
      },
      {
        id: 'soal5',
        title: 'Soal 5: Menentukan panjang sisi',
        given: [
          'Segitiga KLM sebangun dengan segitiga XYZ, dengan K bersesuaian dengan X, L dengan Y, dan M dengan Z.',
          'KL = 6 cm, LM = 9 cm, dan XY = 4 cm.'
        ],
        items: [
          { id: 's5', type: 'number', label: 'Panjang YZ = ... cm', unit: 'cm', placeholder: 'tulis bilangan', required: true, auto: true, points: 2 },
          { id: 's5_langkah', type: 'text', label: 'Langkah pengerjaan.', required: true, graded: 'teacher', points: 3 }
        ]
      },
      {
        id: 'soal6',
        title: 'Soal 6: Menentukan besar sudut',
        given: [
          'Segitiga ABC kongruen dengan segitiga PQR, dengan A bersesuaian dengan P, B dengan Q, dan C dengan R.',
          'Besar sudut A = 50° dan besar sudut B = 70°.'
        ],
        items: [
          { id: 's6', type: 'number', label: 'Besar sudut R = ... °', unit: '°', placeholder: 'tulis bilangan', required: true, auto: true, points: 2 },
          { id: 's6_langkah', type: 'text', label: 'Langkah pengerjaan.', required: true, graded: 'teacher', points: 2 }
        ]
      },
      {
        id: 'soal7',
        title: 'Soal 7: Masalah sehari-hari',
        given: [
          'Sebuah foto berukuran lebar 4 cm dan panjang 6 cm diperbesar sehingga lebarnya menjadi 10 cm.',
          'Foto hasil pembesaran harus sebangun dengan foto asli.'
        ],
        items: [
          { id: 's7', type: 'number', label: 'Panjang foto hasil pembesaran = ... cm', unit: 'cm', placeholder: 'tulis bilangan', required: true, auto: true, points: 2 },
          { id: 's7_langkah', type: 'text', label: 'Langkah pengerjaan.', required: true, graded: 'teacher', points: 3 }
        ]
      }
    ]
  },
  {
    id: 'a4',
    nav: 'Aktivitas 4',
    kicker: 'Aktivitas 4',
    title: 'Menalar',
    intro: 'Gunakan hasil pengamatan, simulasi, dan latihan untuk melengkapi pernyataan berikut dengan kalimatmu sendiri.',
    items: [
      { id: 'n1', type: 'text', label: '1. Dua bangun dikatakan kongruen jika ...', required: true, graded: 'teacher', points: 3 },
      { id: 'n2', type: 'text', label: '2. Dua bangun dikatakan sebangun jika ...', required: true, graded: 'teacher', points: 3 },
      { id: 'n3', type: 'text', label: '3. Perbedaan utama antara kongruen dan sebangun adalah ...', required: true, graded: 'teacher', points: 3 },
      { id: 'n4', type: 'text', label: '4. Bagaimana hubungan panjang sisi dan besar sudut pada bangun yang kongruen?', required: true, graded: 'teacher', points: 3 },
      { id: 'n5', type: 'text', label: '5. Bagaimana hubungan panjang sisi dan besar sudut pada bangun yang sebangun?', required: true, graded: 'teacher', points: 3 }
    ]
  },
  {
    id: 'a5',
    nav: 'Aktivitas 5',
    kicker: 'Aktivitas 5',
    title: 'Refleksi',
    intro: 'Jawaban refleksi bersifat pribadi. Tidak ada jawaban benar atau salah. Gurumu akan membaca dan dapat memberi tanggapan.',
    items: [
      { id: 'r1', type: 'text', label: '1. Bagian mana yang paling kamu pahami?', required: true, graded: 'none' },
      { id: 'r2', type: 'text', label: '2. Bagian mana yang masih membingungkan?', required: true, graded: 'none' },
      { id: 'r3', type: 'text', label: '3. Apakah simulasi membantu kamu memahami perbedaan kongruen dan sebangun? Jelaskan.', required: true, graded: 'none' },
      { id: 'r4', type: 'text', label: '4. Strategi apa yang kamu gunakan untuk menentukan apakah dua bangun kongruen atau sebangun?', required: true, graded: 'none' }
    ]
  }
];

// Daftar butir rata per bagian, dipakai server untuk validasi.
function sectionItems(section) {
  if (section.items) return section.items;
  return section.groups.flatMap(g => g.items);
}
const ITEMS = new Map();
for (const s of SECTIONS) for (const it of sectionItems(s)) ITEMS.set(it.id, { ...it, section: s.id });

const TEXT_MAX = 4000;
const SHORT_MAX = 60;
const SIMLOG_MAX = 12;

module.exports = { META, SECTIONS, ITEMS, sectionItems, TEXT_MAX, SHORT_MAX, SIMLOG_MAX };
