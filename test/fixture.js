'use strict';
// Jawaban lengkap dan benar untuk seluruh butir wajib (dipakai uji).
const { SECTIONS, sectionItems } = require('../server/lkpd');

module.exports = function fullAnswers() {
  const simA = { at: new Date().toISOString(), note: '', ab: 5, bc: 7, ca: 8, de: 5, ef: 7, fd: 8, aA: 60, aB: 81.79, aC: 38.21, aD: 60, aE: 81.79, aF: 38.21, rot: 25, mirror: false, moved: true };
  const simB = { at: new Date().toISOString(), note: 'k = 2', mode: 'skala', k: 2, pq: 3, qr: 4, pr: 5, st: 6, tu: 8, su: 10, aP: 53.13, aQ: 90, aR: 36.87, aS: 53.13, aT: 90, aU: 36.87 };
  const a = {};
  for (const s of SECTIONS) for (const it of sectionItems(s)) {
    if (!it.required) continue;
    if (it.type === 'text') a[it.id] = 'Jawaban uraian siswa untuk ' + it.id;
    if (it.type === 'short') a[it.id] = '12';
    if (it.type === 'confirm') a[it.id] = true;
    if (it.type === 'simlog') a[it.id] = it.sim === 'congruence' ? [simA, simA] : [simB, { ...simB, k: 1.5, st: 4.5, tu: 6, su: 7.5 }];
  }
  Object.assign(a, {
    a1_q1: ['A-D'], a1_q2: ['C-D', 'A-C'], a3a_q3: 'tidak', a3b_q2: 'tetap',
    a3b_q4_pq: '3 : 6', a3b_q4_qr: '1/2', a3b_q4_pr: '0,5',
    s1a: 'ya', s1c: 'sss', s2a: 'ya', s2b_pq: '1:2', s2b_qr: '4 banding 8', s2b_pr: '5:10', s2c: '2',
    s3: 'sebangun', s4_1: 'benar', s4_2: 'salah', s4_3: 'benar', s4_4: 'salah', s4_5: 'salah',
    s5: '6 cm', s6: '60°', s7: '15,0'
  });
  return a;
};
