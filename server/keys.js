'use strict';
// Kunci jawaban, pembahasan, dan rubrik. Berkas ini hanya dibaca server dan tidak pernah
// dikirim ke browser kecuali lewat endpoint yang sudah memeriksa hak akses (lihat server/index.js).
//
// Bangun pada Aktivitas 1 (petak 1 cm):
//   A: segitiga siku-siku, alas 4 cm, tinggi 3 cm (sisi 3, 4, 5 cm)
//   B: segitiga sama kaki, alas 4 cm, tinggi 3 cm (sisi 4; 3,6; 3,6 cm), bentuknya berbeda dari A
//   C: segitiga siku-siku, alas 6 cm, tinggi 4,5 cm (A diperbesar 1,5 kali)
//   D: segitiga siku-siku, alas 4 cm, tinggi 3 cm (kongruen dengan A)

const KEYS = {
  a1_q1: { kind: 'set', answer: ['A-D'], show: 'A dan D',
    explain: 'Bangun A dan D sama-sama segitiga siku-siku dengan sisi 3 cm, 4 cm, dan 5 cm. Jika D ditumpuk di atas A, keduanya berimpit tepat. Jadi A dan D kongruen.' },
  a1_q2: { kind: 'set', answer: ['A-C', 'C-D'], show: 'A dan C, serta C dan D',
    explain: 'C adalah A yang diperbesar 1,5 kali: 3 × 1,5 = 4,5 cm, 4 × 1,5 = 6 cm, 5 × 1,5 = 7,5 cm. Sudut-sudutnya tetap sama, jadi A dan C sebangun tetapi tidak kongruen. Karena D kongruen dengan A, D juga sebangun dengan C. Bangun B memiliki alas dan tinggi yang sama dengan A, tetapi sudutnya berbeda (tidak ada sudut siku-siku), sehingga B tidak sebangun dengan bangun lain.' },
  a3a_q3: { kind: 'choice', answer: 'tidak', show: 'Tidak',
    explain: 'Jika hanya satu sisi diperbesar, pasangan sisi itu tidak lagi sama panjang dan besar sudutnya ikut berubah. Syarat kongruen (semua sisi dan sudut bersesuaian sama besar) tidak terpenuhi.' },
  a3b_q2: { kind: 'choice', answer: 'tetap', show: 'Bentuknya tetap',
    explain: 'Jika semua sisi dikalikan faktor yang sama, besar setiap sudut tidak berubah. Segitiga hanya berubah ukuran, bentuknya tetap, sehingga kedua segitiga sebangun.' },
  a3b_q4_pq: { kind: 'ratio', answer: 1 / 2, show: '1 : 2', explain: 'PQ : ST = 3 : 6 = 1 : 2.' },
  s1a: { kind: 'choice', answer: 'ya', show: 'Ya',
    explain: 'AB = DE = 5 cm, BC = EF = 7 cm, dan CA = FD = 8 cm. Ketiga pasang sisi yang bersesuaian sama panjang.' },
  s1c: { kind: 'choice', answer: 'sss', show: 'Sisi, sisi, sisi (s.s.s)',
    explain: 'Yang diketahui hanya panjang ketiga sisi, dan ketiga pasang sisi bersesuaian sama panjang. Ini syarat s.s.s. Syarat sd.sd.sd bukan syarat kekongruenan, karena dua segitiga dengan sudut yang sama besar dapat berbeda ukuran.' },
  s2a: { kind: 'choice', answer: 'ya', show: 'Ya',
    explain: 'PQ : ST = 3 : 6, QR : TU = 4 : 8, PR : SU = 5 : 10. Ketiganya sama dengan 1 : 2, jadi kedua segitiga sebangun.' },
  s2c: { kind: 'number', answer: 2, tol: 0.001, show: '2',
    explain: 'Faktor skala dari PQR ke STU adalah ST/PQ = 6/3 = 2. Setiap sisi STU dua kali sisi PQR yang bersesuaian.' },
  s4_1: { kind: 'choice', answer: 'benar', show: 'Benar',
    explain: 'Bangun kongruen memiliki sudut yang sama besar dan perbandingan sisi 1 : 1, jadi memenuhi syarat sebangun dengan faktor skala 1.' },
  s4_2: { kind: 'choice', answer: 'salah', show: 'Salah',
    explain: 'Bangun sebangun boleh berbeda ukuran. Contohnya PQR dan STU pada Soal 2.' },
  s4_5: { kind: 'choice', answer: 'salah', show: 'Salah',
    explain: 'Sudut yang sama besar hanya menjamin sebangun. Ukurannya bisa berbeda, contohnya segitiga 3, 4, 5 cm dan 6, 8, 10 cm.' },
  s7: { kind: 'number', answer: 15, tol: 0.01, show: '15 cm',
    explain: 'Faktor skala = 10 / 4 = 2,5. Panjang baru = 6 × 2,5 = 15 cm. Periksa: 4 : 10 = 6 : 15 = 2 : 5.' }
};

