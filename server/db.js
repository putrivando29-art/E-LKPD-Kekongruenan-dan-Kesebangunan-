'use strict';
// Lapisan database. Dua pilihan:
//   - PostgreSQL (misalnya Supabase) bila DATABASE_URL atau POSTGRES_URL diisi. Dipakai di Vercel.
//   - SQLite bawaan Node.js (node:sqlite) untuk menjalankan di komputer sendiri.
// Semua kueri ditulis dengan tanda tanya (?) dan subset SQL yang berlaku di kedua database.
const fs = require('node:fs');
const path = require('node:path');

const TABLES = ['users', 'classes', 'sessions', 'submissions', 'events', 'attempts', 'teacher_invites'];

function schema(pg) {
  const serial = pg ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  return `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('siswa', 'guru')),
  class_id TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  teacher_id TEXT NOT NULL REFERENCES users(id),
  join_code TEXT NOT NULL UNIQUE,
  feedback_mode TEXT NOT NULL DEFAULT 'setelah' CHECK (feedback_mode IN ('sebelum', 'setelah', 'setelah_semua')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  answers TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reopened')),
  checked TEXT NOT NULL DEFAULT '{}',
  key_seen INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  submitted_at TEXT,
  auto_score INTEGER,
  auto_max INTEGER,
  grades TEXT NOT NULL DEFAULT '{}',
  teacher_note TEXT NOT NULL DEFAULT '',
  grading_status TEXT NOT NULL DEFAULT 'belum' CHECK (grading_status IN ('belum', 'proses', 'selesai')),
  graded_at TEXT,
  revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
  id ${serial},
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  type TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attempts (
  id ${serial},
  key TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS teacher_invites (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  hint TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_by TEXT,
  used_at TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_class ON users(class_id);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_key ON attempts(key, at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`;
}

// Supabase membuka skema public lewat API REST untuk peran anon dan authenticated.
// Website ini tidak memakai API itu: semua akses data lewat server. RLS diaktifkan tanpa kebijakan
// sehingga akses langsung dari luar (misalnya dengan anon key) tidak dapat membaca atau menulis apa pun.
const PG_LOCKDOWN = `
${TABLES.map(t => `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`).join('\n')}
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ${TABLES.join(', ')} FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ${TABLES.join(', ')} FROM authenticated';
  END IF;
END $$;
`;

const toPg = sql => { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); };

function openPg(url) {
  const { Pool } = require('pg');
  const u = new URL(url);
  const local = ['localhost', '127.0.0.1', ''].includes(u.hostname) || u.searchParams.get('sslmode') === 'disable';
  u.searchParams.delete('sslmode');
  // Supabase mewajibkan SSL. Sertifikat CA dapat diberikan lewat DATABASE_CA_CERT agar sertifikat server diverifikasi.
  const ssl = local ? false : process.env.DATABASE_CA_CERT
    ? { ca: process.env.DATABASE_CA_CERT.replace(/\\n/g, '\n'), rejectUnauthorized: true }
    : { rejectUnauthorized: false };
  const pool = new Pool({ connectionString: u.toString(), ssl, max: Number(process.env.DATABASE_POOL_MAX) || 3, idleTimeoutMillis: 10000 });
  pool.on('error', e => console.error('Koneksi database terputus:', e.message));

  const bind = q => ({
    async get(sql, ...p) { return (await q(toPg(sql), p)).rows[0]; },
    async all(sql, ...p) { return (await q(toPg(sql), p)).rows; },
    async run(sql, ...p) { const r = await q(toPg(sql), p); return { changes: r.rowCount }; }
  });
  const db = {
    dialect: 'pg',
    forUpdate: ' FOR UPDATE',
    ...bind((s, p) => pool.query(s, p)),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn({ ...bind((s, p) => client.query(s, p)), forUpdate: ' FOR UPDATE' });
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end()
  };
  // Beberapa instance Vercel dapat mulai bersamaan; kunci advisory mencegah pembuatan tabel ganda.
  db.ready = (async () => {
    await pool.query(`BEGIN; SELECT pg_advisory_xact_lock(820814); ${schema(true)} ${PG_LOCKDOWN} COMMIT;`);
  })();
  db.ready.catch(e => console.error('Gagal menyiapkan tabel database:', e.message));
  return db;
}

function openSqlite(file) {
  const { DatabaseSync } = require('node:sqlite');
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') raw.exec('PRAGMA journal_mode = WAL;');
  raw.exec('PRAGMA busy_timeout = 5000;');
  raw.exec(schema(false));
  const cache = new Map();
  const stmt = sql => { let s = cache.get(sql); if (!s) { s = raw.prepare(sql); cache.set(sql, s); } return s; };
  const plain = r => (r ? { ...r } : r);
  const api = {
    async get(sql, ...p) { return plain(stmt(sql).get(...p)); },
    async all(sql, ...p) { return stmt(sql).all(...p).map(plain); },
    async run(sql, ...p) { const r = stmt(sql).run(...p); return { changes: Number(r.changes) }; }
  };
  // Transaksi dijalankan berurutan agar pernyataan dari permintaan lain tidak ikut masuk.
  let queue = Promise.resolve();
  return {
    dialect: 'sqlite',
    forUpdate: '',
    ...api,
    tx(fn) {
      const run = queue.then(async () => {
        raw.exec('BEGIN IMMEDIATE');
        try { const out = await fn({ ...api, forUpdate: '' }); raw.exec('COMMIT'); return out; }
        catch (e) { raw.exec('ROLLBACK'); throw e; }
      });
      queue = run.catch(() => {});
      return run;
    },
    ready: Promise.resolve(),
    close: async () => raw.close()
  };
}

function open(file) {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url && file !== ':memory:') return openPg(url);
  return openSqlite(file || process.env.DB_FILE || path.join(__dirname, '..', 'data', 'elkpd.sqlite'));
}

module.exports = { open, openPg, openSqlite };
