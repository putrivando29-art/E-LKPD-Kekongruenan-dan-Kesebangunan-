'use strict';
// Membuat PDF LKPD dari data jawaban yang tersimpan di database (bukan tangkapan layar).
const path = require('node:path');
const PDFDocument = require('pdfkit');
const { META, SECTIONS, sectionItems } = require('./lkpd');
const { KEYS } = require('./keys');
const G = require('./grading');

const FONT = path.join(__dirname, 'fonts', 'DejaVuSans.ttf');
const FONT_BOLD = path.join(__dirname, 'fonts', 'DejaVuSans-Bold.ttf');
const TZ = process.env.ZONA_WAKTU || 'Asia/Jakarta';
const TZ_LABEL = process.env.LABEL_ZONA_WAKTU || 'WIB';

// Warna sama dengan token di public/css/style.css
const C = { ink: '#1E2B2A', muted: '#4D5B59', line: '#C9CFC4', primary: '#1F5C4F', accent: '#B5541C', paper: '#F7F3EA', ok: '#1F6B3A', bad: '#A32C1C' };

function fmtTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('id-ID', { timeZone: TZ, dateStyle: 'long', timeStyle: 'short' }).format(d) + ' ' + TZ_LABEL;
}
const fmtNum = n => (typeof n === 'number' ? n.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '-');

const STATUS = { draft: 'Belum dikumpulkan', submitted: 'Sudah dikumpulkan', reopened: 'Dibuka kembali oleh guru untuk revisi' };
const EVENT = { daftar: 'Mendaftar', kumpul: 'Mengumpulkan', buka_kembali: 'Dibuka kembali', periksa: 'Memeriksa jawaban', nilai_selesai: 'Penilaian selesai', atur_sandi: 'Kata sandi diatur ulang' };

function answerText(item, value) {
  if (value === undefined || value === null || value === '') return '(belum diisi)';
  switch (item.type) {
    case 'confirm': return value ? 'Ya, sudah dibaca.' : '(belum dicentang)';
    case 'single': return item.options.find(o => o.value === value)?.label || String(value);
    case 'multi': return value.map(v => item.options.find(o => o.value === v)?.label || v).join('; ');
    case 'number': return item.unit ? `${value} ${item.unit === '°' ? '' : item.unit}`.trim() : String(value);
    default: return String(value);
  }
}