// Rubrik untuk butir yang dinilai guru. Hanya dikirim ke akun guru.
const RUBRICS = {
  a1_q1_alasan: 'Skor 2: menyebut bentuk dan ukuran sama (sisi bersesuaian sama panjang, bisa ditumpuk berimpit). Skor 1: hanya menyebut "mirip" atau "sama" tanpa ukuran. Skor 0: tidak relevan.',
  a1_q2_alasan: 'Skor 2: menyebut bentuk sama karena sudut sama dan sisi diperbesar dengan perbandingan yang sama. Skor 1: hanya menyebut ukuran berbeda. Skor 0: tidak relevan.',
  a1_q3: 'Skor 3: membedakan kongruen (bentuk dan ukuran sama) dan sebangun (bentuk sama, ukuran boleh berbeda, sisi sebanding). Skor 2: perbedaan benar tetapi kurang lengkap. Skor 1: sebagian keliru. Skor 0: tidak menjawab inti.',
  a2_q1: 'Skor 3: pertanyaan relevan, mengarah ke perbandingan sisi atau sudut. Skor 2: relevan tetapi umum. Skor 1: kurang berkaitan dengan materi. Skor 0: bukan pertanyaan.',
  a3a_q1: 'Skor 2: menyimpulkan panjang sisi dan besar sudut tidak berubah, segitiga tetap kongruen. Skor 1: hanya menyebut posisinya berpindah. Skor 0: keliru.',
  a3a_q2: 'Skor 2: membandingkan semua pasangan sisi (dan/atau sudut) yang bersesuaian, atau menumpuk hingga berimpit. Skor 1: alasan sebagian. Skor 0: keliru.',
  a3a_q3_alasan: 'Skor 2: menjelaskan bahwa satu pasang sisi menjadi tidak sama panjang dan sudut berubah. Skor 1: alasan kurang tepat. Skor 0: keliru.',
  a3b_q1: 'Skor 2: setiap sisi menjadi k kali, segitiga membesar, sudut tetap. Skor 1: hanya "membesar". Skor 0: keliru.',
  a3b_q2_alasan: 'Skor 2: sudut bersesuaian tetap sama besar dan perbandingan sisi tetap. Skor 1: alasan sebagian. Skor 0: keliru.',
  a3b_q3: 'Skor 2: sudut bersesuaian sama besar dan perbandingan sisi bersesuaian sama. Skor 1: hanya salah satu syarat. Skor 0: keliru.',
  s1_langkah: 'Skor 3: memasangkan AB-DE, BC-EF, CA-FD dan membandingkan panjangnya. Skor 2: membandingkan tanpa menyebut pasangan. Skor 1: hanya kesimpulan. Skor 0: kosong atau keliru.',
  s1b: 'Skor 2: ketiga pasang sisi bersesuaian sama panjang. Skor 1: alasan kurang lengkap. Skor 0: keliru.',
  s2_langkah: 'Skor 3: menghitung 3/6, 4/8, 5/10 dan menyimpulkan k = 2. Skor 2: perhitungan benar tanpa kesimpulan. Skor 1: sebagian. Skor 0: keliru.',
  s2d: 'Skor 2: ketiga perbandingan sama sehingga sebangun. Skor 1: alasan sebagian. Skor 0: keliru.',
  s3_alasan: 'Skor 2: menghitung 6/9 = 4/6 = 2/3 dan menyebut ukuran berbeda. Skor 1: perhitungan sebagian. Skor 0: keliru.',
  s5_langkah: 'Skor 3: menulis KL/XY = LM/YZ dan menghitung YZ = 6. Skor 2: cara benar dengan salah hitung. Skor 1: sebagian. Skor 0: keliru.',
  s6_langkah: 'Skor 2: menghitung sudut C = 60° lalu memakai sudut bersesuaian C = R. Skor 1: sebagian. Skor 0: keliru.',
  s7_langkah: 'Skor 3: menentukan faktor skala 2,5 dan panjang 15 cm. Skor 2: cara benar dengan salah hitung. Skor 1: sebagian. Skor 0: keliru.',
  n1: 'Skor 3: bentuk dan ukuran sama; sisi bersesuaian sama panjang dan sudut bersesuaian sama besar. Skor 2: benar tetapi kurang lengkap. Skor 1: sebagian keliru. Skor 0: keliru. Terima bentuk kalimat apa pun yang konsepnya tepat.',
  n2: 'Skor 3: sudut bersesuaian sama besar dan perbandingan sisi bersesuaian sama. Skor 2: hanya satu syarat dijelaskan dengan benar. Skor 1: sebagian keliru. Skor 0: keliru.',
  n3: 'Skor 3: kongruen menuntut ukuran sama (k = 1), sebangun hanya bentuk sama (sisi sebanding). Skor 2: benar tetapi kurang lengkap. Skor 1: sebagian keliru. Skor 0: keliru.',
  n4: 'Skor 3: sisi bersesuaian sama panjang dan sudut bersesuaian sama besar. Skor 2: salah satu saja. Skor 1: sebagian keliru. Skor 0: keliru.',
  n5: 'Skor 3: sudut bersesuaian sama besar, sisi bersesuaian sebanding dengan faktor skala yang sama. Skor 2: salah satu saja. Skor 1: sebagian keliru. Skor 0: keliru.'
};

module.exports = { KEYS, RUBRICS };
