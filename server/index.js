'use strict';
const path = require('node:path');
const { open } = require('./db');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'elkpd.sqlite');

const db = open(DB_FILE);
const app = createApp(db, {
  // Aktifkan bila situs berjalan di belakang HTTPS (misalnya hosting dengan reverse proxy).
  secureCookie: process.env.COOKIE_SECURE === '1',
  trustProxy: process.env.TRUST_PROXY === '1'
});

app.listen(PORT, () => {
  console.log(`E-LKPD berjalan di http://localhost:${PORT}`);
  console.log(`Database: ${DB_FILE}`);
});
