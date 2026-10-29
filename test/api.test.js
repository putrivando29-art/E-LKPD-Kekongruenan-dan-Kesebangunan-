'use strict';
// Uji alur siswa dan guru melalui HTTP terhadap server sungguhan dengan database di memori.
const test = require('node:test');
const assert = require('node:assert/strict');
const { open } = require('../server/db');
const { createApp } = require('../server/app');
const auth = require('../server/auth');
const fullAnswers = require('./fixture');

let server, base, db;

function client() {
  let cookie = '';
  return async function call(method, path, body, { header = true, raw = false } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(header && method !== 'GET' ? { 'X-ELKPD': '1' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    if (raw) return res;
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };
}

function makeTeacher(email) {
  const id = auth.newId();
  db.run('INSERT INTO users (id, email, name, role, class_id, password_hash, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?)',
    id, email, 'Guru ' + email, 'guru', auth.hashPassword('sandiguru1'), new Date().toISOString());
  return id;
}

test.before(async () => {
  db = open(':memory:');
  const app = createApp(db);
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => { server.close(); db.close(); });

test('alur lengkap siswa dan guru', async t => {
  const guru = client();
  makeTeacher('guru1@uji.id');
  makeTeacher('guru2@uji.id');

  await t.test('guru masuk dan membuat kelas', async () => {
    let r = await guru('POST', '/api/auth/login', { email: 'guru1@uji.id', password: 'salah' });
    assert.equal(r.status, 401);
    r = await guru('POST', '/api/auth/login', { email: 'guru1@uji.id', password: 'sandiguru1', role: 'siswa' });
    assert.equal(r.status, 403, 'akun guru tidak boleh masuk lewat pintu siswa');
    r = await guru('POST', '/api/auth/login', { email: 'guru1@uji.id', password: 'sandiguru1', role: 'guru' });
    assert.equal(r.status, 200);
    r = await guru('POST', '/api/teacher/classes', { name: 'VIII A' });
    assert.equal(r.status, 201);
    t.classA = r.data.class;
    assert.equal(t.classA.feedback_mode, 'setelah');
  });

  const s1 = client();
  const s2 = client();
  await t.test('pendaftaran siswa memvalidasi kode kelas dan isian', async () => {
    let r = await s1('POST', '/api/auth/register', { name: 'Ani', email: 'ani@uji.id', password: 'sandiani1', classCode: 'SALAH1' });
    assert.equal(r.status, 400);
    assert.ok(r.data.errors.classCode);
    r = await s1('POST', '/api/auth/register', { name: 'A', email: 'bukan-email', password: '123', classCode: t.classA.join_code });
    assert.equal(r.status, 400);
    assert.ok(r.data.errors.name && r.data.errors.email && r.data.errors.password);
    r = await s1('POST', '/api/auth/register', { name: 'Ani Lestari', email: 'ani@uji.id', password: 'sandiani1', classCode: t.classA.join_code.toLowerCase() });
    assert.equal(r.status, 201);
    assert.equal(r.data.user.className, 'VIII A');
    r = await s2('POST', '/api/auth/register', { name: 'Budi Santoso', email: 'budi@uji.id', password: 'sandibudi1', classCode: t.classA.join_code });
    assert.equal(r.status, 201);
    r = await client()('POST', '/api/auth/register', { name: 'Ani Lagi', email: 'ANI@uji.id', password: 'sandiani1', classCode: t.classA.join_code });
    assert.equal(r.status, 409, 'email ganda ditolak');
  });

  await t.test('pembatasan akses', async () => {
    let r = await client()('GET', '/api/submission');
    assert.equal(r.status, 401);
    r = await s1('GET', '/api/teacher/classes');
    assert.equal(r.status, 403, 'siswa tidak boleh membuka endpoint guru');
    r = await s1('GET', `/api/teacher/classes/${t.classA.id}/students`);
    assert.equal(r.status, 403);
    r = await guru('GET', '/api/submission');
    assert.equal(r.status, 403, 'guru tidak memakai endpoint siswa');
    r = await s1('PATCH', '/api/submission', { changes: { p1: 'abc def' } }, { header: false });
    assert.equal(r.status, 403, 'permintaan tanpa header X-ELKPD ditolak');
    r = await client()('GET', '/api/lkpd');
    const json = JSON.stringify(r.data);
    assert.ok(!json.includes('"explain"') && !json.includes('"answer"'), 'definisi publik tidak memuat kunci');
  });

  await t.test('penyimpanan progres dan validasi isian', async () => {
    let r = await s1('PATCH', '/api/submission', { changes: { p1: '   ', p2: '...!!', p3: 'Ya, gambar tetap', a1_q1: ['A-Z'], s5: 'x'.repeat(61), tidakada: 'a' } });
    assert.equal(r.status, 200);
    assert.ok(r.data.rejected.a1_q1 && r.data.rejected.s5 && r.data.rejected.tidakada);
    const p = r.data.progress.sections.pemantik;
    assert.equal(p.filled, 1, 'isian spasi atau tanda baca saja tidak dihitung terisi');
    r = await s1('GET', '/api/submission');
    assert.equal(r.data.answers.p3, 'Ya, gambar tetap', 'jawaban tersimpan setelah dimuat ulang');
    assert.equal(r.data.answers.p1, '   ');
    r = await s2('GET', '/api/submission');
    assert.equal(r.data.answers.p3, undefined, 'siswa lain tidak melihat jawaban Ani');
  });

  await t.test('periksa jawaban ditolak sebelum aktivitas lengkap dan sebelum mengumpulkan (mode setelah)', async () => {
    let r = await s1('POST', '/api/submission/check/a1', {});
    assert.equal(r.status, 403);
    const a = fullAnswers();
    r = await s1('PATCH', '/api/submission', { changes: { a1_q1: a.a1_q1, a1_q1_alasan: a.a1_q1_alasan, a1_q2: a.a1_q2, a1_q2_alasan: a.a1_q2_alasan, a1_q3: a.a1_q3 } });
    assert.deepEqual(r.data.rejected, {});
    r = await s1('POST', '/api/submission/check/a1', {});
    assert.equal(r.status, 403, 'mode setelah: kunci belum boleh dibuka sebelum pengumpulan');
    assert.match(r.data.error, /setelah LKPD dikumpulkan/);
  });

  await t.test('pengumpulan ditolak bila belum lengkap dan menyebut bagian yang kurang', async () => {
    const r = await s1('POST', '/api/submission/submit', { confirm: true });
    assert.equal(r.status, 422);
    const pem = r.data.missing.find(m => m.section === 'pemantik');
    assert.ok(pem.items.some(i => i.id === 'p1'), 'p1 berisi spasi tetap dianggap belum diisi');
    assert.ok(r.data.missing.some(m => m.section === 'a5'));
    const r2 = await s1('POST', '/api/submission/submit', {});
    assert.equal(r2.status, 400, 'tanpa konfirmasi ditolak');
  });

  await t.test('pengumpulan berhasil, ganda dicegah, jawaban terkunci', async () => {
    let r = await s1('PATCH', '/api/submission', { changes: fullAnswers() });
    assert.deepEqual(r.data.rejected, {});
    assert.equal(r.data.progress.percent, 100);
    r = await s1('GET', '/api/submission/pdf', undefined, { raw: true }).then(x => ({ status: x.status }));
    assert.equal(r.status, 403, 'PDF baru tersedia setelah pengumpulan');
    const [a, b] = await Promise.all([s1('POST', '/api/submission/submit', { confirm: true }), s1('POST', '/api/submission/submit', { confirm: true })]);
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    assert.equal([a.data.already, b.data.already].filter(x => x === false).length, 1, 'hanya satu pengumpulan yang tercatat');
    const events = db.all("SELECT * FROM events WHERE type = 'kumpul'");
    assert.equal(events.length, 1);
    r = await s1('PATCH', '/api/submission', { changes: { p1: 'ubah setelah kumpul' } });
    assert.equal(r.status, 409);
    r = await s1('GET', '/api/submission');
    assert.equal(r.data.status, 'submitted');
    assert.ok(r.data.submittedAt);
    assert.equal(r.data.grading.status, 'menunggu');
    assert.equal(r.data.score.auto, r.data.score.autoMax, 'semua jawaban otomatis (bentuk setara) dinilai benar');
    assert.equal(r.data.score.final, null, 'nilai akhir belum tampil sebelum guru selesai menilai');
  });

  await t.test('PDF siswa berisi data tersimpan', async () => {
    const res = await s1('GET', '/api/submission/pdf', undefined, { raw: true });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.subarray(0, 4).toString(), '%PDF');
    assert.ok(buf.length > 10000);
  });

  await t.test('pembahasan tersedia setelah pengumpulan dan menerima bentuk setara', async () => {
    const r = await s1('POST', '/api/submission/check/latihan', {});
    assert.equal(r.status, 200);
    assert.equal(r.data.score, r.data.max);
    const s2c = r.data.items.find(i => i.id === 's2c');
    assert.equal(s2c.answer, '2');
    assert.ok(s2c.explain.length > 10);
  });

  await t.test('guru: daftar, akses kelas lain, penilaian', async () => {
    let r = await guru('GET', `/api/teacher/classes/${t.classA.id}/students`);
    assert.equal(r.status, 200);
    const ani = r.data.students.find(s => s.name === 'Ani Lestari');
    const budi = r.data.students.find(s => s.name === 'Budi Santoso');
    assert.equal(ani.status, 'dikumpulkan');
    assert.equal(ani.percent, 100);
    assert.equal(budi.status, 'belum_mulai');
    t.ani = ani.id;

    const guru2 = client();
    await guru2('POST', '/api/auth/login', { email: 'guru2@uji.id', password: 'sandiguru1' });
    r = await guru2('GET', `/api/teacher/students/${ani.id}`);
    assert.equal(r.status, 404, 'guru lain tidak dapat membuka siswa kelas ini');
    r = await guru2('GET', `/api/teacher/classes/${t.classA.id}/students`);
    assert.equal(r.status, 404);

    r = await guru('GET', `/api/teacher/students/${ani.id}`);
    assert.equal(r.status, 200);
    assert.ok(r.data.rubrics.n1.length > 10);
    const manual = Object.keys(r.data.rubrics);
    r = await guru('PUT', `/api/teacher/students/${ani.id}/grades`, { grades: { n1: { score: 3 } }, status: 'selesai' });
    assert.equal(r.status, 422, 'belum semua uraian diberi skor');
    r = await guru('PUT', `/api/teacher/students/${ani.id}/grades`, { grades: { n1: { score: 9 } }, status: 'proses' });
    assert.equal(r.status, 400, 'skor melebihi maksimum ditolak');
    r = await guru('PUT', `/api/teacher/students/${ani.id}/grades`, { grades: { p1: { score: 1 } }, status: 'proses' });
    assert.equal(r.status, 400, 'pemantik tidak diberi skor');
    r = await guru('PUT', `/api/teacher/students/${ani.id}/grades`, { grades: { n1: { score: 2, comment: 'Lengkapi syarat sudut.' }, r1: { comment: 'Bagus, teruskan.' } }, status: 'proses' });
    assert.equal(r.status, 200);
    let st = await s1('GET', '/api/submission');
    assert.equal(st.data.grading.status, 'menunggu', 'draf penilaian belum terlihat siswa');
    const grades = Object.fromEntries(manual.map(id => [id, { score: 1 }]));
    grades.r1 = { comment: 'Bagus, teruskan.' };
    r = await guru('PUT', `/api/teacher/students/${ani.id}/grades`, { grades, note: 'Kerja yang rapi.', status: 'selesai' });
    assert.equal(r.status, 200);
    st = await s1('GET', '/api/submission');
    assert.equal(st.data.grading.status, 'selesai');
    assert.equal(st.data.grading.grades.r1.comment, 'Bagus, teruskan.');
    assert.ok(typeof st.data.score.final === 'number');
    const pdf = await guru('GET', `/api/teacher/students/${ani.id}/pdf`, undefined, { raw: true });
    assert.equal(pdf.status, 200);
    const csv = await guru('GET', `/api/teacher/classes/${t.classA.id}/csv`, undefined, { raw: true });
    assert.match(await csv.text(), /Ani Lestari/);
  });

  await t.test('pembukaan kembali tercatat dan aktivitas yang sudah diperiksa tetap terkunci', async () => {
    let r = await guru('POST', `/api/teacher/students/${t.ani}/reopen`, { note: '' });
    assert.equal(r.status, 400, 'alasan wajib');
    r = await guru('POST', `/api/teacher/students/${t.ani}/reopen`, { note: 'Perbaiki refleksi nomor 2' });
    assert.equal(r.status, 200);
    const st = await s1('GET', '/api/submission');
    assert.equal(st.data.status, 'reopened');
    assert.ok(st.data.locked.includes('latihan'));
    assert.equal(st.data.reveal.latihan.allowed, false, 'kunci tidak terlihat selama revisi');
    r = await s1('PATCH', '/api/submission', { changes: { s5: '7', r2: 'Saya masih bingung pada faktor skala pecahan.' } });
    assert.ok(r.data.rejected.s5, 'butir di aktivitas yang sudah diperiksa terkunci');
    assert.ok(!r.data.rejected.r2);
    r = await s1('POST', '/api/submission/submit', { confirm: true });
    assert.equal(r.status, 200);
    assert.equal(r.data.already, false);
    const ev = db.all('SELECT type, note FROM events WHERE user_id = ? ORDER BY id', t.ani).map(e => e.type);
    assert.deepEqual(ev.filter(x => ['kumpul', 'buka_kembali'].includes(x)), ['kumpul', 'buka_kembali', 'kumpul']);
  });

  await t.test('mode sebelum pengumpulan: perlu konfirmasi lalu aktivitas terkunci', async () => {
    let r = await guru('PATCH', `/api/teacher/classes/${t.classA.id}`, { feedbackMode: 'sebelum' });
    assert.equal(r.status, 200);
    const a = fullAnswers();
    await s2('PATCH', '/api/submission', { changes: { a1_q1: ['A-B'], a1_q1_alasan: a.a1_q1_alasan, a1_q2: a.a1_q2, a1_q2_alasan: a.a1_q2_alasan } });
    r = await s2('POST', '/api/submission/check/a1', {});
    assert.equal(r.status, 403, 'a1_q3 belum diisi');
    await s2('PATCH', '/api/submission', { changes: { a1_q3: a.a1_q3 } });
    r = await s2('POST', '/api/submission/check/a1', {});
    assert.equal(r.status, 428, 'butuh konfirmasi penguncian');
    r = await s2('POST', '/api/submission/check/a1', { confirmLock: true });
    assert.equal(r.status, 200);
    assert.equal(r.data.items.find(i => i.id === 'a1_q1').correct, false);
    r = await s2('PATCH', '/api/submission', { changes: { a1_q1: ['A-D'] } });
    assert.ok(r.data.rejected.a1_q1, 'tidak dapat mengganti jawaban setelah melihat kunci');
    r = await s2('POST', '/api/submission/check/a3', { confirmLock: true });
    assert.equal(r.status, 403, 'aktivitas lain tetap butuh jawaban lengkap');
  });

  await t.test('mode setelah seluruh kelas mengumpulkan', async () => {
    await guru('PATCH', `/api/teacher/classes/${t.classA.id}`, { feedbackMode: 'setelah_semua' });
    let r = await s1('POST', '/api/submission/check/a3', {});
    assert.equal(r.status, 403, 'Budi belum mengumpulkan');
    const a = fullAnswers();
    delete a.a1_q1; delete a.a1_q1_alasan; delete a.a1_q2; delete a.a1_q2_alasan; delete a.a1_q3;
    r = await s2('PATCH', '/api/submission', { changes: a });
    assert.deepEqual(r.data.rejected, {});
    r = await s2('POST', '/api/submission/submit', { confirm: true });
    assert.equal(r.status, 200);
    r = await s1('POST', '/api/submission/check/a3', {});
    assert.equal(r.status, 200);
  });

  await t.test('atur ulang kata sandi siswa oleh guru', async () => {
    const r = await guru('POST', `/api/teacher/students/${t.ani}/reset-password`, {});
    assert.equal(r.status, 200);
    const old = await s1('GET', '/api/submission');
    assert.equal(old.status, 401, 'sesi lama berakhir');
    const s1b = client();
    const login = await s1b('POST', '/api/auth/login', { email: 'ani@uji.id', password: r.data.password });
    assert.equal(login.status, 200);
  });
});
