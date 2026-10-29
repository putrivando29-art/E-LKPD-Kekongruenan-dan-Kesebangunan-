// Dasbor guru: kelas, daftar siswa, hasil per siswa, penilaian, pembukaan kembali, unduhan.
import { api, download, local } from './api.js';
import { esc, fmtTime, toast, confirmDialog, formDialog, sectionItems } from './ui.js';
import { fmt } from './geo.js';
import { icon } from './art.js';

const STATUS = { belum_mulai: 'Belum mulai', mengerjakan: 'Sedang mengerjakan', dikumpulkan: 'Dikumpulkan', dibuka_kembali: 'Dibuka kembali' };
const GRADING = { belum: 'Belum dinilai', proses: 'Sedang dinilai', selesai: 'Selesai' };
const MODES = {
  sebelum: 'Sebelum pengumpulan (setelah aktivitas lengkap, aktivitas lalu terkunci)',
  setelah: 'Setelah siswa mengumpulkan',
  setelah_semua: 'Setelah seluruh kelas mengumpulkan'
};
const EVENTS = { daftar: 'Mendaftar', kumpul: 'Mengumpulkan', buka_kembali: 'Dibuka kembali', periksa: 'Memeriksa jawaban', nilai_selesai: 'Penilaian selesai', atur_sandi: 'Kata sandi diatur ulang' };

async function dl(btn, path) {
  btn.disabled = true;
  try { await download(path); } catch (e) { toast(e.message, 'error'); }
  btn.disabled = false;
}

export async function renderDashboard(view, app, classId) {
  view.innerHTML = '<p class="loading" role="status">Memuat data kelas...</p>';
  let classes;
  try { classes = (await api('/api/teacher/classes')).classes; }
  catch (e) { view.innerHTML = `<div class="card error-card"><h1>Data kelas gagal dimuat</h1><p>${esc(e.message)}</p><button class="btn" onclick="location.reload()">Muat ulang</button></div>`; return; }

  const remembered = local.get('elkpd.guru.kelas');
  const active = classes.find(c => c.id === classId) || classes.find(c => c.id === remembered) || classes[0];
  view.innerHTML = `
    <div class="teacher">
      <header class="section-head" data-accent="lilac">
        <span class="section-badge" aria-hidden="true">${icon('book')}</span>
        <h1 id="section-title" tabindex="-1">Dasbor Guru</h1>
        <p class="lead">Pantau, buka hasil, dan nilai LKPD siswa. Semua guru melihat kelas yang sama.</p>
      </header>
      <div class="card class-bar">
        ${classes.length ? `<label class="field-inline">Kelas
          <select data-class>${classes.map(c => `<option value="${c.id}" ${active && c.id === active.id ? 'selected' : ''}>${esc(c.name)} (${c.submitted}/${c.students} mengumpulkan)</option>`).join('')}</select></label>` : '<p>Belum ada kelas. Buat kelas pertama Anda, lalu bagikan kodenya kepada siswa.</p>'}
        <form class="new-class" data-new-class>
          <label class="field-inline">Kelas baru <input name="name" maxlength="40" placeholder="misalnya VIII A" required></label>
          <button class="btn">Buat kelas</button>
        </form>
      </div>
      <div data-class-body></div>
      <div class="two-col">
        <section class="card" data-invites></section>
        <section class="card">
          <h2>${icon('lock')} Keamanan akun</h2>
          <p>Akun guru hanya bisa dibuat dengan kode akses atau undangan. Siswa tidak dapat membuka dasbor ini.</p>
          <button type="button" class="btn btn-soft" data-logout-all>Keluar dari semua perangkat</button>
        </section>
      </div>
    </div>`;

  view.querySelector('[data-class]')?.addEventListener('change', e => { location.hash = `#/guru/kelas/${e.target.value}`; });
  view.querySelector('[data-new-class]').addEventListener('submit', async e => {
    e.preventDefault();
    const name = e.target.elements.name.value.trim();
    if (!name) { toast('Nama kelas wajib diisi.', 'error'); return; }
    try {
      const res = await api('/api/teacher/classes', { method: 'POST', body: { name } });
      toast(`Kelas ${res.class.name} dibuat. Kode kelas: ${res.class.join_code}`);
      location.hash = `#/guru/kelas/${res.class.id}`;
      if (classId === res.class.id) renderDashboard(view, app, res.class.id);
    } catch (err) { toast(err.message, 'error'); }
  });
  if (active) {
    local.set('elkpd.guru.kelas', active.id);
    renderClass(view.querySelector('[data-class-body]'), active);
  }
  renderInvites(view.querySelector('[data-invites]'));
  view.querySelector('[data-logout-all]').addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Keluar dari semua perangkat?', body: '<p>Semua sesi akun ini berakhir, termasuk di perangkat ini.</p>', ok: 'Ya, keluar semua' });
    if (!ok) return;
    try { await api('/api/auth/logout-all', { method: 'POST', body: {} }); } catch (e) { toast(e.message, 'error'); return; }
    app.setUser(null);
    location.hash = '#/masuk/guru';
  });
}

