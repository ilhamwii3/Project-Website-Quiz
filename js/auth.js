function renderLogin() {
  S.role = null; S.token = null; setChrome(false);
  $('#app').innerHTML = `<section class="card login fade"><h1>🎮 Selamat Datang di Game Teka-Teki!</h1>
  <p class="muted">Uji pengetahuanmu dan dapatkan skor terbaik!</p>
  <div class="tabs"><button class="tab on" data-t="p">Peserta</button><button class="tab" data-t="a">Admin</button></div>
  <form id="fp"><label>Username<input id="u" maxlength="30" required placeholder="Nama kamu" autocomplete="off"></label>
  <label>Kode Akses<input id="c" required placeholder="Kode dari admin" autocapitalize="characters" autocomplete="off"></label>
  <button class="btn block">Masuk dan main</button></form>
  <form id="fa" hidden><label>Email Admin<input id="ae" type="email" required></label>
  <label>Password<input id="ap" type="password" required></label><button class="btn block">Login Admin</button></form></section>`;
  document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b));
    $('#fp').hidden = b.dataset.t !== 'p'; $('#fa').hidden = b.dataset.t !== 'a';
  });
  $('#fp').onsubmit = async e => {
    e.preventDefault();
    try {
      const r = await busy(() => rpc('join_game', { p_username: $('#u').value, p_code: $('#c').value }));
      sessionStorage.setItem('ptoken', r.token); sessionStorage.setItem('pname', r.username);
      S.role = 'peserta'; S.token = r.token; S.name = r.username; enter();
    } catch (x) { fail(x); }
  };
  $('#fa').onsubmit = async e => {
    e.preventDefault();
    try {
      const { data, error } = await busy(() => db.auth.signInWithPassword({ email: $('#ae').value, password: $('#ap').value }));
      if (error) throw new Error('Email atau password salah');
      if (!(await checkAdmin(data.user))) { await db.auth.signOut(); throw new Error('Akun ini bukan Admin'); }
      S.role = 'admin'; S.name = data.user.email; enter();
    } catch (x) { fail(x); }
  };
}
async function checkAdmin(u) {
  const { data } = await db.from('admins').select('user_id').eq('user_id', u.id).maybeSingle();
  return !!data;
}
async function restoreSession() {
  const t = sessionStorage.getItem('ptoken');
  if (t) { S.role = 'peserta'; S.token = t; S.name = sessionStorage.getItem('pname'); return true; }
  const { data } = await db.auth.getSession();
  if (data.session) {
    if (await checkAdmin(data.session.user)) { S.role = 'admin'; S.name = data.session.user.email; return true; }
    await db.auth.signOut();
  }
  return false;
}
async function logout() { sessionStorage.clear(); await db.auth.signOut(); renderLogin(); }
