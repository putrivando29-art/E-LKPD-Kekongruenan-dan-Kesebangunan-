// Fungsi bantu tampilan: escape HTML, waktu, pemberitahuan, dialog konfirmasi.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function fmtTime(iso, opts = { dateStyle: 'medium', timeStyle: 'short' }) {
  if (!iso) return '-';
  try { return new Intl.DateTimeFormat('id-ID', opts).format(new Date(iso)); } catch { return iso; }
}
export const fmtClock = iso => fmtTime(iso, { timeStyle: 'short' });

let toastTimer;
export function toast(message, kind = 'info') {
  let box = document.getElementById('toast');
  box.textContent = message;
  box.dataset.kind = kind;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, kind === 'error' ? 7000 : 4000);
}

// Dialog konfirmasi berbasis <dialog>. Mengembalikan Promise<boolean>. Esc = batal.
export function confirmDialog({ title, body, ok = 'Ya, lanjutkan', cancel = 'Batal', danger = false }) {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'dialog';
    d.innerHTML = `
      <form method="dialog">
        <h2>${esc(title)}</h2>
        <div class="dialog-body">${body}</div>
        <div class="dialog-actions">
          <button value="cancel" class="btn btn-quiet">${esc(cancel)}</button>
          <button value="ok" class="btn ${danger ? 'btn-accent' : 'btn-primary'}">${esc(ok)}</button>
        </div>
      </form>`;
    document.body.appendChild(d);
    d.addEventListener('close', () => { resolve(d.returnValue === 'ok'); d.remove(); });
    d.showModal();
    d.querySelector('button[value="ok"]').focus();
  });
}

// Dialog dengan isian. fields: [{name, label, type, required}] -> Promise<object|null>
export function formDialog({ title, intro = '', fields, ok = 'Simpan' }) {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'dialog';
    d.innerHTML = `
      <form method="dialog" novalidate>
        <h2>${esc(title)}</h2>
        ${intro ? `<div class="dialog-body">${intro}</div>` : ''}
        ${fields.map(f => f.type === 'checkbox'
          ? `<label class="check-inline"><input type="checkbox" name="${f.name}"> ${esc(f.label)}</label>`
          : `<label class="field"><span>${esc(f.label)}</span><textarea name="${f.name}" rows="3" ${f.required ? 'required' : ''}></textarea></label>`).join('')}
        <p class="form-error" role="alert" hidden></p>
        <div class="dialog-actions">
          <button value="cancel" class="btn btn-quiet" formnovalidate>Batal</button>
          <button value="ok" class="btn btn-primary">${esc(ok)}</button>
        </div>
      </form>`;
    document.body.appendChild(d);
    const form = d.querySelector('form');
    form.addEventListener('submit', e => {
      if (e.submitter?.value !== 'ok') return;
      const missing = fields.find(f => f.required && !form.elements[f.name].value.trim());
      if (missing) {
        e.preventDefault();
        const err = form.querySelector('.form-error');
        err.textContent = `${missing.label} wajib diisi.`;
        err.hidden = false;
      }
    });
    d.addEventListener('close', () => {
      if (d.returnValue !== 'ok') { resolve(null); d.remove(); return; }
      const out = {};
      for (const f of fields) out[f.name] = f.type === 'checkbox' ? form.elements[f.name].checked : form.elements[f.name].value.trim();
      resolve(out);
      d.remove();
    });
    d.showModal();
  });
}

// Validasi kelengkapan di browser. Aturannya sama dengan server/grading.js; server tetap menjadi penentu akhir.
export function isFilled(item, value) {
  if (value === undefined || value === null) return false;
  const num = v => {
    let s = String(v).toLowerCase().replace(/derajat|cm|°|kali|k\s*=|=/g, ' ').trim().replace(/^[x×]\s*/, '').replace(/\s*[x×]$/, '').replace(/\s+/g, '').replace(',', '.');
    if (!s) return null;
    const f = s.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
    if (f) return Number(f[2]) === 0 ? null : Number(f[1]) / Number(f[2]);
    return /^-?\d+(?:\.\d+)?$/.test(s) ? Number(s) : null;
  };
  const ratio = v => {
    const s = String(v).toLowerCase().replace(/banding|berbanding/g, ':').replace(/cm/g, '');
    const p = s.split(':');
    if (p.length === 2) { const a = num(p[0]), b = num(p[1]); return a === null || b === null || b === 0 ? null : a / b; }
    return p.length === 1 ? num(s) : null;
  };
  switch (item.type) {
    case 'text': { const m = String(value).match(/[\p{L}\p{N}]/gu); return !!m && m.length >= 3; }
    case 'short': return /[\p{L}\p{N}]/u.test(String(value));
    case 'confirm': return value === true;
    case 'single': return item.options.some(o => o.value === value);
    case 'multi': return Array.isArray(value) && value.length > 0;
    case 'number': return num(value) !== null;
    case 'ratio': return ratio(value) !== null;
    case 'simlog': return Array.isArray(value) && value.length >= (item.minEntries || 1);
    default: return false;
  }
}

export function fillHint(item, value) {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return 'Belum diisi';
  switch (item.type) {
    case 'text': return 'Minimal 3 huruf atau angka';
    case 'number': return 'Tuliskan sebuah bilangan, misalnya 7,5';
    case 'ratio': return 'Tuliskan perbandingan, misalnya 2 : 3';
    case 'simlog': return `Perlu ${item.minEntries} catatan, baru ${value.length}`;
    default: return 'Belum diisi';
  }
}

export const sectionItems = s => (s.items ? s.items : s.groups.flatMap(g => g.items));
