// Uji antarmuka di browser (Playwright + Chromium) terhadap server yang sedang berjalan.
// Pemakaian: KODE_AKSES_GURU=... node test/ui-flow.js http://localhost:3000 folder-tangkapan-layar
// Server harus dijalankan dengan KODE_AKSES_GURU yang sama.
'use strict';
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');

const [base, outDir] = process.argv.slice(2);
const ACCESS = process.env.KODE_AKSES_GURU;
const guruEmail = `guru${Date.now()}@uji.id`;
const guruPass = 'sandiguru-uji';
let code;
fs.mkdirSync(outDir, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
const log = (...a) => console.log('•', ...a);
const errors = [];
const RUN = String(Date.now()).slice(-5);
const DEWI = `Dewi Anggraini ${RUN}`;
const expected = [];

async function noOverflow(page, label) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  if (o.sw > o.w + 1) throw new Error(`${label}: halaman melebar ${o.sw}px > ${o.w}px`);
}

async function fillVisibleSection(page) {
  for (const ta of await page.locator('.q textarea:not([disabled])').all()) {
    if (!(await ta.inputValue())) await ta.fill('Jawaban saya berdasarkan pengamatan bangun dan simulasi.');
  }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  // Galat jaringan yang memang diharapkan (validasi 4xx, mode luring) dicatat terpisah.
  page.on('console', m => { if (m.type() === 'error') (/Failed to load resource/.test(m.text()) ? expected : errors).push(`[console] ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));

  await page.goto(base + '/#/');
  await page.waitForSelector('.hero');
  await shot(page, '01-beranda');
  log('Beranda tampil');

  // ---------- Guru baru mendaftar dengan kode akses ----------
  await page.click('text=Masuk sebagai Guru');
  await page.click('text=Daftar pakai kode akses guru');
  await page.fill('[name=name]', 'Bu Sari Uji');
  await page.fill('[name=email]', guruEmail);
  await page.fill('[name=password]', guruPass);
  await page.fill('[name=accessCode]', 'kode-tebakan');
  await page.click('[data-account] button');
  await page.waitForSelector('[data-err=accessCode]:not(:empty)');
  log('Kode akses salah ditolak server:', await page.textContent('.form-error'));
  await page.fill('[name=accessCode]', ACCESS);
  await page.click('[data-account] button');
  await page.waitForSelector('[data-new-class]');
  await page.fill('[data-new-class] [name=name]', 'VIII Uji');
  await page.click('[data-new-class] button');
  await page.waitForSelector('.class-info .code');
  code = (await page.textContent('.class-info .code')).trim();
  log('Guru terdaftar dan membuat kelas, kode kelas:', code);
  await shot(page, '00-dasbor-awal');
  await page.click('#logout');
  await page.waitForSelector('.hero');

  await page.click('text=Mulai Belajar');
  await page.waitForSelector('[data-login]');
  log('Mulai Belajar tanpa sesi -> halaman masuk siswa');
  await page.click('text=Daftar pakai kode kelas');
  await page.fill('[name=name]', DEWI);
  await page.fill('[name=email]', `dewi${Date.now()}@uji.id`);
  await page.fill('[name=password]', 'pendek');
  await page.fill('[name=classCode]', code);
  await page.click('[data-account] button');
  await page.waitForSelector('[data-err=password]:not(:empty)');
  log('Validasi kata sandi pendek tampil');
  await page.fill('[name=password]', 'sandidewi1');
  await page.click('[data-account] button');
  await page.waitForSelector('#section-title:has-text("Kenalan")');
  log('Daftar berhasil -> bagian Petunjuk');

  await page.fill('#f-id_absen', '7');
  await page.check('#f-id_baca');
  await page.waitForSelector('#save-status[data-kind=saved]');
  await shot(page, '02-petunjuk');

  await page.goto(base + '/#/lkpd/a1');
  await page.waitForSelector('.gate');
  log('Aktivitas 1 dikunci sampai pemantik dijawab');
  await page.click('text=Buka Pemanasan');
  await page.fill('#f-p1', '   ');
  await page.waitForTimeout(300);
  const chip = await page.textContent('[data-item=p1] .q-chip');
  if (!/minimal 3/.test(chip)) throw new Error('isian spasi dianggap terisi: ' + chip);
  log('Isian spasi tidak dianggap terisi:', chip);
  await fillVisibleSection(page);
  await page.fill('#f-p1', 'Ya, dua buku tulis yang sama.');
  await page.waitForSelector('#save-status[data-kind=saved]');

  // Muat ulang halaman: jawaban harus tetap ada.
  await page.reload();
  await page.waitForSelector('#f-p1');
  if ((await page.inputValue('#f-p1')) !== 'Ya, dua buku tulis yang sama.') throw new Error('jawaban hilang setelah muat ulang');
  log('Jawaban tetap ada setelah muat ulang');

  // Koneksi terputus
  await ctx.setOffline(true);
  await page.fill('#f-p2', 'Belum tentu, karena ukurannya berbeda walau bentuknya mirip.');
  await page.waitForSelector('#save-status[data-kind=offline]', { timeout: 8000 });
  log('Status offline:', await page.textContent('#save-status'));
  await shot(page, '03-offline');
  await ctx.setOffline(false);
  await page.waitForSelector('#save-status[data-kind=saved]', { timeout: 15000 });
  log('Tersambung lagi -> tersimpan:', await page.textContent('#save-status'));

  // Aktivitas 1
  await page.click('.pager >> text=Selanjutnya');
  await page.waitForSelector('.obs-svg polygon');
  await page.check('[data-measure]');
  await page.click('[data-zoom="1"]');
  await page.click('.compare summary');
  await page.selectOption('[data-pick=y]', 'C');
  await page.click('[data-cmp=stack]');
  await shot(page, '04-aktivitas1');
  await page.click('[data-zoom="-1"]');
  await page.check('[name=f-a1_q1][value=A-D]');
  await page.check('[name=f-a1_q2][value=A-C]');
  await page.check('[name=f-a1_q2][value=C-D]');
  await fillVisibleSection(page);
  const reason = await page.textContent('[data-check] .check-reason');
  log('Panel periksa (mode setelah):', reason.trim());
  await page.click('[data-run-check]', { force: true });
  log('Klik Periksa sebelum kumpul:', (await page.textContent('[data-check] .check-reason')).trim());

  // Aktivitas 2
  await page.click('.pager >> text=Selanjutnya');
  await page.waitForSelector('#f-a2_q1');
  await fillVisibleSection(page);

  // Aktivitas 3: simulasi
  await page.click('.pager >> text=Selanjutnya');
  await page.waitForSelector('[data-sim=congruence] polygon');
  const simA = page.locator('[data-sim=congruence]');
  const def = simA.locator('g.draggable polygon.tri');
  const box = await def.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2 + 20, { steps: 8 });
  await page.mouse.up();
  const status1 = await simA.locator('.result-cards').textContent();
  if (!/digeser/.test(status1)) throw new Error('DEF tidak bergeser: ' + status1);
  const h = await simA.locator('.handle').boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 80, h.y + 60, { steps: 6 });
  await page.mouse.up();
  await simA.locator('[data-act=mirror]').click();
  const tbl = await simA.locator('.sim-result tbody').textContent();
  if ((tbl.match(/Beda/g) || []).length) throw new Error('DEF kongruen tetapi tabel menunjukkan berbeda setelah digeser/diputar/dicermin');
  log('Geser, putar, cermin: semua pasangan tetap "Sama". Keadaan:', (await simA.locator('.result-cards').textContent()).slice(0, 90));
  await simA.locator('[data-act=record]').click();
  await simA.locator('[data-act=snap]').click();
  await shot(page, '05-simA-impit');
  await simA.locator('[data-side=ef]').fill('9');
  const tbl2 = await simA.locator('.sim-result tbody').textContent();
  log('EF diubah ke 9 cm -> jumlah "Beda":', (tbl2.match(/Beda/g) || []).length);
  await simA.locator('#simA-note').fill('EF diperbesar menjadi 9 cm');
  await simA.locator('[data-act=record]').click();
  // Sisi tidak valid
  await simA.locator('[data-side=de]').fill('2');
  await simA.locator('[data-side=ef]').fill('3');
  await simA.locator('[data-side=fd]').fill('10');
  log('Sisi tidak valid:', (await simA.locator('.sim-warning').textContent()).slice(0, 70));
  await simA.locator('[data-act=reset]').click();

  const simB = page.locator('[data-sim=similarity]');
  await simB.locator('[data-k]').fill('2');
  const sb = await simB.locator('.sim-result').textContent();
  if (!/6 cm/.test(sb) || !/8 cm/.test(sb) || !/10 cm/.test(sb)) throw new Error('k = 2 tidak menghasilkan 6, 8, 10 cm');
  log('k = 2 -> STU 6, 8, 10 cm;', (await simB.locator('.sim-status').textContent()).replace(/\s+/g, ' ').trim());
  await simB.locator('#simB-note').fill('k = 2');
  await simB.locator('[data-act=record]').click();
  await simB.locator('input[value=bebas]').check();
  await simB.locator('[data-side=tu]').fill('10');
  log('Mode bebas TU = 10:', (await simB.locator('.sim-status').textContent()).replace(/\s+/g, ' ').trim());
  await simB.locator('[data-act=record]').click();
  await shot(page, '06-simB');
  await page.check('[name=f-a3a_q3][value=tidak]');
  await page.check('[name=f-a3b_q2][value=tetap]');
  await page.fill('#f-a3b_q4_pq', '3 : 6');
  await page.fill('#f-a3b_q4_qr', '1/2');
  await page.fill('#f-a3b_q4_pr', '0,5');
  await fillVisibleSection(page);

  // Latihan
  await page.click('.pager >> text=Selanjutnya');
  await page.waitForSelector('#f-s5');
  const radios = { s1a: 'ya', s1c: 'sss', s2a: 'ya', s3: 'sebangun', s4_1: 'benar', s4_2: 'salah', s4_3: 'benar', s4_4: 'salah', s4_5: 'benar' };
  for (const [k, v] of Object.entries(radios)) await page.check(`[name=f-${k}][value=${v}]`);
  await page.fill('#f-s2b_pq', '1 : 2');
  await page.fill('#f-s2b_qr', '4:8');
  await page.fill('#f-s2b_pr', '5 banding 10');
  await page.fill('#f-s2c', '2');
  await page.fill('#f-s5', '6');
  await page.fill('#f-s6', '60');
  await page.fill('#f-s7', 'lima belas');
  await page.waitForTimeout(200);
  log('Isian bilangan berupa kata:', await page.textContent('[data-item=s7] .q-chip'));
  await page.fill('#f-s7', '15');
  await fillVisibleSection(page);
  await shot(page, '07-latihan');

  for (const sec of ['a4', 'a5']) {
    await page.click('.pager >> text=Selanjutnya');
    await page.waitForSelector(`[data-toc=${sec}].active`);
    await fillVisibleSection(page);
  }
  // Kosongkan satu jawaban refleksi untuk menguji pengumpulan yang belum lengkap
  await page.fill('#f-r4', '');
  await page.click('.pager >> text=Selanjutnya');
  await page.waitForSelector('[data-submit]');
  await page.click('[data-submit]', { force: true });
  await page.waitForSelector('.submit-msg .form-error');
  log('Kumpulkan saat belum lengkap:', (await page.textContent('.submit-msg')).trim());
  log('Daftar yang belum diisi:', (await page.textContent('.missing')).replace(/\s+/g, ' ').trim().slice(0, 120));
  await shot(page, '08-ringkasan-belum');
  await page.click('.missing a');
  await page.fill('#f-r4', 'Saya membandingkan sisi dan sudut yang bersesuaian.');
  await page.click('[data-toc=ringkasan] a');
  await page.waitForSelector('[data-submit]:not([aria-disabled])');
  await page.click('[data-submit]');
  await page.click('dialog >> text=Batal');
  log('Konfirmasi dibatalkan: masih', await page.textContent('[data-submit]'));
  await page.click('[data-submit]');
  await page.click('dialog >> text=Ya, kumpulkan');
  await page.waitForSelector('.done-card');
  log('Pengumpulan berhasil:', (await page.textContent('.done-card dl')).replace(/\s+/g, ' ').trim());
  const [dlA] = await Promise.all([page.waitForEvent('download'), page.click('[data-pdf]')]);
  const pdfPath = path.join(outDir, 'siswa-unduh.pdf');
  await dlA.saveAs(pdfPath);
  log('PDF siswa diunduh:', path.basename(dlA.suggestedFilename()), fs.statSync(pdfPath).size, 'byte');
  await shot(page, '09-ringkasan-selesai');

  // Pembahasan setelah pengumpulan (mode setelah)
  await page.click('[data-toc=latihan] a');
  await page.waitForSelector('[data-run-check]');
  if (await page.locator('textarea:not([disabled])').count()) throw new Error('isian masih dapat diubah setelah dikumpulkan');
  await page.click('[data-run-check]');
  await page.waitForSelector('.check-result .score-line');
  log('Periksa setelah kumpul:', await page.textContent('.check-result'));
  await page.click('[data-show-key]');
  await page.waitForSelector('[data-item=s4_5] .fb-key');
  await shot(page, '10-pembahasan');
  log('Pembahasan s4_5:', (await page.textContent('[data-item=s4_5] .q-feedback')).replace(/\s+/g, ' ').trim().slice(0, 100));

  // Siswa tidak boleh membuka halaman guru
  await page.goto(base + '/#/guru');
  await page.waitForFunction(() => location.hash === '#/lkpd/petunjuk');
  log('Siswa membuka #/guru -> diarahkan ke', await page.evaluate(() => location.hash), '| toast:', await page.textContent('#toast'));
  const apiTry = await page.evaluate(async () => {
    const out = {};
    for (const [m, p] of [['GET', '/api/teacher/classes'], ['POST', '/api/teacher/invites'], ['GET', '/api/teacher/invites']]) {
      const r = await fetch(p, { method: m, headers: { 'X-ELKPD': '1', 'Content-Type': 'application/json' }, body: m === 'POST' ? '{}' : undefined });
      out[`${m} ${p}`] = r.status;
    }
    return out;
  });
  log('Siswa memanggil API guru langsung:', JSON.stringify(apiTry));
  if (Object.values(apiTry).some(x => x !== 403)) throw new Error('API guru dapat diakses siswa');
  await page.click('#logout');
  await page.waitForSelector('.hero');

  // ---------- Guru ----------
  await page.click('text=Masuk sebagai Guru');
  await page.fill('[name=email]', guruEmail);
  await page.fill('[name=password]', guruPass);
  await page.click('[data-login] button');
  await page.waitForSelector('.students');
  await shot(page, '11-dasbor-guru');
  log('Dasbor guru:', (await page.locator('.students tbody tr').first().textContent()).replace(/\s+/g, ' ').trim());
  const row = page.locator('.students tbody tr', { hasText: DEWI });
  const [dlT] = await Promise.all([page.waitForEvent('download'), row.locator('[data-pdf]').click()]);
  log('PDF dari dasbor guru:', dlT.suggestedFilename());
  await row.locator('text=Lihat Hasil').click();
  await page.waitForSelector('.review-section');
  for (const inp of await page.locator('[name=score]').all()) await inp.fill('1');
  await page.locator('[data-grade=n1] [name=comment]').fill('Tambahkan syarat sudut yang sama besar.');
  await page.click('[data-save=selesai]');
  await page.click('dialog >> text=Ya, tampilkan ke siswa');
  await page.waitForSelector('text=Status penilaian');
  await page.waitForFunction(() => /Selesai/.test(document.querySelector('.student-summary')?.textContent));
  log('Penilaian selesai. Ringkasan:', (await page.textContent('.student-summary dl')).replace(/\s+/g, ' ').trim().slice(0, 220));
  await shot(page, '12-hasil-siswa-guru');
  await page.click('[data-reopen]');
  await page.click('dialog button[value=ok]');
  log('Buka kembali tanpa alasan:', await page.textContent('dialog .form-error'));
  await page.fill('dialog [name=note]', 'Perbaiki jawaban refleksi nomor 2.');
  await page.click('dialog button[value=ok]');
  await page.waitForFunction(() => /Dibuka kembali/.test(document.querySelector('.student-summary')?.textContent));
  log('Status setelah dibuka kembali:', (await page.textContent('.student-summary dd')).trim());
  await page.click('#logout');

  // ---------- Tampilan HP (layar sentuh) ----------
  const m = await browser.newContext({ viewport: { width: 375, height: 760 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const mp = await m.newPage();
  mp.on('pageerror', e => errors.push(`[pageerror hp] ${e.message}`));
  await mp.goto(base + '/#/');
  await mp.waitForSelector('.hero');
  await noOverflow(mp, 'beranda HP');
  await shot(mp, '13-hp-beranda');
  await mp.click('text=Mulai Belajar');
  await mp.fill('[name=email]', guruEmail);
  await mp.fill('[name=password]', guruPass);
  await mp.click('[data-login] button');
  await mp.waitForSelector('.form-error:not([hidden])');
  log('Akun guru lewat pintu siswa:', await mp.textContent('.form-error'));
  await mp.click('text=Daftar pakai kode kelas');
  await mp.fill('[name=name]', 'Eko Prasetyo');
  await mp.fill('[name=email]', `eko${Date.now()}@uji.id`);
  await mp.fill('[name=password]', 'sandieko12');
  await mp.fill('[name=classCode]', code);
  await mp.click('[data-account] button');
  await mp.waitForSelector('#f-id_absen');
  await noOverflow(mp, 'petunjuk HP');
  await shot(mp, '14-hp-petunjuk');
  // pemantik diisi agar aktivitas terbuka
  await mp.goto(base + '/#/lkpd/pemantik');
  await mp.waitForSelector('#f-p1');
  for (const id of ['p1', 'p2', 'p3', 'p4']) await mp.fill(`#f-${id}`, 'Jawaban percobaan dari HP.');
  await mp.goto(base + '/#/lkpd/a3');
  await mp.waitForSelector('[data-sim=congruence] polygon');
  await noOverflow(mp, 'aktivitas 3 HP');
  // Seret dengan sentuhan
  const tri = mp.locator('[data-sim=congruence] g.draggable polygon.tri');
  await tri.scrollIntoViewIfNeeded();
  const tb = await tri.boundingBox();
  const cx = tb.x + tb.width / 2, cy = tb.y + tb.height / 2;
  await mp.evaluate(({ cx, cy }) => {
    const target = document.elementFromPoint(cx, cy);
    const opts = (x, y) => ({ bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, isPrimary: true });
    target.dispatchEvent(new PointerEvent('pointerdown', opts(cx, cy)));
    for (let i = 1; i <= 5; i++) target.dispatchEvent(new PointerEvent('pointermove', opts(cx - i * 10, cy + i * 4)));
    target.dispatchEvent(new PointerEvent('pointerup', opts(cx - 50, cy + 20)));
  }, { cx, cy });
  log('Seret sentuh di HP:', (await mp.textContent('[data-sim=congruence] .result-cards')).slice(0, 60));
  await shot(mp, '15-hp-simulasi');
  await mp.goto(base + '/#/lkpd/a1');
  await mp.waitForSelector('.obs-svg polygon');
  await noOverflow(mp, 'aktivitas 1 HP');
  await shot(mp, '16-hp-aktivitas1');

  await browser.close();
  if (errors.length) { console.log('GALAT KONSOL:\n' + errors.join('\n')); process.exit(1); }
  console.log(`Selesai tanpa galat konsol (${expected.length} galat jaringan yang diharapkan: validasi 4xx dan mode luring).`);
})().catch(e => { console.error('GAGAL:', e.message); console.log(errors.join('\n')); process.exit(1); });
