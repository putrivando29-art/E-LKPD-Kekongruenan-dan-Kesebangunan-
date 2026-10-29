'use strict';
const crypto = require('node:crypto');

const SESSION_DAYS = 14;
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

// Kode kelas tanpa huruf yang mudah tertukar (O/0, I/1).
function joinCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (const b of crypto.randomBytes(6)) s += alphabet[b % alphabet.length];
  return s;
}

function tempPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (const b of crypto.randomBytes(8)) s += alphabet[b % alphabet.length];
  return s;
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000);
  db.run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    sha256(token), userId, now.toISOString(), expires.toISOString());
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

function userFromRequest(db, req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  const row = db.get(`SELECT u.id, u.email, u.name, u.role, u.class_id, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`, sha256(token));
  if (!row) return null;
  if (row.expires_at < new Date().toISOString()) {
    db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role, classId: row.class_id, token };
}

function destroySession(db, token) {
  db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
}

// Pembatas percobaan masuk sederhana di memori: 10 kegagalan per 15 menit per IP+email.
const failures = new Map();
function tooManyAttempts(key) {
  const now = Date.now();
  const list = (failures.get(key) || []).filter(t => now - t < 15 * 60000);
  failures.set(key, list);
  return list.length >= 10;
}
function recordFailure(key) {
  const list = failures.get(key) || [];
  list.push(Date.now());
  failures.set(key, list);
}
function clearFailures(key) { failures.delete(key); }

module.exports = {
  hashPassword, verifyPassword, newId, joinCode, tempPassword, createSession, sessionCookie,
  clearCookie, userFromRequest, destroySession, tooManyAttempts, recordFailure, clearFailures
};
