// Hanya URL proyek + publishable/anon key (aman di frontend). JANGAN taruh service_role key di sini.
const SUPABASE_URL = "https://bvagcsqgfqtxabfvtoet.supabase.co";
const SUPABASE_KEY = "sb_publishable_pDRq1tZLRHP6n7XD0Vkp1w_9SEpW01s";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const S = { role: null, name: null, token: null, view: null };
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = d => d ? new Date(d).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-';
function toast(m, t = 'ok') { const e = document.createElement('div'); e.className = 'toast ' + t; e.textContent = m; $('#toasts').append(e); setTimeout(() => e.remove(), 3500); }
function fail(e) { toast(e.message || 'Terjadi kesalahan', 'err'); console.error(e); }
let _busy = 0;
async function busy(fn) { _busy++; $('#loader').classList.add('on'); try { return await fn(); } finally { if (--_busy === 0) $('#loader').classList.remove('on'); } }
async function rpc(name, args) { const { data, error } = await db.rpc(name, args); if (error) throw error; return data; }
function showModal(h) { $('#modal-root').innerHTML = `<div class="modal-bg"><div class="modal">${h}</div></div>`; }
function closeModal() { $('#modal-root').innerHTML = ''; }
function confirmBox(msg) {
  return new Promise(res => {
    showModal(`<h3>Konfirmasi</h3><p>${esc(msg)}</p><div class="row end"><button class="btn ghost" id="cn">Batal</button><button class="btn" id="cy">Ya, lanjutkan</button></div>`);
    $('#cn').onclick = () => { closeModal(); res(false); }; $('#cy').onclick = () => { closeModal(); res(true); };
  });
}