async function renderClass(box, cls) {
  box.innerHTML = '<p class="loading" role="status">Memuat daftar siswa...</p>';
  let data;
  try { data = await api(`/api/teacher/classes/${cls.id}/students`); }
  catch (e) { box.innerHTML = `<div class="card error-card"><p>${esc(e.message)}</p></div>`; return; }
  const c = data.class;
  const rows = data.students.map(s => `
    <tr>
      <th scope="row">${esc(s.name)}<span class="muted small block">${esc(s.email)}</span></th>
      <td>${esc(c.name)}</td>
      <td><span class="status-pill s-${s.status}">${STATUS[s.status]}</span></td>
      <td><div class="mini-bar" aria-hidden="true"><div style="width:${s.percent}%"></div></div>${s.percent}%</td>
      <td>${s.submittedAt ? esc(fmtTime(s.submittedAt)) : '-'}</td>
      <td>${s.auto !== null ? `${s.auto}/${s.autoMax}` : '-'}</td>
      <td>${s.status === 'dikumpulkan' || s.grading !== 'belum' ? `${GRADING[s.grading]}${s.finalScore !== null ? `, nilai ${fmt(s.finalScore)}` : ''}` : '-'}</td>
      <td class="actions">
        <a class="btn btn-small" href="#/guru/siswa/${s.id}">Lihat Hasil</a>
        <button type="button" class="btn btn-small" data-pdf="${s.id}" ${s.status === 'belum_mulai' && s.percent === 0 ? 'disabled title="Siswa belum mulai mengerjakan"' : ''}>Unduh PDF</button>
      </td>
    </tr>`).join('');
  box.innerHTML = `
    <div class="card class-info">
      <div>
        <h2>${esc(c.name)}</h2>
        <p>Kode kelas untuk pendaftaran siswa: <strong class="code">${esc(c.join_code)}</strong></p>
        <p class="muted small">${data.students.length} siswa terdaftar. ${data.allSubmitted ? 'Seluruh siswa sudah mengumpulkan.' : ''}${c.teacher_name ? ` Dibuat oleh ${esc(c.teacher_name)}.` : ''}</p>
        <button type="button" class="btn btn-small btn-danger" data-delete-class>Hapus kelas</button>
      </div>
      <label class="field">
        <span>Jawaban benar dan pembahasan tersedia untuk siswa</span>
        <select data-mode>${Object.entries(MODES).map(([k, v]) => `<option value="${k}" ${c.feedback_mode === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
      </label>
    </div>
    <div class="card">
      <div class="table-head">
        <h2>Daftar siswa</h2>
        <div><button type="button" class="btn btn-small" data-refresh>Muat ulang</button> <button type="button" class="btn btn-small" data-csv>Unduh rekap (CSV)</button></div>
      </div>
      ${data.students.length ? `<div class="table-scroll"><table class="data-table students">
        <thead><tr><th scope="col">Nama siswa</th><th scope="col">Kelas</th><th scope="col">Status</th><th scope="col">Penyelesaian</th><th scope="col">Waktu pengumpulan</th><th scope="col">Skor otomatis</th><th scope="col">Penilaian guru</th><th scope="col">Aksi</th></tr></thead>
        <tbody>${rows}</tbody></table></div>` : `<p class="empty">Belum ada siswa di kelas ini. Bagikan kode kelas <strong>${esc(c.join_code)}</strong> agar siswa dapat mendaftar.</p>`}
    </div>`;
  box.querySelector('[data-mode]').addEventListener('change', async e => {
    try {
      await api(`/api/teacher/classes/${c.id}`, { method: 'PATCH', body: { feedbackMode: e.target.value } });
      toast('Pengaturan pembahasan disimpan.');
    } catch (err) { toast(err.message, 'error'); e.target.value = c.feedback_mode; }
  });
  box.querySelector('[data-refresh]').addEventListener('click', () => renderClass(box, cls));
  box.querySelector('[data-delete-class]').addEventListener('click', async () => {
    const n = data.students.length;
    const r = await formDialog({
      title: `Hapus kelas ${c.name}?`,
      intro: `<p>${n ? `<strong>${n} akun siswa</strong> di kelas ini beserta semua jawaban, nilai, dan riwayatnya akan ikut terhapus.` : 'Kelas ini belum punya siswa.'} Tindakan ini tidak bisa dibatalkan.</p><p>Ketik nama kelas <strong>${esc(c.name)}</strong> untuk konfirmasi.</p>`,
      fields: [{ name: 'confirmName', label: 'Nama kelas', required: true }],
      ok: 'Hapus kelas'
    });
    if (!r) return;
    try {
      const res = await api(`/api/teacher/classes/${c.id}/delete`, { method: 'POST', body: { confirmName: r.confirmName } });
      toast(`Kelas ${c.name} dihapus${res.deletedStudents ? ` bersama ${res.deletedStudents} akun siswa` : ''}.`);
      local.del('elkpd.guru.kelas');
      if (location.hash === '#/guru') window.dispatchEvent(new HashChangeEvent('hashchange'));
      else location.hash = '#/guru';
    } catch (e) { toast(e.message, 'error'); }
  });
  box.querySelector('[data-csv]').addEventListener('click', e => dl(e.target, `/api/teacher/classes/${c.id}/csv`));
  box.querySelectorAll('[data-pdf]').forEach(b => b.addEventListener('click', () => dl(b, `/api/teacher/students/${b.dataset.pdf}/pdf`)));
}

function answerHtml(it, v) {
  if (v === undefined || v === null || v === '') return '<p class="answer empty">(belum diisi)</p>';
  switch (it.type) {
    case 'confirm': return `<p class="answer">${v ? 'Ya' : 'Tidak'}</p>`;
    case 'single': return `<p class="answer">${esc(it.options.find(o => o.value === v)?.label || v)}</p>`;
    case 'multi': return `<p class="answer">${esc(v.map(x => it.options.find(o => o.value === x)?.label || x).join('; '))}</p>`;
    case 'simlog': {
      if (!Array.isArray(v) || !v.length) return '<p class="answer empty">(belum ada catatan)</p>';
      if (it.sim === 'congruence') {
        return `<div class="table-scroll"><table class="data-table compact"><thead><tr><th>No</th><th>DE; EF; FD (cm)</th><th>∠D; ∠E; ∠F</th><th>Keadaan</th><th>Catatan</th></tr></thead><tbody>${v.map((e, i) => `<tr><td>${i + 1}</td><td>${fmt(e.de)}; ${fmt(e.ef)}; ${fmt(e.fd)}</td><td>${fmt(e.aD)}°; ${fmt(e.aE)}°; ${fmt(e.aF)}°</td><td>${[e.moved ? 'digeser' : '', `diputar ${fmt(e.rot, 0)}°`, e.mirror ? 'dicerminkan' : ''].filter(Boolean).join(', ')}</td><td>${esc(e.note || '-')}</td></tr>`).join('')}</tbody></table></div>`;
      }
      return `<div class="table-scroll"><table class="data-table compact"><thead><tr><th>No</th><th>Mode</th><th>ST; TU; SU (cm)</th><th>∠S; ∠T; ∠U</th><th>Catatan</th></tr></thead><tbody>${v.map((e, i) => `<tr><td>${i + 1}</td><td>${e.mode === 'skala' ? `k = ${fmt(e.k)}` : 'sisi bebas'}</td><td>${fmt(e.st)}; ${fmt(e.tu)}; ${fmt(e.su)}</td><td>${fmt(e.aS)}°; ${fmt(e.aT)}°; ${fmt(e.aU)}°</td><td>${esc(e.note || '-')}</td></tr>`).join('')}</tbody></table></div>`;
    }
    default: return `<p class="answer pre">${esc(v)}</p>`;
  }
}

export async function renderStudent(view, app, studentId) {
  view.innerHTML = '<p class="loading" role="status">Memuat hasil siswa...</p>';
  let d;
  try { d = await api(`/api/teacher/students/${studentId}`); }
  catch (e) { view.innerHTML = `<div class="card error-card"><h1>Hasil siswa gagal dimuat</h1><p>${esc(e.message)}</p><a class="btn" href="#/guru">Kembali ke Dasbor</a></div>`; return; }
  const sub = d.submission;
  const canGrade = sub.status === 'submitted';
  const fbMap = {};
  for (const list of Object.values(d.feedback)) for (const r of list) fbMap[r.id] = r;

  const sections = app.def.sections.map(s => {
    const groups = s.groups || [{ items: s.items }];
    return `
      <section class="card review-section">
        <h2>${icon(s.icon)} ${s.kicker ? `${esc(s.kicker)}: ` : ''}${esc(s.title)}</h2>
        <p class="muted small">Terisi ${d.progress.sections[s.id].filled} dari ${d.progress.sections[s.id].required} pertanyaan wajib${sub.checked[s.id] ? `. Diperiksa siswa pada ${esc(fmtTime(sub.checked[s.id]))}` : ''}.</p>
        ${groups.map(g => `
          ${g.title ? `<h3>${esc(g.title)}</h3>` : ''}
          ${g.items.map(it => {
            const v = sub.answers[it.id];
            const gr = sub.grades[it.id] || {};
            let mark;
            if (it.auto) {
              const f = fbMap[it.id];
              mark = `<span class="tag tag-auto">Otomatis</span> <span class="fb ${f.correct ? 'fb-ok' : 'fb-no'}">${f.correct ? 'Benar' : f.unreadable ? 'Tidak terbaca' : 'Belum tepat'} (${f.correct ? it.points : 0}/${it.points})</span>`;
            } else if (it.graded === 'teacher') mark = `<span class="tag tag-manual">Perlu dinilai guru, maks ${it.points}</span>`;
            else mark = '<span class="tag">Tidak dinilai, umpan balik saja</span>';
            return `
              <div class="review-item" data-grade="${it.id}">
                <div class="q-head"><p class="q-label">${esc(it.label)}</p><span class="q-meta">${mark}</span></div>
                ${answerHtml(it, v)}
                ${it.auto ? `<p class="fb-key small"><strong>Kunci:</strong> ${esc(fbMap[it.id].answer)}</p>` : ''}
                ${it.graded === 'teacher' ? `<details class="rubric"><summary>Rubrik</summary><p>${esc(d.rubrics[it.id])}</p></details>` : ''}
                <div class="grade-row">
                  ${it.graded === 'teacher' ? `<label class="field-inline">Skor <input type="number" min="0" max="${it.points}" step="0.5" name="score" value="${typeof gr.score === 'number' ? gr.score : ''}" ${canGrade ? '' : 'disabled'}> / ${it.points}</label>` : ''}
                  ${it.type !== 'confirm' && it.type !== 'short' ? `<label class="field grow"><span>Komentar untuk siswa</span><textarea name="comment" rows="2" maxlength="1000" ${canGrade ? '' : 'disabled'}>${esc(gr.comment || '')}</textarea></label>` : ''}
                </div>
              </div>`;
          }).join('')}`).join('')}
      </section>`;
  }).join('');

  const t = d.totals;
  view.innerHTML = `
    <div class="teacher">
      <p><a href="#/guru/kelas/${d.student.classId}">Kembali ke daftar siswa</a></p>
      <header class="section-head" data-accent="peach">
        <span class="section-badge" aria-hidden="true">${icon('user')}</span>
        <h1 id="section-title" tabindex="-1">${esc(d.student.name)}</h1>
        <p class="lead">${esc(d.student.className)}. ${esc(d.student.email)}</p>
      </header>
      <div class="card student-summary">
        <dl class="kv">
          <dt>Status</dt><dd>${sub.status === 'submitted' ? 'Dikumpulkan' : sub.status === 'reopened' ? `Dibuka kembali (revisi ke-${sub.revision})` : 'Belum dikumpulkan'}</dd>
          <dt>Penyelesaian</dt><dd>${d.progress.filled} dari ${d.progress.total} (${d.progress.percent}%)</dd>
          <dt>Mulai mengerjakan</dt><dd>${esc(fmtTime(sub.startedAt))}</dd>
          <dt>Terakhir disimpan</dt><dd>${esc(fmtTime(sub.updatedAt))}</dd>
          <dt>Waktu pengumpulan</dt><dd>${esc(fmtTime(sub.submittedAt))}</dd>
          <dt>Skor otomatis</dt><dd>${t.auto} dari ${t.autoMax}</dd>
          <dt>Skor uraian</dt><dd><span data-manual>${fmt(t.manual)}</span> dari ${t.manualMax} (<span data-graded>${t.manualGraded}</span> dari ${t.manualCount} butir dinilai)</dd>
          <dt>Nilai akhir</dt><dd><span data-final>${fmt(t.finalScore)}</span> (skala 0 sampai 100)</dd>
          <dt>Status penilaian</dt><dd>${GRADING[sub.gradingStatus]}${sub.gradedAt ? `, ${esc(fmtTime(sub.gradedAt))}` : ''}</dd>
        </dl>
        <div class="summary-actions">
          <button type="button" class="btn" data-pdf>Unduh PDF</button>
          ${sub.status === 'submitted' ? '<button type="button" class="btn" data-reopen>Buka kembali untuk revisi</button>' : ''}
          <button type="button" class="btn btn-quiet" data-reset-pass>Atur ulang kata sandi</button>
        </div>
        ${canGrade ? '' : '<p class="notice">Penilaian dapat diisi setelah siswa mengumpulkan LKPD.</p>'}
      </div>
      ${sections}
      <section class="card">
        <h2>Catatan umum dan penyelesaian penilaian</h2>
        <label class="field"><span>Catatan umum untuk siswa</span><textarea data-note rows="3" maxlength="2000" ${canGrade ? '' : 'disabled'}>${esc(sub.note)}</textarea></label>
        <p class="muted small">Skor dan komentar baru terlihat oleh siswa setelah Anda menandai penilaian selesai.</p>
        <div class="summary-actions">
          <button type="button" class="btn" data-save="proses" ${canGrade ? '' : 'disabled'}>Simpan draf penilaian</button>
          <button type="button" class="btn btn-primary" data-save="selesai" ${canGrade ? '' : 'disabled'}>Tandai selesai dan tampilkan ke siswa</button>
        </div>
        <p class="grade-msg" role="alert"></p>
      </section>
      <section class="card">
        <h2>Riwayat</h2>
        <table class="data-table compact"><thead><tr><th>Waktu</th><th>Kegiatan</th><th>Oleh</th><th>Keterangan</th></tr></thead>
        <tbody>${d.events.map(e => `<tr><td>${esc(fmtTime(e.at))}</td><td>${esc(EVENTS[e.type] || e.type)}</td><td>${esc(e.actor || '-')}</td><td>${esc(e.note)}</td></tr>`).join('')}</tbody></table>
      </section>
    </div>`;

  const collect = () => {
    const grades = {};
    view.querySelectorAll('[data-grade]').forEach(row => {
      const id = row.dataset.grade;
      const score = row.querySelector('[name="score"]');
      const comment = row.querySelector('[name="comment"]');
      const g = {};
      if (score && score.value !== '') g.score = Number(score.value);
      if (comment && comment.value.trim()) g.comment = comment.value.trim();
      if (Object.keys(g).length) grades[id] = g;
    });
    return grades;
  };
  const recalc = () => {
    let manual = 0, graded = 0;
    view.querySelectorAll('[name="score"]').forEach(s => { if (s.value !== '' && Number.isFinite(Number(s.value))) { manual += Number(s.value); graded++; } });
    view.querySelector('[data-manual]').textContent = fmt(manual);
    view.querySelector('[data-graded]').textContent = graded;
    view.querySelector('[data-final]').textContent = fmt(Math.round(((t.auto + manual) / t.max) * 1000) / 10);
  };
  view.querySelectorAll('[name="score"]').forEach(s => s.addEventListener('input', recalc));

  view.querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', async () => {
    const msg = view.querySelector('.grade-msg');
    msg.textContent = '';
    const status = b.dataset.save;
    if (status === 'selesai') {
      const ok = await confirmDialog({ title: 'Tandai penilaian selesai?', body: '<p>Skor, komentar, dan nilai akhir akan dapat dilihat siswa.</p>', ok: 'Ya, tampilkan ke siswa' });
      if (!ok) return;
    }
    b.disabled = true;
    try {
      await api(`/api/teacher/students/${studentId}/grades`, { method: 'PUT', body: { grades: collect(), note: view.querySelector('[data-note]').value, status } });
      toast(status === 'selesai' ? 'Penilaian selesai dan dapat dilihat siswa.' : 'Draf penilaian disimpan.');
      renderStudent(view, app, studentId);
    } catch (e) {
      msg.textContent = e.message;
      if (e.data?.missing) {
        const first = view.querySelector(`[data-grade="${e.data.missing[0]}"]`);
        e.data.missing.forEach(id => view.querySelector(`[data-grade="${id}"]`)?.classList.add('needs-score'));
        first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      b.disabled = false;
    }
  }));

  view.querySelector('[data-pdf]').addEventListener('click', e => dl(e.target, `/api/teacher/students/${studentId}/pdf`));
  view.querySelector('[data-reopen]')?.addEventListener('click', async () => {
    const r = await formDialog({
      title: 'Buka kembali LKPD untuk revisi',
      intro: '<p>Siswa dapat mengubah jawaban lalu mengumpulkan ulang. Alasan pembukaan tercatat di riwayat dan terlihat oleh siswa.</p>',
      fields: [
        { name: 'note', label: 'Alasan pembukaan kembali', required: true },
        { name: 'unlock', label: 'Buka juga aktivitas yang sudah diperiksa siswa (kunci jawaban sudah pernah dilihat siswa)', type: 'checkbox' }
      ],
      ok: 'Buka kembali'
    });
    if (!r) return;
    try {
      await api(`/api/teacher/students/${studentId}/reopen`, { method: 'POST', body: { note: r.note, unlockChecked: r.unlock } });
      toast('LKPD dibuka kembali untuk siswa.');
      renderStudent(view, app, studentId);
    } catch (e) { toast(e.message, 'error'); }
  });
  view.querySelector('[data-reset-pass]').addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Atur ulang kata sandi siswa?', body: `<p>Kata sandi lama ${esc(d.student.name)} tidak berlaku lagi dan siswa keluar dari semua perangkat.</p>`, ok: 'Atur ulang', danger: true });
    if (!ok) return;
    try {
      const res = await api(`/api/teacher/students/${studentId}/reset-password`, { method: 'POST', body: {} });
      await confirmDialog({ title: 'Kata sandi sementara', body: `<p>Berikan kata sandi ini kepada siswa: <strong class="code">${esc(res.password)}</strong></p><p class="muted small">Kata sandi hanya ditampilkan sekali.</p>`, ok: 'Tutup', cancel: 'Tutup' });
    } catch (e) { toast(e.message, 'error'); }
  });
}

// Undangan guru: kode sekali pakai, berlaku 7 hari. Kode hanya tampil sekali setelah dibuat.
async function renderInvites(box) {
  box.innerHTML = '<p class="loading" role="status">Memuat undangan...</p>';
  let list;
  try { list = (await api('/api/teacher/invites')).invites; }
  catch (e) { box.innerHTML = `<p class="form-error">${esc(e.message)}</p>`; return; }
  const STATUS_INV = { aktif: 'Aktif', dipakai: 'Sudah dipakai', dibatalkan: 'Dibatalkan', kedaluwarsa: 'Kedaluwarsa' };
  box.innerHTML = `
    <h2>${icon('key')} Undang guru lain</h2>
    <p>Buat kode undangan sekali pakai untuk rekan guru. Kode berlaku 7 hari.</p>
    <button type="button" class="btn btn-primary" data-new-invite>Buat kode undangan</button>
    ${list.length ? `<div class="table-scroll" style="margin-top:14px"><table class="data-table compact">
      <thead><tr><th>Kode</th><th>Status</th><th>Berlaku sampai</th><th></th></tr></thead>
      <tbody>${list.map(i => `<tr><td>…${esc(i.hint)}</td><td>${STATUS_INV[i.status]}${i.used_by_name ? ` (${esc(i.used_by_name)})` : ''}</td><td>${esc(fmtTime(i.expires_at))}</td>
        <td>${i.status === 'aktif' ? `<button type="button" class="btn btn-small btn-quiet" data-revoke="${i.id}">Batalkan</button>` : ''}</td></tr>`).join('')}</tbody>
    </table></div>` : '<p class="empty">Belum ada undangan.</p>'}`;
  box.querySelector('[data-new-invite]').addEventListener('click', async () => {
    try {
      const r = await api('/api/teacher/invites', { method: 'POST', body: {} });
      await confirmDialog({ title: 'Kode undangan guru', body: `<p>Berikan kode ini kepada guru yang Anda undang:</p><p><strong class="code invite-code">${esc(r.code)}</strong></p><p class="muted small">Kode hanya ditampilkan sekali dan hanya bisa dipakai satu kali, sampai ${esc(fmtTime(r.expiresAt))}. Guru mendaftar di halaman Masuk sebagai Guru, lalu Daftar pakai kode akses guru.</p>`, ok: 'Sudah dicatat', cancel: 'Tutup' });
      renderInvites(box);
    } catch (e) { toast(e.message, 'error'); }
  });
  box.querySelectorAll('[data-revoke]').forEach(b => b.addEventListener('click', async () => {
    try { await api(`/api/teacher/invites/${b.dataset.revoke}/revoke`, { method: 'POST', body: {} }); toast('Undangan dibatalkan.'); renderInvites(box); }
    catch (e) { toast(e.message, 'error'); }
  }));
}

export { sectionItems };
