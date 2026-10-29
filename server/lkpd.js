'use strict';
// Isi E-LKPD yang boleh dilihat siswa (soal, pilihan, petunjuk).
// Kunci jawaban, pembahasan, dan rubrik TIDAK ada di berkas ini: lihat server/keys.js.
//
// Jenis butir:
//   text    : uraian (kotak tulisan). graded 'teacher' = dinilai guru, 'none' = hanya umpan balik guru.
//   short   : isian singkat satu baris, tidak dinilai.
//   confirm : kotak centang konfirmasi.
//   single  : pilihan tunggal (dinilai otomatis bila auto: true).
//   multi   : pilih beberapa (dinilai otomatis).
//   ratio   : isian perbandingan, misalnya 1 : 2 (dinilai otomatis, bentuk setara diterima).
//   number  : isian bilangan (dinilai otomatis dengan toleransi).
//   simlog  : catatan hasil percobaan simulasi (diisi lewat tombol "Catat Hasil").
// hint = teks contoh di dalam kotak jawaban. Tidak boleh berisi jawaban.

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
const ALASAN = 'Tuliskan alasanmu di sini...';
const LANGKAH = 'Tuliskan langkahmu di sini...';
const JAWAB = 'Tuliskan jawabanmu di sini...';

const META = {
  title: 'E-LKPD Kekongruenan dan Kesebangunan',
  subject: 'Matematika',
  grade: 'Kelas VIII SMP',
  author: 'KELOMPOK 8',
  tagline: 'Cari tahu kapan dua bangun sama persis, dan kapan hanya mirip bentuknya.',
  goals: [
    'Menentukan apakah dua bangun kongruen atau tidak.',
    'Menentukan apakah dua bangun sebangun atau tidak.',
    'Menjelaskan alasan berdasarkan konsep yang benar.'
  ],
  instructions: [
    'Baca soal dengan teliti.',
    'Kerjakan sendiri.',
    'Tulis langkahmu dengan jelas.',
    'Beri alasan kalau soal memintanya.',
    'Pakai konsep yang sudah dipelajari, jangan menebak.',
    'Selesaikan semua aktivitas sebelum mengumpulkan.'
  ],
  usage: [
    'Jawabanmu tersimpan sendiri setiap kamu berhenti mengetik.',
    'Pindah bagian dengan tombol Sebelumnya dan Selanjutnya.',
    'Kalau internet putus, jawaban disimpan dulu di HP atau laptopmu.',
    'Sudah lengkap? Buka Ringkasan, lalu klik Kumpulkan LKPD.'
  ]
};

