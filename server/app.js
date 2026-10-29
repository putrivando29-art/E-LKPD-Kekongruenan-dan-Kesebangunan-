'use strict';
const path = require('node:path');
const express = require('express');
const auth = require('./auth');
const G = require('./grading');
const { META, SECTIONS, ITEMS, sectionItems } = require('./lkpd');
const { KEYS, RUBRICS } = require('./keys');
const { buildPdf } = require('./pdf');

const FEEDBACK_MODES = ['sebelum', 'setelah', 'setelah_semua'];
const CHECKABLE = SECTIONS.filter(s => s.checkable).map(s => s.id);
const nowIso = () => new Date().toISOString();

class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

function createApp(db, opts = {}) {
  const secureCookie = !!opts.secureCookie;
  const app = express();
  app.disable('x-powered-by');
  if (opts.trustProxy) app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    res.set('X-Frame-Options', 'DENY');
    next();
  });
  app.use('/api', express.json({ limit: '200kb' }));

  // Permintaan yang mengubah data wajib membawa header khusus. Browser tidak dapat mengirim
  // header ini dari situs lain tanpa izin CORS, sehingga menahan serangan CSRF.
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.get('X-ELKPD') !== '1') return next(new HttpError(403, 'Permintaan ditolak.'));
    req.user = auth.userFromRequest(db, req);
    next();
  });

  const needRole = role => (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'Sesi berakhir. Silakan masuk kembali.'));
    if (req.user.role !== role) return next(new HttpError(403, role === 'guru' ? 'Halaman ini hanya untuk guru.' : 'Halaman ini hanya untuk siswa.'));
    next();
  };

  // ---------- Data bantu ----------

  const getClass = id => (id ? db.get('SELECT * FROM classes WHERE id = ?', id) : null);

  function getSubmission(userId, create) {
    let sub = db.get('SELECT * FROM submissions WHERE user_id = ?', userId);
    if (!sub && create) {
      const t = nowIso();
      db.run('INSERT OR IGNORE INTO submissions (user_id, started_at, updated_at) VALUES (?, ?, ?)', userId, t, t);
      sub = db.get('SELECT * FROM submissions WHERE user_id = ?', userId);
    }
    if (!sub) return null;
    return { ...sub, answers: JSON.parse(sub.answers), checked: JSON.parse(sub.checked), grades: JSON.parse(sub.grades) };
  }

  function logEvent(userId, actorId, type, note = '') {
    db.run('INSERT INTO events (user_id, actor_id, type, note, at) VALUES (?, ?, ?, ?, ?)', userId, actorId, type, note, nowIso());
  }

  function classAllSubmitted(classId) {
    const r = db.get(`SELECT COUNT(*) AS n,
      SUM(CASE WHEN s.status = 'submitted' THEN 1 ELSE 0 END) AS done
      FROM users u LEFT JOIN submissions s ON s.user_id = u.id
      WHERE u.role = 'siswa' AND u.class_id = ?`, classId);
    return r.n > 0 && r.done === r.n;
  }

  // Apakah kunci dan pembahasan bagian ini boleh diberikan kepada siswa sekarang?
  function revealState(sub, cls, sectionId) {
    if (!CHECKABLE.includes(sectionId)) return { allowed: false, reason: 'Bagian ini tidak memiliki kunci jawaban.' };
    const progress = G.sectionProgress(sub.answers).sections[sectionId];
    const mode = cls ? cls.feedback_mode : 'setelah';
    if (sub.checked[sectionId] && (mode === 'sebelum' || sub.status === 'submitted')) return { allowed: true, mode };
    if (progress.missing.length) return { allowed: false, mode, reason: 'Lengkapi semua pertanyaan wajib pada aktivitas ini terlebih dahulu.' };
    if (mode === 'sebelum') return { allowed: true, mode, locks: sub.status !== 'submitted' };
    if (sub.status !== 'submitted') return { allowed: false, mode, reason: 'Gurumu mengatur pembahasan baru dapat dilihat setelah LKPD dikumpulkan.' };
    if (mode === 'setelah_semua' && !classAllSubmitted(cls.id)) return { allowed: false, mode, reason: 'Pembahasan dibuka setelah seluruh siswa di kelasmu mengumpulkan LKPD.' };
    return { allowed: true, mode };
  }

  function lockedSections(sub) {
    return Object.keys(sub.checked);
  }

  function computeTotals(sub) {
    const auto = G.autoScore(sub.answers);
    let manual = 0, manualGraded = 0, manualCount = 0;
    for (const it of ITEMS.values()) {
      if (it.graded !== 'teacher') continue;
      manualCount++;
      const g = sub.grades[it.id];
      if (g && typeof g.score === 'number') { manual += g.score; manualGraded++; }
    }
    const max = auto.max + G.manualMax();
    return {
      auto: auto.score, autoMax: auto.max, autoDetail: auto.detail,
      manual, manualMax: G.manualMax(), manualGraded, manualCount,
      total: auto.score + manual, max,
      finalScore: Math.round(((auto.score + manual) / max) * 1000) / 10
    };
  }

  function publicUser(u, cls) {
    return { id: u.id, name: u.name, email: u.email, role: u.role, className: cls ? cls.name : null, classId: cls ? cls.id : null };
  }

  // ---------- Umum ----------

  app.get('/api/lkpd', (req, res) => res.json({ meta: META, sections: SECTIONS, modes: FEEDBACK_MODES }));

  app.get('/api/me', (req, res) => {
    if (!req.user) return res.json({ user: null });
    const u = db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    res.json({ user: publicUser(u, getClass(u.class_id)) });
  });

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  app.post('/api/auth/register', (req, res) => {
    const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ');
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const code = String(req.body?.classCode || '').trim().toUpperCase();
    const errors = {};
    if (name.length < 3 || name.length > 80 || !/\p{L}/u.test(name)) errors.name = 'Tulis nama lengkap (3 sampai 80 karakter).';
    if (!EMAIL_RE.test(email) || email.length > 120) errors.email = 'Format email tidak valid.';
    if (password.length < 8 || password.length > 100) errors.password = 'Kata sandi minimal 8 karakter.';
    const cls = code ? db.get('SELECT * FROM classes WHERE join_code = ?', code) : null;
    if (!cls) errors.classCode = 'Kode kelas tidak ditemukan. Mintalah kode kelas kepada gurumu.';
    if (Object.keys(errors).length) throw new HttpError(400, 'Periksa kembali isian pendaftaran.', { errors });
    if (db.get('SELECT 1 FROM users WHERE email = ?', email)) throw new HttpError(409, 'Email ini sudah terdaftar. Silakan masuk.', { errors: { email: 'Email sudah terdaftar.' } });
    const id = auth.newId();
    db.run('INSERT INTO users (id, email, name, role, class_id, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, email, name, 'siswa', cls.id, auth.hashPassword(password), nowIso());
    logEvent(id, id, 'daftar', `Mendaftar ke kelas ${cls.name}`);
    const s = auth.createSession(db, id);
    res.set('Set-Cookie', auth.sessionCookie(s.token, s.expires, secureCookie));
    res.status(201).json({ user: publicUser({ id, name, email, role: 'siswa' }, cls) });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const role = req.body?.role;
    const key = `${req.ip}|${email}`;
    if (auth.tooManyAttempts(key)) throw new HttpError(429, 'Terlalu banyak percobaan masuk. Coba lagi 15 menit lagi.');
    const u = db.get('SELECT * FROM users WHERE email = ?', email);
    if (!u || !auth.verifyPassword(password, u.password_hash)) {
      auth.recordFailure(key);
      throw new HttpError(401, 'Email atau kata sandi salah.');
    }
    if (role && role !== u.role) {
      throw new HttpError(403, u.role === 'guru' ? 'Akun ini adalah akun guru. Gunakan tombol Masuk sebagai Guru.' : 'Akun ini adalah akun siswa. Gunakan tombol Masuk sebagai Siswa.');
    }
    auth.clearFailures(key);
    const s = auth.createSession(db, u.id);
    res.set('Set-Cookie', auth.sessionCookie(s.token, s.expires, secureCookie));
    res.json({ user: publicUser(u, getClass(u.class_id)) });
  });

  app.post('/api/auth/logout', (req, res) => {
    if (req.user) auth.destroySession(db, req.user.token);
    res.set('Set-Cookie', auth.clearCookie(secureCookie));
    res.json({ ok: true });
  });

  // ---------- Siswa ----------

  function studentState(user) {
    const sub = getSubmission(user.id, true);
    const cls = getClass(user.classId);
    const progress = G.sectionProgress(sub.answers);
    const reveal = {};
    for (const id of CHECKABLE) {
      const r = revealState(sub, cls, id);
      reveal[id] = { allowed: r.allowed, reason: r.reason || null, locks: !!r.locks, checked: !!sub.checked[id] };
    }
    const published = sub.grading_status === 'selesai';
    const autoVisible = sub.status === 'submitted' && CHECKABLE.every(id => reveal[id].allowed);
    const totals = computeTotals(sub);
    const events = db.all('SELECT type, note, at FROM events WHERE user_id = ? AND type IN (?, ?, ?) ORDER BY id', user.id, 'kumpul', 'buka_kembali', 'nilai_selesai');
    return {
      answers: sub.answers,
      status: sub.status,
      startedAt: sub.started_at,
      updatedAt: sub.updated_at,
      submittedAt: sub.submitted_at,
      locked: lockedSections(sub),
      progress,
      reveal,
      feedbackMode: cls ? cls.feedback_mode : 'setelah',
      score: (published || autoVisible) ? {
        auto: totals.auto, autoMax: totals.autoMax,
        manual: published ? totals.manual : null, manualMax: totals.manualMax,
        final: published ? totals.finalScore : null
      } : null,
      grading: published ? { status: 'selesai', grades: sub.grades, note: sub.teacher_note, gradedAt: sub.graded_at } : { status: sub.status === 'submitted' ? 'menunggu' : 'belum' },
      events
    };
  }

  app.get('/api/submission', needRole('siswa'), (req, res) => res.json(studentState(req.user)));

  app.patch('/api/submission', needRole('siswa'), (req, res) => {
    const changes = req.body?.changes;
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new HttpError(400, 'Data perubahan tidak valid.');
    const ids = Object.keys(changes);
    if (ids.length > 200) throw new HttpError(400, 'Terlalu banyak perubahan sekaligus.');
    const result = db.tx(() => {
      const sub = getSubmission(req.user.id, true);
      if (sub.status === 'submitted') throw new HttpError(409, 'LKPD sudah dikumpulkan. Jawaban tidak dapat diubah kecuali guru membukanya kembali.', { code: 'submitted' });
      const locked = new Set(lockedSections(sub));
      const rejected = {};
      for (const id of ids) {
        const item = ITEMS.get(id);
        if (!item) { rejected[id] = 'Butir tidak dikenal.'; continue; }
        if (locked.has(item.section)) { rejected[id] = 'Aktivitas ini sudah diperiksa sehingga jawabannya terkunci.'; continue; }
        const r = G.sanitize(id, changes[id]);
        if (!r.ok) { rejected[id] = r.error; continue; }
        if (r.value === null) delete sub.answers[id]; else sub.answers[id] = r.value;
      }
      const t = nowIso();
      db.run('UPDATE submissions SET answers = ?, updated_at = ? WHERE user_id = ?', JSON.stringify(sub.answers), t, req.user.id);
      return { rejected, updatedAt: t, progress: G.sectionProgress(sub.answers) };
    });
    res.json(result);
  });

  app.post('/api/submission/check/:section', needRole('siswa'), (req, res) => {
    const sectionId = req.params.section;
    if (!CHECKABLE.includes(sectionId)) throw new HttpError(404, 'Bagian ini tidak memiliki kunci jawaban.');
    const out = db.tx(() => {
      const sub = getSubmission(req.user.id, true);
      const cls = getClass(req.user.classId);
      const r = revealState(sub, cls, sectionId);
      if (!r.allowed) throw new HttpError(403, r.reason, { code: 'not_allowed' });
      if (r.locks && req.body?.confirmLock !== true) throw new HttpError(428, 'Konfirmasi diperlukan: setelah diperiksa, jawaban pada aktivitas ini terkunci.', { code: 'confirm_lock' });
      if (!sub.checked[sectionId]) {
        sub.checked[sectionId] = nowIso();
        db.run('UPDATE submissions SET checked = ?, key_seen = 1 WHERE user_id = ?', JSON.stringify(sub.checked), req.user.id);
        logEvent(req.user.id, req.user.id, 'periksa', `Memeriksa jawaban ${sectionId}`);
      }
      const items = G.sectionFeedback(sectionId, sub.answers, true);
      return { section: sectionId, items, score: items.reduce((a, i) => a + (i.correct ? i.points : 0), 0), max: items.reduce((a, i) => a + i.points, 0) };
    });
    res.json(out);
  });

  app.post('/api/submission/submit', needRole('siswa'), (req, res) => {
    if (req.body?.confirm !== true) throw new HttpError(400, 'Konfirmasi pengumpulan diperlukan.');
    const out = db.tx(() => {
      const sub = getSubmission(req.user.id, true);
      if (sub.status === 'submitted') return { already: true, submittedAt: sub.submitted_at };
      const progress = G.sectionProgress(sub.answers);
      if (progress.filled < progress.total) {
        const missing = SECTIONS.map(s => ({ section: s.id, title: s.nav, items: progress.sections[s.id].missing })).filter(m => m.items.length);
        throw new HttpError(422, 'Masih ada pertanyaan wajib yang belum diisi.', { code: 'incomplete', missing });
      }
      const t = nowIso();
      const auto = G.autoScore(sub.answers);
      const r = db.run(`UPDATE submissions SET status = 'submitted', submitted_at = ?, updated_at = ?, auto_score = ?, auto_max = ?
        WHERE user_id = ? AND status IN ('draft', 'reopened')`, t, t, auto.score, auto.max, req.user.id);
      if (r.changes !== 1) return { already: true, submittedAt: getSubmission(req.user.id).submitted_at };
      logEvent(req.user.id, req.user.id, 'kumpul', sub.revision ? `Pengumpulan ulang ke-${sub.revision}` : 'Pengumpulan pertama');
      return { already: false, submittedAt: t };
    });
    res.json({ ...out, state: studentState(req.user) });
  });

  function sendPdf(res, userId, viewer) {
    const u = db.get('SELECT * FROM users WHERE id = ?', userId);
    const sub = getSubmission(userId);
    const cls = getClass(u.class_id);
    const isTeacher = viewer === 'guru';
    const published = sub.grading_status === 'selesai';
    const revealAll = isTeacher || (sub.status === 'submitted' && CHECKABLE.every(id => revealState(sub, cls, id).allowed));
    const events = db.all('SELECT type, note, at FROM events WHERE user_id = ? ORDER BY id', userId);
    const doc = buildPdf({
      user: u, cls, sub, progress: G.sectionProgress(sub.answers),
      totals: computeTotals(sub), showKey: revealAll, showGrades: isTeacher || published,
      teacherCopy: isTeacher, events
    });
    const safe = u.name.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="LKPD_${safe}.pdf"`);
    doc.pipe(res);
    doc.end();
  }

  app.get('/api/submission/pdf', needRole('siswa'), (req, res) => {
    const sub = getSubmission(req.user.id);
    if (!sub || sub.status !== 'submitted') throw new HttpError(403, 'PDF dapat diunduh setelah LKPD berhasil dikumpulkan.');
    sendPdf(res, req.user.id, 'siswa');
  });

  // ---------- Guru ----------

  const teacher = needRole('guru');

  function ownClass(req, classId) {
    const cls = getClass(classId);
    if (!cls || cls.teacher_id !== req.user.id) throw new HttpError(404, 'Kelas tidak ditemukan.');
    return cls;
  }
  function ownStudent(req, studentId) {
    const u = db.get("SELECT * FROM users WHERE id = ? AND role = 'siswa'", studentId);
    if (!u) throw new HttpError(404, 'Siswa tidak ditemukan.');
    const cls = getClass(u.class_id);
    if (!cls || cls.teacher_id !== req.user.id) throw new HttpError(404, 'Siswa tidak ditemukan.');
    return { u, cls };
  }

  app.get('/api/teacher/classes', teacher, (req, res) => {
    const rows = db.all(`SELECT c.*,
      (SELECT COUNT(*) FROM users u WHERE u.class_id = c.id AND u.role = 'siswa') AS students,
      (SELECT COUNT(*) FROM users u JOIN submissions s ON s.user_id = u.id WHERE u.class_id = c.id AND s.status = 'submitted') AS submitted
      FROM classes c WHERE c.teacher_id = ? ORDER BY c.created_at`, req.user.id);
    res.json({ classes: rows });
  });

  app.post('/api/teacher/classes', teacher, (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (name.length < 1 || name.length > 40) throw new HttpError(400, 'Nama kelas wajib diisi (maksimal 40 karakter).');
    const mode = FEEDBACK_MODES.includes(req.body?.feedbackMode) ? req.body.feedbackMode : 'setelah';
    let code;
    do { code = auth.joinCode(); } while (db.get('SELECT 1 FROM classes WHERE join_code = ?', code));
    const id = auth.newId();
    db.run('INSERT INTO classes (id, name, teacher_id, join_code, feedback_mode, created_at) VALUES (?, ?, ?, ?, ?, ?)', id, name, req.user.id, code, mode, nowIso());
    res.status(201).json({ class: getClass(id) });
  });

  app.patch('/api/teacher/classes/:id', teacher, (req, res) => {
    const cls = ownClass(req, req.params.id);
    const mode = req.body?.feedbackMode;
    const name = req.body?.name;
    if (mode !== undefined && !FEEDBACK_MODES.includes(mode)) throw new HttpError(400, 'Pengaturan pembahasan tidak valid.');
    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 40)) throw new HttpError(400, 'Nama kelas tidak valid.');
    db.run('UPDATE classes SET feedback_mode = ?, name = ? WHERE id = ?', mode ?? cls.feedback_mode, name?.trim() ?? cls.name, cls.id);
    res.json({ class: getClass(cls.id) });
  });

  function studentRow(u) {
    const sub = getSubmission(u.id);
    if (!sub) return { id: u.id, name: u.name, email: u.email, status: 'belum_mulai', percent: 0, submittedAt: null, auto: null, autoMax: null, grading: 'belum', finalScore: null };
    const p = G.sectionProgress(sub.answers);
    const t = computeTotals(sub);
    const started = Object.keys(sub.answers).length > 0;
    return {
      id: u.id, name: u.name, email: u.email,
      status: sub.status === 'draft' ? (started ? 'mengerjakan' : 'belum_mulai') : sub.status === 'submitted' ? 'dikumpulkan' : 'dibuka_kembali',
      percent: p.percent, submittedAt: sub.submitted_at, updatedAt: sub.updated_at,
      auto: sub.status === 'submitted' ? t.auto : null, autoMax: t.autoMax,
      grading: sub.grading_status, manualGraded: t.manualGraded, manualCount: t.manualCount,
      finalScore: sub.grading_status === 'selesai' ? t.finalScore : null
    };
  }

  app.get('/api/teacher/classes/:id/students', teacher, (req, res) => {
    const cls = ownClass(req, req.params.id);
    const users = db.all("SELECT * FROM users WHERE class_id = ? AND role = 'siswa' ORDER BY name COLLATE NOCASE", cls.id);
    res.json({ class: cls, allSubmitted: classAllSubmitted(cls.id), students: users.map(studentRow) });
  });

  app.get('/api/teacher/classes/:id/csv', teacher, (req, res) => {
    const cls = ownClass(req, req.params.id);
    const users = db.all("SELECT * FROM users WHERE class_id = ? AND role = 'siswa' ORDER BY name COLLATE NOCASE", cls.id);
    const label = { belum_mulai: 'Belum mulai', mengerjakan: 'Sedang mengerjakan', dikumpulkan: 'Dikumpulkan', dibuka_kembali: 'Dibuka kembali' };
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Nama', 'Email', 'Kelas', 'Status', 'Penyelesaian (%)', 'Waktu pengumpulan', 'Skor otomatis', 'Skor otomatis maks', 'Status penilaian', 'Nilai akhir'].map(q).join(';')];
    for (const u of users) {
      const r = studentRow(u);
      lines.push([r.name, r.email, cls.name, label[r.status], r.percent, r.submittedAt || '', r.auto ?? '', r.autoMax ?? '', r.grading, r.finalScore ?? ''].map(q).join(';'));
    }
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="rekap_${cls.name.replace(/[^\p{L}\p{N}]+/gu, '_')}.csv"`);
    res.send('﻿' + lines.join('\r\n'));
  });

  app.get('/api/teacher/students/:id', teacher, (req, res) => {
    const { u, cls } = ownStudent(req, req.params.id);
    const sub = getSubmission(u.id, true);
    const feedback = {};
    for (const id of CHECKABLE) feedback[id] = G.sectionFeedback(id, sub.answers, true);
    const rubrics = {};
    for (const it of ITEMS.values()) if (it.graded === 'teacher') rubrics[it.id] = RUBRICS[it.id] || '';
    res.json({
      student: { id: u.id, name: u.name, email: u.email, className: cls.name, classId: cls.id },
      submission: {
        answers: sub.answers, status: sub.status, startedAt: sub.started_at, updatedAt: sub.updated_at, submittedAt: sub.submitted_at,
        checked: sub.checked, grades: sub.grades, note: sub.teacher_note, gradingStatus: sub.grading_status, gradedAt: sub.graded_at, revision: sub.revision
      },
      progress: G.sectionProgress(sub.answers),
      totals: computeTotals(sub),
      feedback, rubrics,
      events: db.all('SELECT e.type, e.note, e.at, a.name AS actor FROM events e LEFT JOIN users a ON a.id = e.actor_id WHERE e.user_id = ? ORDER BY e.id', u.id)
    });
  });

  app.put('/api/teacher/students/:id/grades', teacher, (req, res) => {
    const { u } = ownStudent(req, req.params.id);
    const body = req.body || {};
    const status = body.status;
    if (!['proses', 'selesai'].includes(status)) throw new HttpError(400, 'Status penilaian tidak valid.');
    const out = db.tx(() => {
      const sub = getSubmission(u.id, true);
      if (sub.status !== 'submitted') throw new HttpError(409, 'Penilaian hanya dapat dilakukan setelah siswa mengumpulkan LKPD.');
      const grades = {};
      const input = body.grades && typeof body.grades === 'object' ? body.grades : {};
      for (const [id, g] of Object.entries(input)) {
        const item = ITEMS.get(id);
        if (!item || !g || typeof g !== 'object') throw new HttpError(400, `Butir ${id} tidak dikenal.`);
        const entry = {};
        if (g.comment !== undefined && g.comment !== '') {
          if (typeof g.comment !== 'string' || g.comment.length > 1000) throw new HttpError(400, 'Komentar maksimal 1000 karakter.');
          entry.comment = g.comment;
        }
        if (g.score !== undefined && g.score !== null && g.score !== '') {
          if (item.graded !== 'teacher') throw new HttpError(400, `Butir ${id} tidak diberi skor oleh guru.`);
          const s = Number(g.score);
          if (!Number.isFinite(s) || s < 0 || s > item.points || Math.round(s * 2) !== s * 2) throw new HttpError(400, `Skor untuk ${id} harus 0 sampai ${item.points}.`);
          entry.score = s;
        }
        if (Object.keys(entry).length) grades[id] = entry;
      }
      const note = typeof body.note === 'string' ? body.note.slice(0, 2000) : '';
      if (status === 'selesai') {
        const missing = [...ITEMS.values()].filter(i => i.graded === 'teacher' && typeof grades[i.id]?.score !== 'number');
        if (missing.length) throw new HttpError(422, `Masih ada ${missing.length} jawaban uraian yang belum diberi skor.`, { missing: missing.map(i => i.id) });
      }
      const t = nowIso();
      db.run('UPDATE submissions SET grades = ?, teacher_note = ?, grading_status = ?, graded_at = ? WHERE user_id = ?',
        JSON.stringify(grades), note, status, status === 'selesai' ? t : null, u.id);
      if (status === 'selesai' && sub.grading_status !== 'selesai') logEvent(u.id, req.user.id, 'nilai_selesai', 'Penilaian guru selesai dan dapat dilihat siswa');
      return { ok: true, gradingStatus: status, totals: computeTotals({ ...sub, grades }) };
    });
    res.json(out);
  });

  app.post('/api/teacher/students/:id/reopen', teacher, (req, res) => {
    const { u } = ownStudent(req, req.params.id);
    const note = String(req.body?.note || '').trim();
    if (note.length < 3) throw new HttpError(400, 'Tuliskan alasan pembukaan kembali (minimal 3 karakter).');
    const unlockChecked = req.body?.unlockChecked === true;
    db.tx(() => {
      const sub = getSubmission(u.id);
      if (!sub || sub.status !== 'submitted') throw new HttpError(409, 'LKPD siswa ini belum dikumpulkan.');
      db.run(`UPDATE submissions SET status = 'reopened', revision = revision + 1, grading_status = CASE WHEN grading_status = 'selesai' THEN 'proses' ELSE grading_status END${unlockChecked ? ", checked = '{}'" : ''} WHERE user_id = ?`, u.id);
      logEvent(u.id, req.user.id, 'buka_kembali', note + (unlockChecked ? ' (bagian yang sudah diperiksa ikut dibuka)' : ''));
    });
    res.json({ ok: true });
  });

  app.post('/api/teacher/students/:id/reset-password', teacher, (req, res) => {
    const { u } = ownStudent(req, req.params.id);
    const pass = auth.tempPassword();
    db.tx(() => {
      db.run('UPDATE users SET password_hash = ? WHERE id = ?', auth.hashPassword(pass), u.id);
      db.run('DELETE FROM sessions WHERE user_id = ?', u.id);
      logEvent(u.id, req.user.id, 'atur_sandi', 'Kata sandi diatur ulang oleh guru');
    });
    res.json({ password: pass });
  });

  app.get('/api/teacher/students/:id/pdf', teacher, (req, res) => {
    const { u } = ownStudent(req, req.params.id);
    if (!getSubmission(u.id)) throw new HttpError(404, 'Siswa ini belum mulai mengerjakan.');
    sendPdf(res, u.id, 'guru');
  });

  // ---------- Berkas statis ----------

  app.use('/api', (req, res, next) => next(new HttpError(404, 'Alamat API tidak ditemukan.')));
  app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html', extensions: ['html'] }));

  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Format data tidak valid.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Data terlalu besar.' });
    console.error(err);
    res.status(500).json({ error: 'Terjadi kesalahan di server. Coba lagi beberapa saat lagi.' });
  });

  return app;
}

module.exports = { createApp, HttpError };
