'use strict';
// Menjalankan server di komputer sendiri. Tanpa DATABASE_URL, data disimpan di SQLite (data/elkpd.sqlite).
const { open } = require('./db');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3000;
const db = open();
const app = createApp(db, {
  // Aktifkan bila situs berjalan di belakang HTTPS (misalnya hosting dengan reverse proxy).
  secureCookie: process.env.COOKIE_SECURE === '1',
  trustProxy: process.env.TRUST_PROXY === '1'
});

app.listen(PORT, () => {
  console.log(`E-LKPD berjalan di http://localhost:${PORT}`);
  console.log(`Database: ${db.dialect === 'pg' ? 'PostgreSQL (DATABASE_URL)' : process.env.DB_FILE || 'data/elkpd.sqlite'}`);
});
