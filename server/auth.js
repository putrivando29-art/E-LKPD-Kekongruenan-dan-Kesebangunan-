'use strict';
const crypto = require('node:crypto');

const SESSION_DAYS = 7;
const COOKIE = 'elkpd_sesi';

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(actual, expected);
}

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const newId = () => crypto.randomUUID();

// Perbandingan dua teks tanpa membocorkan panjang atau isi lewat waktu proses.
function safeEqual(a, b) {
  return crypto.timingSafeEqual(Buffer.from(sha256(String(a)), 'hex'), Buffer.from(sha256(String(b)), 'hex'));
}

function randomCode(alphabet, n) {
  let s = '';
  for (const b of crypto.randomBytes(n)) s += alphabet[b % alphabet.length];
  return s;
}
// Tanpa huruf yang mudah tertukar (O/0, I/1).
const joinCode = () => randomCode('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
const tempPassword = () => randomCode('abcdefghjkmnpqrstuvwxyz23456789', 8);
const inviteCode = () => `GURU-${randomCode('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4)}-${randomCode('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4)}`;

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* abaikan cookie rusak */ }
  }
  return out;
}

async function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
  await db.run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    sha256(token), userId, now.toISOString(), expires.toISOString());
  // Bersihkan sesi kedaluwarsa milik pengguna ini.
  await db.run('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?', userId, now.toISOString());
  return { token, expires };
}

function sessionCookie(token, expires, secure) {
  const parts = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Expires=${expires.toUTCString()}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearCookie(secure) {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? '; Secure' : ''}`;
}

// Peran pengguna selalu dibaca dari database, tidak pernah dari isian browser.
async function userFromRequest(db, req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  const row = await db.get(`SELECT u.id, u.email, u.name, u.role, u.class_id, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`, sha256(token));
  if (!row) return null;
  if (row.expires_at < new Date().toISOString()) {
    await db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role, classId: row.class_id, token };
}

const destroySession = (db, token) => db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));

// Pembatas percobaan yang disimpan di database, sehingga tetap berlaku di semua instance server.
async function tooManyAttempts(db, key, limit, minutes) {
  const since = new Date(Date.now() - minutes * 60000).toISOString();
  const r = await db.get('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM attempts WHERE key = ? AND at > ?', key, since);
  return Number(r.n) >= limit;
}
async function recordFailure(db, key) {
  await db.run('INSERT INTO attempts (key, at) VALUES (?, ?)', key, new Date().toISOString());
  // Catatan lebih dari satu hari tidak diperlukan lagi.
  await db.run('DELETE FROM attempts WHERE at < ?', new Date(Date.now() - 86400000).toISOString());
}
const clearFailures = (db, key) => db.run('DELETE FROM attempts WHERE key = ?', key);

module.exports = {
  hashPassword, verifyPassword, sha256, safeEqual, newId, joinCode, tempPassword, inviteCode, createSession, sessionCookie,
  clearCookie, userFromRequest, destroySession, tooManyAttempts, recordFailure, clearFailures, SESSION_DAYS
};
