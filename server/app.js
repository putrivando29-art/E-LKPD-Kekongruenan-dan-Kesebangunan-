'use strict';
const path = require('node:path');
const express = require('express');
const auth = require('./auth');
const G = require('./grading');
const { META, SECTIONS, ITEMS } = require('./lkpd');
const { RUBRICS } = require('./keys');
const { buildPdf } = require('./pdf');

const FEEDBACK_MODES = ['sebelum', 'setelah', 'setelah_semua'];
const CHECKABLE = SECTIONS.filter(s => s.checkable).map(s => s.id);
const INVITE_DAYS = 7;
const nowIso = () => new Date().toISOString();

class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

// Kode akses guru dari variabel lingkungan server. Kode pendek (kurang dari 8 karakter) diabaikan agar tidak mudah ditebak.
function envTeacherCode() {
  const c = (process.env.KODE_AKSES_GURU || '').trim();
  return c.length >= 8 ? c : null;
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
  app.use('/api', async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.get('X-ELKPD') !== '1') return next(new HttpError(403, 'Permintaan ditolak.'));
    try {
      await db.ready;
    } catch {
      return next(new HttpError(503, 'Database belum dapat dihubungi. Hubungi pengelola website.'));
    }
    req.user = await auth.userFromRequest(db, req);
    next();
  });

  const needRole = role => (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'Sesi berakhir. Silakan masuk kembali.', { code: 'no_session' }));
    if (req.user.role !== role) return next(new HttpError(403, role === 'guru' ? 'Halaman ini hanya untuk guru.' : 'Halaman ini hanya untuk siswa.', { code: 'wrong_role' }));
    next();
  };

  // ---------- Data bantu (q = db atau transaksi) ----------

  const getClass = (q, id) => (id ? q.get('SELECT * FROM classes WHERE id = ?', id) : null);

  async function getSubmission(q, userId, { create = false, lock = false } = {}) {
    if (create) {
      const t = nowIso();
      await q.run('INSERT INTO submissions (user_id, started_at, updated_at) VALUES (?, ?, ?) ON CONFLICT (user_id) DO NOTHING', userId, t, t);
    }
    const sub = await q.get(`SELECT * FROM submissions WHERE user_id = ?${lock ? q.forUpdate : ''}`, userId);
    if (!sub) return null;
    return { ...sub, answers: JSON.parse(sub.answers), checked: JSON.parse(sub.checked), grades: JSON.parse(sub.grades) };
  }

  const logEvent = (q, userId, actorId, type, note = '') =>
    q.run('INSERT INTO events (user_id, actor_id, type, note, at) VALUES (?, ?, ?, ?, ?)', userId, actorId, type, note, nowIso());

  async function classAllSubmitted(q, classId) {
    const r = await q.get(`SELECT CAST(COUNT(*) AS INTEGER) AS n,
      CAST(COALESCE(SUM(CASE WHEN s.status = 'submitted' THEN 1 ELSE 0 END), 0) AS INTEGER) AS done
      FROM users u LEFT JOIN submissions s ON s.user_id = u.id
      WHERE u.role = 'siswa' AND u.class_id = ?`, classId);
    return Number(r.n) > 0 && Number(r.done) === Number(r.n);
  }

  // Apakah kunci dan pembahasan bagian ini boleh diberikan kepada siswa sekarang?
  async function revealState(q, sub, cls, sectionId) {
    if (!CHECKABLE.includes(sectionId)) return { allowed: false, reason: 'Bagian ini tidak punya kunci jawaban.' };
    const progress = G.sectionProgress(sub.answers).sections[sectionId];
    const mode = cls ? cls.feedback_mode : 'setelah';
    if (sub.checked[sectionId] && (mode === 'sebelum' || sub.status === 'submitted')) return { allowed: true, mode };
    if (progress.missing.length) return { allowed: false, mode, reason: 'Isi dulu semua pertanyaan wajib di aktivitas ini.' };
    if (mode === 'sebelum') return { allowed: true, mode, locks: sub.status !== 'submitted' };
    if (sub.status !== 'submitted') return { allowed: false, mode, reason: 'Pembahasan bisa dilihat setelah LKPD dikumpulkan.' };
    if (mode === 'setelah_semua' && !(await classAllSubmitted(q, cls.id))) return { allowed: false, mode, reason: 'Pembahasan dibuka setelah semua teman sekelasmu mengumpulkan.' };
    return { allowed: true, mode };
  }

  function computeTotals(sub) {
    const a = G.autoScore(sub.answers);
    let manual = 0, manualGraded = 0, manualCount = 0;
    for (const it of ITEMS.values()) {
      if (it.graded !== 'teacher') continue;
      manualCount++;
      const g = sub.grades[it.id];
      if (g && typeof g.score === 'number') { manual += g.score; manualGraded++; }
    }
    const max = a.max + G.manualMax();
    return {
      auto: a.score, autoMax: a.max,
      manual, manualMax: G.manualMax(), manualGraded, manualCount,
      total: a.score + manual, max,
      finalScore: Math.round(((a.score + manual) / max) * 1000) / 10
    };
  }

  const publicUser = (u, cls) => ({ id: u.id, name: u.name, email: u.email, role: u.role, className: cls ? cls.name : null, classId: cls ? cls.id : null });

  async function startSession(res, userId) {
    const s = await auth.createSession(db, userId);
    res.set('Set-Cookie', auth.sessionCookie(s.token, s.expires, secureCookie));
  }

  // ---------- Umum ----------

  app.get('/api/lkpd', (req, res) => res.json({ meta: META, sections: SECTIONS, modes: FEEDBACK_MODES }));

  app.get('/api/me', async (req, res) => {
    if (!req.user) return res.json({ user: null });
    const u = await db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    res.json({ user: publicUser(u, await getClass(db, u.class_id)) });
  });

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function readAccount(body) {
    const name = String(body?.name || '').trim().replace(/\s+/g, ' ');
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const errors = {};
    if (name.length < 3 || name.length > 80 || !/\p{L}/u.test(name)) errors.name = 'Tulis nama lengkap (3 sampai 80 huruf).';
    if (!EMAIL_RE.test(email) || email.length > 120) errors.email = 'Format email belum benar.';
    if (password.length < 8 || password.length > 100) errors.password = 'Kata sandi minimal 8 karakter.';
    return { name, email, password, errors };
  }

  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, errors } = readAccount(req.body);
    const code = String(req.body?.classCode || '').trim().toUpperCase();
    const cls = code ? await db.get('SELECT * FROM classes WHERE join_code = ?', code) : null;
    if (!cls) errors.classCode = 'Kode kelas tidak ditemukan. Minta kode kelas ke gurumu.';
    if (Object.keys(errors).length) throw new HttpError(400, 'Cek lagi isian pendaftaran.', { errors });
    if (await db.get('SELECT 1 AS x FROM users WHERE email = ?', email)) throw new HttpError(409, 'Email ini sudah terdaftar. Silakan masuk.', { errors: { email: 'Email sudah terdaftar.' } });
    const id = auth.newId();
    await db.tx(async t => {
      await t.run('INSERT INTO users (id, email, name, role, class_id, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id, email, name, 'siswa', cls.id, auth.hashPassword(password), nowIso());
      await logEvent(t, id, id, 'daftar', `Mendaftar ke kelas ${cls.name}`);
    });
    await startSession(res, id);
    res.status(201).json({ user: publicUser({ id, name, email, role: 'siswa' }, cls) });
  });

  // Pendaftaran guru: wajib kode akses yang diverifikasi di server. Kode berasal dari undangan sekali pakai
  // yang dibuat guru terdaftar, atau dari KODE_AKSES_GURU di variabel lingkungan server.
  app.post('/api/auth/register-teacher', async (req, res) => {
    const key = `kode_guru:${req.ip}`;
    if (await auth.tooManyAttempts(db, key, 5, 15)) throw new HttpError(429, 'Terlalu banyak percobaan kode akses. Coba lagi 15 menit lagi.');
    const { name, email, password, errors } = readAccount(req.body);
    const code = String(req.body?.accessCode || '').trim();
    if (!code) errors.accessCode = 'Kode akses guru wajib diisi.';
    if (Object.keys(errors).length) throw new HttpError(400, 'Cek lagi isian pendaftaran.', { errors });

    const now = nowIso();
    const invite = await db.get('SELECT * FROM teacher_invites WHERE code_hash = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?',
      auth.sha256(code.toUpperCase()), now);
    const envCode = envTeacherCode();
    const viaEnv = !invite && envCode && auth.safeEqual(code, envCode);
    if (!invite && !viaEnv) {
      await auth.recordFailure(db, key);
      throw new HttpError(403, 'Kode akses guru tidak valid atau sudah tidak berlaku.', { errors: { accessCode: 'Kode akses tidak valid.' } });
    }
    if (await db.get('SELECT 1 AS x FROM users WHERE email = ?', email)) throw new HttpError(409, 'Email ini sudah terdaftar. Silakan masuk.', { errors: { email: 'Email sudah terdaftar.' } });
    const id = auth.newId();
    await db.tx(async t => {
      await t.run('INSERT INTO users (id, email, name, role, class_id, password_hash, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?)',
        id, email, name, 'guru', auth.hashPassword(password), now);
      if (invite) {
        const r = await t.run('UPDATE teacher_invites SET used_by = ?, used_at = ? WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL', id, now, invite.id);
        if (r.changes !== 1) throw new HttpError(403, 'Kode undangan ini baru saja dipakai.');
      }
      await logEvent(t, id, id, 'daftar_guru', invite ? 'Mendaftar dengan undangan guru' : 'Mendaftar dengan kode akses guru');
    });
    await auth.clearFailures(db, key);
    await startSession(res, id);
    res.status(201).json({ user: publicUser({ id, name, email, role: 'guru' }, null) });
  });

  app.post('/api/auth/login', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const role = req.body?.role;
    const key = `masuk:${req.ip}|${email}`;
    if (await auth.tooManyAttempts(db, key, 10, 15)) throw new HttpError(429, 'Terlalu banyak percobaan masuk. Coba lagi 15 menit lagi.');
    const u = await db.get('SELECT * FROM users WHERE email = ?', email);
    if (!u || !auth.verifyPassword(password, u.password_hash)) {
      await auth.recordFailure(db, key);
      throw new HttpError(401, 'Email atau kata sandi salah.');
    }
    // Peran ditentukan oleh database. Pilihan tombol di halaman hanya dipakai untuk memberi pesan yang jelas.
    if (role && role !== u.role) {
      throw new HttpError(403, u.role === 'guru' ? 'Ini akun guru. Pakai tombol Masuk sebagai Guru.' : 'Ini akun siswa. Pakai tombol Masuk sebagai Siswa.');
    }
    await auth.clearFailures(db, key);
    await startSession(res, u.id);
    res.json({ user: publicUser(u, await getClass(db, u.class_id)) });
  });

  app.post('/api/auth/logout', async (req, res) => {
    if (req.user) await auth.destroySession(db, req.user.token);
    res.set('Set-Cookie', auth.clearCookie(secureCookie));
    res.json({ ok: true });
  });

  app.post('/api/auth/logout-all', async (req, res) => {
    if (!req.user) throw new HttpError(401, 'Sesi berakhir. Silakan masuk kembali.');
    await db.run('DELETE FROM sessions WHERE user_id = ?', req.user.id);
    res.set('Set-Cookie', auth.clearCookie(secureCookie));
    res.json({ ok: true });
  });

  // ---------- Siswa ----------

  async function studentState(user) {
    const sub = await getSubmission(db, user.id, { create: true });
    const cls = await getClass(db, user.classId);
    const progress = G.sectionProgress(sub.answers);
    const reveal = {};
    for (const id of CHECKABLE) {
      const r = await revealState(db, sub, cls, id);
      reveal[id] = { allowed: r.allowed, reason: r.reason || null, locks: !!r.locks, checked: !!sub.checked[id] };
    }
    const published = sub.grading_status === 'selesai';
    const autoVisible = sub.status === 'submitted' && CHECKABLE.every(id => reveal[id].allowed);
    const totals = computeTotals(sub);
    const events = await db.all('SELECT type, note, at FROM events WHERE user_id = ? AND type IN (?, ?, ?) ORDER BY id', user.id, 'kumpul', 'buka_kembali', 'nilai_selesai');
    return {
      answers: sub.answers,
      status: sub.status,
      startedAt: sub.started_at,
      updatedAt: sub.updated_at,
      submittedAt: sub.submitted_at,
      locked: Object.keys(sub.checked),
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

  app.get('/api/submission', needRole('siswa'), async (req, res) => res.json(await studentState(req.user)));

  app.patch('/api/submission', needRole('siswa'), async (req, res) => {
    const changes = req.body?.changes;
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new HttpError(400, 'Data perubahan tidak valid.');
    const ids = Object.keys(changes);
    if (ids.length > 200) throw new HttpError(400, 'Terlalu banyak perubahan sekaligus.');
    await getSubmission(db, req.user.id, { create: true });
    const result = await db.tx(async t => {
      const sub = await getSubmission(t, req.user.id, { lock: true });
      if (sub.status === 'submitted') throw new HttpError(409, 'LKPD sudah dikumpulkan. Jawaban tidak bisa diubah lagi kecuali guru membukanya.', { code: 'submitted' });
      const locked = new Set(Object.keys(sub.checked));
      const rejected = {};
      for (const id of ids) {
        const item = ITEMS.get(id);
        if (!item) { rejected[id] = 'Pertanyaan tidak dikenal.'; continue; }
        if (locked.has(item.section)) { rejected[id] = 'Aktivitas ini sudah diperiksa, jadi jawabannya terkunci.'; continue; }
        const r = G.sanitize(id, changes[id]);
        if (!r.ok) { rejected[id] = r.error; continue; }
        if (r.value === null) delete sub.answers[id]; else sub.answers[id] = r.value;
      }
      const tm = nowIso();
      await t.run('UPDATE submissions SET answers = ?, updated_at = ? WHERE user_id = ?', JSON.stringify(sub.answers), tm, req.user.id);
      return { rejected, updatedAt: tm, progress: G.sectionProgress(sub.answers) };
    });
    res.json(result);
  });

  app.post('/api/submission/check/:section', needRole('siswa'), async (req, res) => {
    const sectionId = req.params.section;
    if (!CHECKABLE.includes(sectionId)) throw new HttpError(404, 'Bagian ini tidak punya kunci jawaban.');
    await getSubmission(db, req.user.id, { create: true });
    const out = await db.tx(async t => {
      const sub = await getSubmission(t, req.user.id, { lock: true });
      const cls = await getClass(t, req.user.classId);
      const r = await revealState(t, sub, cls, sectionId);
      if (!r.allowed) throw new HttpError(403, r.reason, { code: 'not_allowed' });
      if (r.locks && req.body?.confirmLock !== true) throw new HttpError(428, 'Perlu konfirmasi: setelah diperiksa, jawaban aktivitas ini terkunci.', { code: 'confirm_lock' });
      if (!sub.checked[sectionId]) {
        sub.checked[sectionId] = nowIso();
        await t.run('UPDATE submissions SET checked = ?, key_seen = 1 WHERE user_id = ?', JSON.stringify(sub.checked), req.user.id);
        await logEvent(t, req.user.id, req.user.id, 'periksa', `Memeriksa jawaban ${sectionId}`);
      }
      const items = G.sectionFeedback(sectionId, sub.answers, true);
      return { section: sectionId, items, score: items.reduce((a, i) => a + (i.correct ? i.points : 0), 0), max: items.reduce((a, i) => a + i.points, 0) };
    });
    res.json(out);
  });

  app.post('/api/submission/submit', needRole('siswa'), async (req, res) => {
    if (req.body?.confirm !== true) throw new HttpError(400, 'Perlu konfirmasi pengumpulan.');
    await getSubmission(db, req.user.id, { create: true });
    const out = await db.tx(async t => {
      const sub = await getSubmission(t, req.user.id, { lock: true });
      if (sub.status === 'submitted') return { already: true, submittedAt: sub.submitted_at };
      const progress = G.sectionProgress(sub.answers);
      if (progress.filled < progress.total) {
        const missing = SECTIONS.map(s => ({ section: s.id, title: s.nav, items: progress.sections[s.id].missing })).filter(m => m.items.length);
        throw new HttpError(422, 'Masih ada pertanyaan wajib yang belum diisi.', { code: 'incomplete', missing });
      }
      const tm = nowIso();
      const a = G.autoScore(sub.answers);
      const r = await t.run(`UPDATE submissions SET status = 'submitted', submitted_at = ?, updated_at = ?, auto_score = ?, auto_max = ?
        WHERE user_id = ? AND status IN ('draft', 'reopened')`, tm, tm, a.score, a.max, req.user.id);
      if (r.changes !== 1) return { already: true, submittedAt: (await getSubmission(t, req.user.id)).submitted_at };
      await logEvent(t, req.user.id, req.user.id, 'kumpul', sub.revision ? `Pengumpulan ulang ke-${sub.revision}` : 'Pengumpulan pertama');
      return { already: false, submittedAt: tm };
    });
    res.json({ ...out, state: await studentState(req.user) });
  });

  async function sendPdf(res, userId, viewer) {
    const u = await db.get('SELECT * FROM users WHERE id = ?', userId);
    const sub = await getSubmission(db, userId);
    const cls = await getClass(db, u.class_id);
    const isTeacher = viewer === 'guru';
    let revealAll = isTeacher;
    if (!isTeacher && sub.status === 'submitted') {
      revealAll = true;
      for (const id of CHECKABLE) if (!(await revealState(db, sub, cls, id)).allowed) revealAll = false;
    }
    const events = await db.all('SELECT type, note, at FROM events WHERE user_id = ? ORDER BY id', userId);
    const doc = buildPdf({
      user: u, cls, sub, progress: G.sectionProgress(sub.answers),
      totals: computeTotals(sub), showKey: revealAll, showGrades: isTeacher || sub.grading_status === 'selesai',
      teacherCopy: isTeacher, events
    });
    const safe = u.name.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="LKPD_${safe}.pdf"`);
    doc.pipe(res);
    doc.end();
  }

  app.get('/api/submission/pdf', needRole('siswa'), async (req, res) => {
    const sub = await getSubmission(db, req.user.id);
    if (!sub || sub.status !== 'submitted') throw new HttpError(403, 'PDF bisa diunduh setelah LKPD berhasil dikumpulkan.');
    await sendPdf(res, req.user.id, 'siswa');
  });

  // ---------- Guru ----------

  const teacher = needRole('guru');

  async function ownClass(req, classId) {
    const cls = await getClass(db, classId);
    if (!cls || cls.teacher_id !== req.user.id) throw new HttpError(404, 'Kelas tidak ditemukan.');
    return cls;
  }
  // Guru hanya dapat membuka siswa di kelas miliknya. Siswa kelas lain dibalas "tidak ditemukan".
  async function ownStudent(req, studentId) {
    const u = await db.get("SELECT * FROM users WHERE id = ? AND role = 'siswa'", studentId);
    if (!u) throw new HttpError(404, 'Siswa tidak ditemukan.');
    const cls = await getClass(db, u.class_id);
    if (!cls || cls.teacher_id !== req.user.id) throw new HttpError(404, 'Siswa tidak ditemukan.');
    return { u, cls };
  }

  app.get('/api/teacher/classes', teacher, async (req, res) => {
    const rows = await db.all(`SELECT c.*,
      (SELECT CAST(COUNT(*) AS INTEGER) FROM users u WHERE u.class_id = c.id AND u.role = 'siswa') AS students,
      (SELECT CAST(COUNT(*) AS INTEGER) FROM users u JOIN submissions s ON s.user_id = u.id WHERE u.class_id = c.id AND s.status = 'submitted') AS submitted
      FROM classes c WHERE c.teacher_id = ? ORDER BY c.created_at`, req.user.id);
    res.json({ classes: rows.map(r => ({ ...r, students: Number(r.students), submitted: Number(r.submitted) })) });
  });

  app.post('/api/teacher/classes', teacher, async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (name.length < 1 || name.length > 40) throw new HttpError(400, 'Nama kelas wajib diisi (maksimal 40 karakter).');
    const mode = FEEDBACK_MODES.includes(req.body?.feedbackMode) ? req.body.feedbackMode : 'setelah';
    let code;
    do { code = auth.joinCode(); } while (await db.get('SELECT 1 AS x FROM classes WHERE join_code = ?', code));
    const id = auth.newId();
    await db.run('INSERT INTO classes (id, name, teacher_id, join_code, feedback_mode, created_at) VALUES (?, ?, ?, ?, ?, ?)', id, name, req.user.id, code, mode, nowIso());
    res.status(201).json({ class: await getClass(db, id) });
  });

  app.patch('/api/teacher/classes/:id', teacher, async (req, res) => {
    const cls = await ownClass(req, req.params.id);
    const mode = req.body?.feedbackMode;
    const name = req.body?.name;
    if (mode !== undefined && !FEEDBACK_MODES.includes(mode)) throw new HttpError(400, 'Pengaturan pembahasan tidak valid.');
    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 40)) throw new HttpError(400, 'Nama kelas tidak valid.');
    await db.run('UPDATE classes SET feedback_mode = ?, name = ? WHERE id = ?', mode ?? cls.feedback_mode, name?.trim() ?? cls.name, cls.id);
    res.json({ class: await getClass(db, cls.id) });
  });

  async function studentRow(u) {
    const sub = await getSubmission(db, u.id);
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

  const classStudents = cls => db.all("SELECT * FROM users WHERE class_id = ? AND role = 'siswa' ORDER BY LOWER(name)", cls.id);

  app.get('/api/teacher/classes/:id/students', teacher, async (req, res) => {
    const cls = await ownClass(req, req.params.id);
    const rows = [];
    for (const u of await classStudents(cls)) rows.push(await studentRow(u));
    res.json({ class: cls, allSubmitted: await classAllSubmitted(db, cls.id), students: rows });
  });

  app.get('/api/teacher/classes/:id/csv', teacher, async (req, res) => {
    const cls = await ownClass(req, req.params.id);
    const label = { belum_mulai: 'Belum mulai', mengerjakan: 'Sedang mengerjakan', dikumpulkan: 'Dikumpulkan', dibuka_kembali: 'Dibuka kembali' };
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Nama', 'Email', 'Kelas', 'Status', 'Penyelesaian (%)', 'Waktu pengumpulan', 'Skor otomatis', 'Skor otomatis maks', 'Status penilaian', 'Nilai akhir'].map(q).join(';')];
    for (const u of await classStudents(cls)) {
      const r = await studentRow(u);
      lines.push([r.name, r.email, cls.name, label[r.status], r.percent, r.submittedAt || '', r.auto ?? '', r.autoMax ?? '', r.grading, r.finalScore ?? ''].map(q).join(';'));
    }
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="rekap_${cls.name.replace(/[^\p{L}\p{N}]+/gu, '_')}.csv"`);
    res.send('﻿' + lines.join('\r\n'));
  });

  app.get('/api/teacher/students/:id', teacher, async (req, res) => {
    const { u, cls } = await ownStudent(req, req.params.id);
    const sub = await getSubmission(db, u.id, { create: true });
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
      events: await db.all('SELECT e.type, e.note, e.at, a.name AS actor FROM events e LEFT JOIN users a ON a.id = e.actor_id WHERE e.user_id = ? ORDER BY e.id', u.id)
    });
  });

  app.put('/api/teacher/students/:id/grades', teacher, async (req, res) => {
    const { u } = await ownStudent(req, req.params.id);
    const body = req.body || {};
    const status = body.status;
    if (!['proses', 'selesai'].includes(status)) throw new HttpError(400, 'Status penilaian tidak valid.');
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
    const out = await db.tx(async t => {
      const sub = await getSubmission(t, u.id, { lock: true });
      if (!sub || sub.status !== 'submitted') throw new HttpError(409, 'Penilaian hanya bisa dilakukan setelah siswa mengumpulkan LKPD.');
      const tm = nowIso();
      await t.run('UPDATE submissions SET grades = ?, teacher_note = ?, grading_status = ?, graded_at = ? WHERE user_id = ?',
        JSON.stringify(grades), note, status, status === 'selesai' ? tm : null, u.id);
      if (status === 'selesai' && sub.grading_status !== 'selesai') await logEvent(t, u.id, req.user.id, 'nilai_selesai', 'Penilaian guru selesai dan dapat dilihat siswa');
      return { ok: true, gradingStatus: status, totals: computeTotals({ ...sub, grades }) };
    });
    res.json(out);
  });

  app.post('/api/teacher/students/:id/reopen', teacher, async (req, res) => {
    const { u } = await ownStudent(req, req.params.id);
    const note = String(req.body?.note || '').trim();
    if (note.length < 3) throw new HttpError(400, 'Tulis alasan pembukaan kembali (minimal 3 karakter).');
    const unlockChecked = req.body?.unlockChecked === true;
    await db.tx(async t => {
      const sub = await getSubmission(t, u.id, { lock: true });
      if (!sub || sub.status !== 'submitted') throw new HttpError(409, 'LKPD siswa ini belum dikumpulkan.');
      await t.run(`UPDATE submissions SET status = 'reopened', revision = revision + 1, grading_status = CASE WHEN grading_status = 'selesai' THEN 'proses' ELSE grading_status END${unlockChecked ? ", checked = '{}'" : ''} WHERE user_id = ?`, u.id);
      await logEvent(t, u.id, req.user.id, 'buka_kembali', note + (unlockChecked ? ' (aktivitas yang sudah diperiksa ikut dibuka)' : ''));
    });
    res.json({ ok: true });
  });

  app.post('/api/teacher/students/:id/reset-password', teacher, async (req, res) => {
    const { u } = await ownStudent(req, req.params.id);
    const pass = auth.tempPassword();
    await db.tx(async t => {
      await t.run('UPDATE users SET password_hash = ? WHERE id = ?', auth.hashPassword(pass), u.id);
      await t.run('DELETE FROM sessions WHERE user_id = ?', u.id);
      await logEvent(t, u.id, req.user.id, 'atur_sandi', 'Kata sandi diatur ulang oleh guru');
    });
    res.json({ password: pass });
  });

  app.get('/api/teacher/students/:id/pdf', teacher, async (req, res) => {
    const { u } = await ownStudent(req, req.params.id);
    if (!(await getSubmission(db, u.id))) throw new HttpError(404, 'Siswa ini belum mulai mengerjakan.');
    await sendPdf(res, u.id, 'guru');
  });

  // Undangan guru sekali pakai. Kode hanya ditampilkan sekali saat dibuat; yang disimpan adalah hash-nya.
  app.get('/api/teacher/invites', teacher, async (req, res) => {
    const rows = await db.all(`SELECT i.id, i.hint, i.created_at, i.expires_at, i.used_at, i.revoked_at, u.name AS used_by_name
      FROM teacher_invites i LEFT JOIN users u ON u.id = i.used_by WHERE i.created_by = ? ORDER BY i.created_at DESC`, req.user.id);
    const now = nowIso();
    res.json({ invites: rows.map(r => ({ ...r, status: r.used_at ? 'dipakai' : r.revoked_at ? 'dibatalkan' : r.expires_at < now ? 'kedaluwarsa' : 'aktif' })) });
  });

  app.post('/api/teacher/invites', teacher, async (req, res) => {
    const active = await db.get('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM teacher_invites WHERE created_by = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?', req.user.id, nowIso());
    if (Number(active.n) >= 10) throw new HttpError(429, 'Anda sudah punya 10 undangan aktif. Batalkan undangan lama terlebih dahulu.');
    const code = auth.inviteCode();
    const now = new Date();
    const expires = new Date(now.getTime() + INVITE_DAYS * 86400000).toISOString();
    await db.run('INSERT INTO teacher_invites (id, code_hash, hint, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      auth.newId(), auth.sha256(code), code.slice(-4), req.user.id, now.toISOString(), expires);
    res.status(201).json({ code, expiresAt: expires });
  });

  app.post('/api/teacher/invites/:id/revoke', teacher, async (req, res) => {
    const r = await db.run('UPDATE teacher_invites SET revoked_at = ? WHERE id = ? AND created_by = ? AND used_at IS NULL AND revoked_at IS NULL', nowIso(), req.params.id, req.user.id);
    if (r.changes !== 1) throw new HttpError(404, 'Undangan tidak ditemukan atau sudah tidak aktif.');
    res.json({ ok: true });
  });

  // ---------- Berkas statis (di Vercel, folder public/ disajikan langsung oleh Vercel) ----------

  app.use('/api', (req, res, next) => next(new HttpError(404, 'Alamat API tidak ditemukan.')));
  app.use(express.static(path.join(__dirname, '..', 'public'), { index: 'index.html', extensions: ['html'] }));

  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Format data tidak valid.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Data terlalu besar.' });
    console.error(err);
    res.status(500).json({ error: 'Terjadi kesalahan di server. Coba lagi sebentar lagi.' });
  });

  return app;
}

module.exports = { createApp, HttpError };
