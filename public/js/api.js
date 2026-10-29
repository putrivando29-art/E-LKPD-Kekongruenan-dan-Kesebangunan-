// Pembungkus fetch ke server. Semua permintaan yang mengubah data membawa header X-ELKPD.
export class ApiError extends Error {
  constructor(status, data) {
    super((data && data.error) || 'Terjadi kesalahan.');
    this.status = status;
    this.data = data || {};
  }
}

export async function api(path, { method = 'GET', body, keepalive = false } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      keepalive,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' ? { 'X-ELKPD': '1' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError(0, { error: 'Tidak dapat terhubung ke server. Periksa koneksi internetmu.', offline: true });
  }
  let data = null;
  const type = res.headers.get('Content-Type') || '';
  if (type.includes('application/json')) data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data || { error: `Server membalas dengan kode ${res.status}.` });
  return data;
}

// Unduh berkas (PDF/CSV) dengan pesan galat yang jelas bila gagal.
export async function download(path) {
  let res;
  try { res = await fetch(path, { credentials: 'same-origin' }); }
  catch { throw new ApiError(0, { error: 'Tidak dapat terhubung ke server untuk mengunduh berkas.' }); }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data || { error: 'Berkas gagal diunduh.' });
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const name = (cd.match(/filename="([^"]+)"/) || [])[1] || 'unduhan';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// localStorage dapat ditolak (mode privat, penyimpanan penuh). Semua akses dibungkus try/catch.
export const local = {
  get(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
  del(key) { try { localStorage.removeItem(key); } catch { /* abaikan */ } }
};
