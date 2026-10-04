const MENUS = {
  peserta: [['home', '🏠', 'Home'], ['game', '🎮', 'Mulai Game'], ['hasil', '🏆', 'Skor / Hasil'], ['board', '🏅', 'Leaderboard'], ['about', 'ℹ️', 'Tentang'], ['out', '🚪', 'Keluar']],
  admin: [['dash', '🏠', 'Dashboard'], ['soal', '📝', 'Kelola Soal'], ['peserta', '👥', 'Peserta'], ['kode', '🔑', 'Kode Peserta'], ['board', '🏆', 'Leaderboard'], ['stat', '📊', 'Statistik'], ['set', '⚙️', 'Pengaturan'], ['out', '🚪', 'Logout']]
};
const VIEWS = {
  peserta: { home: pHome, game: pGame, hasil: pHasil, board: viewBoard, about: pAbout },
  admin: { dash: aDash, soal: aSoal, peserta: aPeserta, kode: aKode, board: viewBoard, stat: aStat, set: aSet }
};
function setChrome(on) { $('#top').hidden = !on; if (!on) closeMenu(); }
function toggleMenu(o) { const v = o ?? !$('#menu').classList.contains('open'); ['#menu', '#overlay', '#burger'].forEach(s => $(s).classList.toggle('open', v)); }
const closeMenu = () => toggleMenu(false);
function buildMenu() {
  $('#menu').innerHTML = `<div class="who">👤 ${esc(S.name)}<small>${S.role}</small></div>` +
    MENUS[S.role].map(([k, i, t]) => `<a data-v="${k}" class="${S.view === k ? 'on' : ''}">${i} ${t}</a>`).join('');
  $('#menu').querySelectorAll('a').forEach(a => a.onclick = () => go(a.dataset.v));
}
async function go(v) {
  if (!S.role) return;
  closeMenu();
  if (typeof G !== 'undefined' && G && G.active && v !== 'game') {
    if (!(await confirmBox('Keluar dari game? Jawabanmu belum dikirim dan akan hilang.'))) return;
    stopTimer(); G = null;
  }
  if (v === 'out') return logout();
  const f = VIEWS[S.role][v]; if (!f) return;
  stopTimer(); S.view = v; buildMenu(); $('#app').innerHTML = '';
  try { await f(); } catch (e) { fail(e); }
  window.scrollTo(0, 0);
}
function enter() { setChrome(true); go(S.role === 'admin' ? 'dash' : 'home'); }
$('#burger').onclick = () => toggleMenu(); $('#overlay').onclick = closeMenu;
(async () => { (await restoreSession()) ? enter() : renderLogin(); })();
