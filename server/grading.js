'use strict';
const { SECTIONS, ITEMS, sectionItems, TEXT_MAX, SHORT_MAX, SIMLOG_MAX } = require('./lkpd');
const { KEYS } = require('./keys');

// ---------- Pengurai bilangan dan perbandingan (menerima bentuk setara) ----------

// "7,5" -> 7.5, "3/6" -> 0.5, "2 cm" -> 2, "60°" -> 60, "x2" -> 2. Mengembalikan null bila tidak terbaca.
function parseNumber(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.toLowerCase().trim();
  s = s.replace(/derajat|cm|°|kali|k\s*=|=/g, ' ');
  s = s.replace(/^[x×]\s*/, '').replace(/\s*[x×]$/, '');
  s = s.replace(/\s+/g, '');
  if (!s) return null;
  // Koma desimal gaya Indonesia. Titik sebagai pemisah ribuan tidak dipakai pada soal ini.
  s = s.replace(',', '.');
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (frac) {
    const b = parseFloat(frac[2]);
    return b === 0 ? null : parseFloat(frac[1]) / b;
  }
  if (/^-?\d+(?:\.\d+)?$/.test(s)) return parseFloat(s);
  return null;
}

// "1 : 2", "3:6", "1 banding 2", "1/2", "0,5" -> 0.5
function parseRatio(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.toLowerCase().replace(/banding|berbanding/g, ':').replace(/cm/g, '').trim();
  const parts = s.split(':');
  if (parts.length === 2) {
    const a = parseNumber(parts[0]);
    const b = parseNumber(parts[1]);
    if (a === null || b === null || b === 0) return null;
    return a / b;
  }
  if (parts.length === 1) return parseNumber(s);
  return null;
}

function close(a, b, tol) {
  return Math.abs(a - b) <= tol;
}

// Mengembalikan true/false, atau null bila jawaban tidak dapat dibaca.
function isCorrect(id, value) {
  const key = KEYS[id];
  if (!key) return null;
  switch (key.kind) {
    case 'choice':
      return value === key.answer;
    case 'set': {
      if (!Array.isArray(value)) return false;
      const a = [...new Set(value)].sort();
      const b = [...key.answer].sort();
      return a.length === b.length && a.every((v, i) => v === b[i]);
    }
    case 'number': {
      const n = parseNumber(value);
      return n === null ? null : close(n, key.answer, key.tol ?? 0.001);
    }
    case 'ratio': {
      const r = parseRatio(value);
      return r === null ? null : close(r, key.answer, 1e-6);
    }
    default:
      return null;
  }
}

// ---------- Validasi isi jawaban ----------

// Jawaban uraian dianggap terisi jika memuat minimal 3 huruf atau angka (spasi dan tanda baca saja tidak dihitung).
function meaningfulText(v) {
  if (typeof v !== 'string') return false;
  const alnum = v.match(/[\p{L}\p{N}]/gu);
  return !!alnum && alnum.length >= 3;
}

function isFilled(item, value) {
  if (value === undefined || value === null) return false;
  switch (item.type) {
    case 'text': return meaningfulText(value);
    case 'short': return typeof value === 'string' && /[\p{L}\p{N}]/u.test(value);
    case 'confirm': return value === true;
    case 'single': return typeof value === 'string' && item.options.some(o => o.value === value);
    case 'multi': return Array.isArray(value) && value.length > 0;
    case 'number': return parseNumber(value) !== null;
    case 'ratio': return parseRatio(value) !== null;
    case 'simlog': return Array.isArray(value) && value.length >= (item.minEntries || 1);
    default: return false;
  }
}

// Pesan untuk kolom yang terisi tetapi belum memenuhi syarat (misalnya isian bilangan tidak terbaca).
function fillHint(item, value) {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return 'belum diisi';
  switch (item.type) {
    case 'text': return 'minimal 3 huruf atau angka';
    case 'number': return 'tuliskan sebuah bilangan, misalnya 7,5';
    case 'ratio': return 'tuliskan perbandingan, misalnya 2 : 3';
    case 'simlog': return `minimal ${item.minEntries} catatan percobaan`;
    default: return 'belum diisi';
  }
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e6;
}

// Membersihkan satu catatan simulasi. Nilai yang tercatat berasal dari browser dan hanya
// dipakai sebagai catatan pengamatan, tidak pernah untuk menghitung nilai.
function cleanSimEntry(sim, e) {
  if (!e || typeof e !== 'object') return null;
  const note = typeof e.note === 'string' ? e.note.slice(0, 300) : '';
  const at = typeof e.at === 'string' ? e.at.slice(0, 40) : new Date().toISOString();
  if (sim === 'congruence') {
    const keys = ['ab', 'bc', 'ca', 'de', 'ef', 'fd', 'aA', 'aB', 'aC', 'aD', 'aE', 'aF', 'rot'];
    const out = { at, note };
    for (const k of keys) { if (!num(e[k])) return null; out[k] = Math.round(e[k] * 100) / 100; }
    out.mirror = e.mirror === true;
    out.moved = e.moved === true;
    return out;
  }
  if (sim === 'similarity') {
    const keys = ['pq', 'qr', 'pr', 'st', 'tu', 'su', 'aP', 'aQ', 'aR', 'aS', 'aT', 'aU'];
    const out = { at, note };
    for (const k of keys) { if (!num(e[k])) return null; out[k] = Math.round(e[k] * 100) / 100; }
    out.mode = e.mode === 'bebas' ? 'bebas' : 'skala';
    out.k = num(e.k) ? Math.round(e.k * 100) / 100 : null;
    return out;
  }
  return null;
}