function buildPdf({ user, cls, sub, progress, totals, showKey, showGrades, teacherCopy, events }) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 56, bottom: 56, left: 56, right: 56 }, bufferPages: true,
    info: { Title: `${META.title} - ${user.name}`, Author: user.name, Subject: `${META.subject} ${META.grade}` } });
  doc.registerFont('R', FONT);
  doc.registerFont('B', FONT_BOLD);
  const W = doc.page.width - 112;
  const left = 56;
  const bottom = () => doc.page.height - 56;
  const ensure = h => { if (doc.y + h > bottom()) doc.addPage(); };

  const para = (text, { font = 'R', size = 10, color = C.ink, gap = 4, indent = 0 } = {}) => {
    doc.font(font).fontSize(size).fillColor(color);
    ensure(doc.heightOfString(text, { width: W - indent }) + gap);
    doc.text(text, left + indent, doc.y, { width: W - indent });
    doc.y += gap;
  };

  const box = (text, { color = C.ink, fill = '#FFFFFF' } = {}) => {
    const pad = 7;
    doc.font('R').fontSize(10);
    const t = String(text);
    const h = doc.heightOfString(t, { width: W - pad * 2 }) + pad * 2;
    const full = bottom() - doc.page.margins.top;
    if (h <= full) {
      ensure(h);
      const top = doc.y;
      doc.save().rect(left, top, W, h).fillAndStroke(fill, C.line).restore();
      doc.fillColor(color).font('R').fontSize(10).text(t, left + pad, top + pad, { width: W - pad * 2 });
      doc.y = top + h + 6;
    } else {
      // Jawaban yang lebih panjang dari satu halaman dicetak mengalir tanpa bingkai.
      doc.fillColor(color).font('R').fontSize(10).text(t, left + pad, doc.y, { width: W - pad * 2 });
      doc.y += 6;
    }
  };

  const heading = (kicker, title) => {
    ensure(60);
    doc.y += 6;
    const top = doc.y;
    doc.save().rect(left, top, W, 28).fill(C.primary).restore();
    doc.font('B').fontSize(12).fillColor('#FFFFFF').text(kicker ? `${kicker}: ${title}` : title, left + 10, top + 7, { width: W - 20 });
    doc.y = top + 36;
  };

  const kv = rows => {
    doc.fontSize(10);
    for (const [k, v] of rows) {
      const h = Math.max(doc.font('R').heightOfString(String(v), { width: W - 150 }), 14);
      ensure(h + 4);
      const y = doc.y;
      doc.font('B').fillColor(C.muted).text(k, left, y, { width: 140 });
      doc.font('R').fillColor(C.ink).text(String(v), left + 150, y, { width: W - 150 });
      doc.y = y + h + 4;
    }
  };

  const table = (head, rows, widths) => {
    const draw = (cells, bold, fill) => {
      doc.font(bold ? 'B' : 'R').fontSize(8.5);
      const h = Math.max(...cells.map((c, i) => doc.heightOfString(String(c), { width: widths[i] - 6 }))) + 6;
      ensure(h);
      const y = doc.y;
      let x = left;
      cells.forEach((c, i) => {
        doc.save().rect(x, y, widths[i], h).fillAndStroke(fill, C.line).restore();
        doc.fillColor(C.ink).font(bold ? 'B' : 'R').fontSize(8.5).text(String(c), x + 3, y + 3, { width: widths[i] - 6 });
        x += widths[i];
      });
      doc.y = y + h;
    };
    draw(head, true, C.paper);
    for (const r of rows) draw(r, false, '#FFFFFF');
    doc.y += 8;
  };

  const simTable = (item, entries) => {
    if (!Array.isArray(entries) || !entries.length) { box('(belum ada catatan percobaan)'); return; }
    if (item.sim === 'congruence') {
      const w = [22, 90, 90, 150, W - 352];
      table(['No', 'Sisi ABC (AB, BC, CA)', 'Sisi DEF (DE, EF, FD)', 'Sudut D, E, F', 'Keadaan DEF'],
        entries.map((e, i) => [i + 1, `${fmtNum(e.ab)}; ${fmtNum(e.bc)}; ${fmtNum(e.ca)} cm`, `${fmtNum(e.de)}; ${fmtNum(e.ef)}; ${fmtNum(e.fd)} cm`,
          `${fmtNum(e.aD)}°; ${fmtNum(e.aE)}°; ${fmtNum(e.aF)}°`,
          [`diputar ${fmtNum(e.rot)}°`, e.mirror ? 'dicerminkan' : null, e.moved ? 'digeser' : null].filter(Boolean).join(', ') + (e.note ? `. Catatan: ${e.note}` : '')]), w);
    } else {
      const w = [22, 70, 90, 90, 110, W - 382];
      table(['No', 'Mode, k', 'Sisi STU (ST, TU, SU)', 'ST:PQ, TU:QR, SU:PR', 'Sudut S, T, U', 'Catatan'],
        entries.map((e, i) => [i + 1, e.mode === 'bebas' ? 'Sisi bebas' : `Skala, k = ${fmtNum(e.k)}`,
          `${fmtNum(e.st)}; ${fmtNum(e.tu)}; ${fmtNum(e.su)} cm`,
          `${fmtNum(e.st / e.pq)}; ${fmtNum(e.tu / e.qr)}; ${fmtNum(e.su / e.pr)}`,
          `${fmtNum(e.aS)}°; ${fmtNum(e.aT)}°; ${fmtNum(e.aU)}°`, e.note || '-']), w);
    }
  };

  // ---------- Halaman judul dan identitas ----------
  doc.save().rect(0, 0, doc.page.width, 8).fill(C.accent).restore();
  doc.font('B').fontSize(18).fillColor(C.primary).text(META.title, left, 56, { width: W });
  doc.font('R').fontSize(11).fillColor(C.muted).text(`${META.subject}, ${META.grade}. Disusun oleh ${META.author}.`, { width: W });
  doc.y += 4;
  if (teacherCopy) para('Salinan guru: memuat kunci, skor otomatis, dan penilaian.', { size: 9, color: C.accent });
  doc.moveTo(left, doc.y + 4).lineTo(left + W, doc.y + 4).strokeColor(C.line).stroke();
  doc.y += 14;

  kv([
    ['Nama', user.name],
    ['Email', user.email],
    ['Kelas', cls ? cls.name : '-'],
    ['Nomor absen', sub.answers.id_absen || '-'],
    ['Status pengumpulan', STATUS[sub.status] + (sub.revision ? ` (revisi ke-${sub.revision})` : '')],
    ['Mulai mengerjakan', fmtTime(sub.started_at)],
    ['Waktu pengumpulan', fmtTime(sub.submitted_at)],
    ['Kelengkapan', `${progress.filled} dari ${progress.total} pertanyaan wajib (${progress.percent}%)`]
  ]);
  if (showKey) kv([['Skor otomatis', `${totals.auto} dari ${totals.autoMax}`]]);
  if (showGrades && sub.grading_status === 'selesai') kv([['Nilai akhir', `${fmtNum(totals.finalScore)} (skor ${fmtNum(totals.total)} dari ${totals.max})`]]);
  else if (showGrades) kv([['Penilaian guru', sub.grading_status === 'proses' ? 'Sedang dinilai' : 'Belum dinilai']]);

  doc.y += 6;
  para('Tujuan pembelajaran', { font: 'B', size: 11, color: C.primary });
  META.goals.forEach((g, i) => para(`${i + 1}. ${g}`, { indent: 8, gap: 2 }));
  doc.y += 6;

  // ---------- Jawaban per bagian ----------
  for (const s of SECTIONS) {
    heading(s.kicker, s.title);
    const groups = s.groups || [{ items: s.items }];
    for (const g of groups) {
      if (g.title) para(g.title, { font: 'B', size: 11, color: C.primary, gap: 2 });
      if (g.given) g.given.forEach(t => para(`• ${t}`, { size: 9, color: C.muted, gap: 1, indent: 6 }));
      if (g.given) doc.y += 4;
      for (const it of g.items) {
        para(it.label + (it.required ? '' : ' (tidak wajib)'), { font: 'B', size: 10, gap: 3 });
        const v = sub.answers[it.id];
        if (it.type === 'simlog') simTable(it, v);
        else box(answerText(it, v));
        if (it.auto && showKey) {
          const c = G.isCorrect(it.id, v);
          para(`${c ? 'Benar' : 'Belum tepat'} (${c ? it.points : 0}/${it.points}). Jawaban yang diharapkan: ${KEYS[it.id].show}. ${KEYS[it.id].explain}`,
            { size: 9, color: c ? C.ok : C.bad, gap: 6 });
        }
        const gr = sub.grades[it.id];
        if (showGrades && gr && (gr.comment || typeof gr.score === 'number')) {
          const sc = typeof gr.score === 'number' ? `Skor guru: ${fmtNum(gr.score)}/${it.points}. ` : '';
          para(`${sc}${gr.comment ? 'Umpan balik guru: ' + gr.comment : ''}`, { size: 9, color: C.accent, gap: 6 });
        }
      }
    }
  }

  if (showGrades && sub.teacher_note) {
    heading(null, 'Catatan Guru');
    box(sub.teacher_note);
  }

  heading(null, 'Riwayat Pengerjaan');
  table(['Waktu', 'Kegiatan', 'Keterangan'], events.filter(e => e.type !== 'periksa' || teacherCopy).map(e => [fmtTime(e.at), EVENT[e.type] || e.type, e.note || '-']), [150, 110, W - 260]);

  // Nomor halaman dan kaki halaman
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 40;
    doc.font('R').fontSize(8).fillColor(C.muted)
      .text(`${META.title}. ${user.name}. Dicetak ${fmtTime(new Date().toISOString())}.`, left, y, { width: W - 60, lineBreak: false })
      .text(`Hal. ${i + 1}/${range.count}`, left + W - 60, y, { width: 60, align: 'right', lineBreak: false });
  }
  return doc;
}

module.exports = { buildPdf };
