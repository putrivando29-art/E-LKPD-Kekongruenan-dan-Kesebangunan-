'use strict';
// Titik masuk Vercel Function. Semua permintaan /api/* diarahkan ke sini oleh vercel.json.
// Database: PostgreSQL dari DATABASE_URL (misalnya Supabase). SQLite tidak dapat dipakai di Vercel
// karena disk Vercel tidak menyimpan data secara permanen.
const { open } = require('../server/db');
const { createApp } = require('../server/app');

const configured = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
if (!configured) console.error('DATABASE_URL belum diisi di Environment Variables Vercel.');
const app = configured ? createApp(open(), { secureCookie: true, trustProxy: true }) : null;

module.exports = (req, res) => {
  if (!app) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Server belum terhubung ke database. Pengelola website perlu mengisi DATABASE_URL di pengaturan Vercel.' }));
    return;
  }
  // Rewrite di vercel.json mengirim path asli lewat parameter __p. Jika Vercel sudah meneruskan URL asli,
  // cukup buang parameter itu.
  const url = new URL(req.url, 'http://lokal');
  const p = url.searchParams.get('__p');
  if (p !== null) {
    url.searchParams.delete('__p');
    const rewritten = url.pathname === '/api' || url.pathname === '/api/index';
    const qs = url.searchParams.toString();
    req.url = `${rewritten ? `/api/${p}` : url.pathname}${qs ? `?${qs}` : ''}`;
  }
  return app(req, res);
};