// Urutan dari awal sampai akhir: Kenalan > Pemanasan > Aktivitas 1-3 > Latihan > Aktivitas 4-5 > Ringkasan.
// Jumlah soal sengaja dibuat sedikit: tiap bagian hanya memuat pertanyaan yang paling penting.
const SECTIONS = [
  {
    id: 'petunjuk',
    nav: 'Petunjuk',
    title: 'Kenalan dulu',
    accent: 'butter',
    icon: 'book',
    intro: 'Cek identitasmu, lalu baca tujuan dan petunjuknya.',
    items: [
      { id: 'id_absen', type: 'short', label: 'Nomor absenmu', hint: 'contoh: 12', required: true, maxLength: 10, graded: 'none' },
      { id: 'id_baca', type: 'confirm', label: 'Aku sudah membaca tujuan dan petunjuk.', required: true, graded: 'none' }
    ]
  },
  {
    id: 'pemantik',
    nav: 'Pemanasan',
    title: 'Pertanyaan Pemantik',
    accent: 'lilac',
    icon: 'spark',
    intro: 'Jawab dengan pendapatmu sendiri. Tidak ada jawaban salah di sini.',
    items: [
      { id: 'p1', type: 'text', label: 'Pernahkah kamu melihat dua benda yang bentuk dan ukurannya sama persis? Sebutkan contohnya.', hint: JAWAB, rows: 2, required: true, graded: 'none' },
      { id: 'p3', type: 'text', label: 'Kalau sebuah gambar diperbesar, apakah bentuknya berubah?', hint: JAWAB, rows: 2, required: true, graded: 'none' }
    ]
  },
  {
    id: 'a1',
    nav: 'Aktivitas 1',
    kicker: 'Aktivitas 1',
    step: 1,
    title: 'Mengamati',
    accent: 'peach',
    icon: 'eye',
    intro: 'Lihat bangun A, B, C, dan D. Satu kotak kecil = 1 cm.',
    figure: 'observe',
    checkable: true,
    items: [
      { id: 'a1_q1', type: 'multi', label: 'Bangun mana yang bentuk dan ukurannya sama persis?', note: 'Boleh pilih lebih dari satu pasang.', options: PAIRS, required: true, auto: true, points: 2 },
      { id: 'a1_q2', type: 'multi', label: 'Bangun mana yang bentuknya sama, tapi ukurannya beda?', note: 'Boleh pilih lebih dari satu pasang.', options: PAIRS, required: true, auto: true, points: 2 },
      { id: 'a1_q3', type: 'text', label: 'Apa beda utama kedua jenis pasangan tadi?', hint: JAWAB, rows: 2, required: true, graded: 'teacher', points: 3 }
    ]
  },
  {
    id: 'a2',
    nav: 'Aktivitas 2',
    kicker: 'Aktivitas 2',
    step: 2,
    title: 'Menanya',
    accent: 'pink',
    icon: 'ask',
    intro: 'Lihat lagi gambarnya. Pertanyaan apa yang muncul di kepalamu tentang kongruen dan sebangun?',
    figure: 'observe',
    guide: [
      'Mulai dengan: apa, kenapa, bagaimana, atau apakah.',
      'Coba bandingkan sesuatu, misalnya panjang sisi atau besar sudut.',
      'Contoh: "Apa yang terjadi pada sudut kalau bangun diperbesar?"'
    ],
    items: [
      { id: 'a2_q1', type: 'text', label: 'Tulis pertanyaanmu (minimal satu).', hint: 'Tuliskan pertanyaanmu di sini...', rows: 3, required: true, graded: 'teacher', points: 3 }
    ]
  },
  {
    id: 'a3',
    nav: 'Aktivitas 3',
    kicker: 'Aktivitas 3',
    step: 3,
    title: 'Mencoba',
    accent: 'butter',
    icon: 'ruler',
    intro: 'Mainkan simulasinya, lalu klik "Catat Hasil" minimal sekali di tiap simulasi.',
    checkable: true,
    groups: [
      {
        id: 'simA',
        title: 'Simulasi A: Kongruen',
        sim: 'congruence',
        steps: [
          'Seret segitiga DEF ke mana saja. Apakah panjang sisinya berubah?',
          'Putar DEF dengan titik bulat di atasnya, lalu klik Cerminkan.',
          'Klik "Bandingkan Bangun". Apakah DEF pas menutupi ABC?',
          'Sekarang ubah panjang salah satu sisi DEF. Apa yang terjadi?'
        ],
        items: [
          { id: 'simA_log', type: 'simlog', sim: 'congruence', label: 'Catatan percobaanmu', required: true, minEntries: 1, graded: 'none' },
          { id: 'a3a_q3', type: 'single', label: 'Kalau satu sisinya diperbesar, apakah kedua segitiga tetap kongruen?', options: YA_TIDAK, required: true, auto: true, points: 1 }
        ]
      },
      {
        id: 'simB',
        title: 'Simulasi B: Sebangun',
        sim: 'similarity',
        steps: [
          'Geser faktor skala k. Perhatikan panjang sisi STU.',
          'Klik "k = 2". Bandingkan dengan STU yang sisinya 6, 8, dan 10 cm.',
          'Lihat sudutnya. Apakah sudut ikut berubah saat k berubah?',
          'Pilih "Ubah sisi sendiri", lalu ubah satu sisi saja. Masih sebangun?'
        ],
        items: [
          { id: 'simB_log', type: 'simlog', sim: 'similarity', label: 'Catatan percobaanmu', required: true, minEntries: 1, graded: 'none' },
          { id: 'a3b_q2', type: 'single', label: 'Kalau semua sisi diperbesar dengan faktor yang sama, apakah bentuk segitiga berubah?', options: [{ value: 'berubah', label: 'Bentuknya berubah' }, { value: 'tetap', label: 'Bentuknya tetap' }], required: true, auto: true, points: 1 },
          { id: 'a3b_q4_pq', type: 'ratio', label: 'PQR bersisi 3, 4, 5 cm dan STU bersisi 6, 8, 10 cm. PQ : ST =', hint: 'misal 2 : 3', required: true, auto: true, points: 1 }
        ]
      }
    ]
  },
  {
    id: 'latihan',
    nav: 'Latihan',
    title: 'Latihan Soal',
    accent: 'coral',
    icon: 'pencil',
    intro: 'Empat soal singkat, dari yang mudah ke yang menantang.',
    checkable: true,
    groups: [
      {
        id: 'soal1',
        title: 'Soal 1: Kongruen',
        figure: 'soal1',
        given: [
          'Segitiga ABC: AB = 5 cm, BC = 7 cm, CA = 8 cm.',
          'Segitiga DEF: DE = 5 cm, EF = 7 cm, FD = 8 cm.',
          'Pasangannya: A dengan D, B dengan E, C dengan F.'
        ],
        items: [
          { id: 's1a', type: 'single', label: 'a. Apakah segitiga ABC dan DEF kongruen?', options: YA_TIDAK, required: true, auto: true, points: 1 },
          { id: 's1c', type: 'single', label: 'b. Syarat kongruen yang kamu pakai:', options: [
            { value: 'sss', label: 'Sisi, sisi, sisi (s.s.s): ketiga pasang sisi sama panjang' },
            { value: 'sas', label: 'Sisi, sudut, sisi (s.sd.s)' },
            { value: 'asa', label: 'Sudut, sisi, sudut (sd.s.sd)' },
            { value: 'aaa', label: 'Sudut, sudut, sudut (sd.sd.sd)' }
          ], required: true, auto: true, points: 1 },
          { id: 's1b', type: 'text', label: 'c. Apa alasanmu?', hint: ALASAN, rows: 2, required: true, graded: 'teacher', points: 2 }
        ]
      },
      {
        id: 'soal2',
        title: 'Soal 2: Sebangun',
        figure: 'soal2',
        given: [
          'Segitiga PQR: PQ = 3 cm, QR = 4 cm, PR = 5 cm.',
          'Segitiga STU: ST = 6 cm, TU = 8 cm, SU = 10 cm.',
          'Pasangannya: P dengan S, Q dengan T, R dengan U.'
        ],
        items: [
          { id: 's2a', type: 'single', label: 'a. Apakah segitiga PQR dan STU sebangun?', options: YA_TIDAK, required: true, auto: true, points: 1 },
          { id: 's2c', type: 'number', label: 'b. Faktor skala dari PQR ke STU, k =', hint: 'tulis angka', required: true, auto: true, points: 1 },
          { id: 's2d', type: 'text', label: 'c. Apa alasanmu, dilihat dari perbandingan sisi?', hint: ALASAN, rows: 2, required: true, graded: 'teacher', points: 2 }
        ]
      },
      {
        id: 'soal3',
        title: 'Soal 3: Benar atau salah?',
        items: [
          { id: 's4_1', type: 'single', label: '1) Dua bangun yang kongruen pasti sebangun.', options: BENAR_SALAH, required: true, auto: true, points: 1 },
          { id: 's4_2', type: 'single', label: '2) Dua bangun yang sebangun pasti kongruen.', options: BENAR_SALAH, required: true, auto: true, points: 1 },
          { id: 's4_5', type: 'single', label: '3) Dua segitiga yang ketiga sudutnya sama besar pasti kongruen.', options: BENAR_SALAH, required: true, auto: true, points: 1 }
        ]
      },
      {
        id: 'soal4',
        title: 'Soal 4: Memperbesar foto',
        given: [
          'Foto berukuran lebar 4 cm dan panjang 6 cm diperbesar. Lebarnya jadi 10 cm.',
          'Foto baru harus sebangun dengan foto lama.'
        ],
        items: [
          { id: 's7', type: 'number', label: 'Panjang foto baru = ... cm', unit: 'cm', hint: 'tulis angka', required: true, auto: true, points: 2 },
          { id: 's7_langkah', type: 'text', label: 'Tulis cara menghitungnya.', hint: LANGKAH, rows: 2, required: true, graded: 'teacher', points: 3 }
        ]
      }
    ]
  },
  {
    id: 'a4',
    nav: 'Aktivitas 4',
    kicker: 'Aktivitas 4',
    step: 4,
    title: 'Menalar',
    accent: 'lilac',
    icon: 'bulb',
    intro: 'Lengkapi kalimat di bawah dengan kata-katamu sendiri.',
    items: [
      { id: 'n1', type: 'text', label: 'Dua bangun disebut kongruen jika ...', hint: JAWAB, rows: 2, required: true, graded: 'teacher', points: 3 },
      { id: 'n2', type: 'text', label: 'Dua bangun disebut sebangun jika ...', hint: JAWAB, rows: 2, required: true, graded: 'teacher', points: 3 },
      { id: 'n3', type: 'text', label: 'Beda utama kongruen dan sebangun adalah ...', hint: JAWAB, rows: 2, required: true, graded: 'teacher', points: 3 }
    ]
  },
  {
    id: 'a5',
    nav: 'Aktivitas 5',
    kicker: 'Aktivitas 5',
    step: 5,
    title: 'Refleksi',
    accent: 'cream',
    icon: 'heart',
    intro: 'Ceritakan pengalaman belajarmu. Tidak ada jawaban benar atau salah.',
    items: [
      { id: 'r1', type: 'text', label: 'Bagian mana yang paling kamu pahami?', hint: 'Ceritakan di sini...', rows: 2, required: true, graded: 'none' },
      { id: 'r2', type: 'text', label: 'Bagian mana yang masih membingungkan?', hint: 'Ceritakan di sini...', rows: 2, required: true, graded: 'none' }
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
