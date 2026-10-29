'use strict';
// Membuat atau memperbarui akun guru. Akun guru tidak dapat dibuat dari website.
// Pemakaian: npm run buat-guru -- --email guru@sekolah.sch.id --nama "Nama Guru" [--kelas "VIII A"]
// Kata sandi ditanyakan di terminal (atau lewat variabel lingkungan GURU_PASSWORD).
const path = require('node:path');
const readline = require('node:readline');
const { open } = require('../server/db');
const auth = require('../server/auth');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(question, a => { rl.close(); res(a); }));
}

(async () => {
  const email = (arg('email') || '').trim().toLowerCase();
  const name = (arg('nama') || '').trim();
  const kelas = arg('kelas');
  if (!email || !name) {
    console.error('Pemakaian: npm run buat-guru -- --email guru@sekolah.sch.id --nama "Nama Guru" [--kelas "VIII A"]');
    process.exit(1);
  }
  const password = process.env.GURU_PASSWORD || await ask('Kata sandi guru (minimal 8 karakter): ');
  if (password.length < 8) { console.error('Kata sandi minimal 8 karakter.'); process.exit(1); }

  const db = open(process.env.DB_FILE || path.join(__dirname, '..', 'data', 'elkpd.sqlite'));
  const existing = db.get('SELECT * FROM users WHERE email = ?', email);
  let id;
  if (existing) {
    if (existing.role !== 'guru') { console.error('Email ini sudah dipakai akun siswa.'); process.exit(1); }
    id = existing.id;
    db.run('UPDATE users SET name = ?, password_hash = ? WHERE id = ?', name, auth.hashPassword(password), id);
    console.log(`Akun guru ${email} diperbarui.`);
  } else {
    id = auth.newId();
    db.run('INSERT INTO users (id, email, name, role, class_id, password_hash, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?)',
      id, email, name, 'guru', auth.hashPassword(password), new Date().toISOString());
    console.log(`Akun guru ${email} dibuat.`);
  }
  if (kelas) {
    let code;
    do { code = auth.joinCode(); } while (db.get('SELECT 1 FROM classes WHERE join_code = ?', code));
    db.run('INSERT INTO classes (id, name, teacher_id, join_code, feedback_mode, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      auth.newId(), kelas, id, code, 'setelah', new Date().toISOString());
    console.log(`Kelas "${kelas}" dibuat. Kode kelas untuk pendaftaran siswa: ${code}`);
  }
  db.close();
})();