// Memeriksa satu nilai dari browser. Mengembalikan { ok, value } atau { ok:false, error }.
function sanitize(id, value) {
  const item = ITEMS.get(id);
  if (!item) return { ok: false, error: `Butir ${id} tidak dikenal.` };
  if (value === null) return { ok: true, value: null };
  switch (item.type) {
    case 'text':
      if (typeof value !== 'string') return { ok: false, error: 'Jawaban harus berupa teks.' };
      if (value.length > TEXT_MAX) return { ok: false, error: `Jawaban terlalu panjang (maksimal ${TEXT_MAX} karakter).` };
      return { ok: true, value };
    case 'short':
    case 'number':
    case 'ratio':
      if (typeof value !== 'string') return { ok: false, error: 'Jawaban harus berupa teks.' };
      if (value.length > SHORT_MAX) return { ok: false, error: `Isian terlalu panjang (maksimal ${SHORT_MAX} karakter).` };
      return { ok: true, value };
    case 'confirm':
      return { ok: true, value: value === true };
    case 'single':
      if (typeof value !== 'string' || !item.options.some(o => o.value === value)) return { ok: false, error: 'Pilihan tidak valid.' };
      return { ok: true, value };
    case 'multi':
      if (!Array.isArray(value) || !value.every(v => item.options.some(o => o.value === v))) return { ok: false, error: 'Pilihan tidak valid.' };
      return { ok: true, value: [...new Set(value)] };
    case 'simlog': {
      if (!Array.isArray(value)) return { ok: false, error: 'Catatan simulasi tidak valid.' };
      if (value.length > SIMLOG_MAX) return { ok: false, error: `Maksimal ${SIMLOG_MAX} catatan percobaan.` };
      const clean = value.map(e => cleanSimEntry(item.sim, e));
      if (clean.some(e => e === null)) return { ok: false, error: 'Catatan simulasi tidak valid.' };
      return { ok: true, value: clean };
    }
    default:
      return { ok: false, error: 'Jenis butir tidak dikenal.' };
  }
}

// ---------- Ringkasan kelengkapan dan skor ----------

function sectionProgress(answers) {
  const out = {};
  let filled = 0, total = 0;
  for (const s of SECTIONS) {
    const req = sectionItems(s).filter(i => i.required);
    const missing = req.filter(i => !isFilled(i, answers[i.id]));
    const any = sectionItems(s).some(i => isFilled(i, answers[i.id]));
    out[s.id] = {
      required: req.length,
      filled: req.length - missing.length,
      missing: missing.map(i => ({ id: i.id, label: i.label, hint: fillHint(i, answers[i.id]) })),
      state: missing.length === 0 ? 'lengkap' : any ? 'sebagian' : 'kosong'
    };
    filled += req.length - missing.length;
    total += req.length;
  }
  return { sections: out, filled, total, percent: total ? Math.round((filled / total) * 100) : 0 };
}

function autoItems(sectionId) {
  const list = [];
  for (const s of SECTIONS) {
    if (sectionId && s.id !== sectionId) continue;
    for (const it of sectionItems(s)) if (it.auto) list.push({ ...it, section: s.id });
  }
  return list;
}

function autoScore(answers) {
  let score = 0, max = 0;
  const detail = {};
  for (const it of autoItems()) {
    max += it.points;
    const c = isCorrect(it.id, answers[it.id]);
    detail[it.id] = c === true;
    if (c === true) score += it.points;
  }
  return { score, max, detail };
}

function manualMax() {
  let max = 0;
  for (const it of ITEMS.values()) if (it.graded === 'teacher') max += it.points;
  return max;
}

// Hasil pemeriksaan per butir otomatis pada satu bagian, beserta kunci dan pembahasan.
function sectionFeedback(sectionId, answers, withKey) {
  return autoItems(sectionId).map(it => {
    const c = isCorrect(it.id, answers[it.id]);
    const row = { id: it.id, correct: c === true, unreadable: c === null, points: it.points };
    if (withKey) { row.answer = KEYS[it.id].show; row.explain = KEYS[it.id].explain; }
    return row;
  });
}

module.exports = {
  parseNumber, parseRatio, isCorrect, isFilled, meaningfulText, sanitize,
  sectionProgress, autoScore, manualMax, sectionFeedback, autoItems
};
