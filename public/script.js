const $ = id => document.getElementById(id);
let token = localStorage.getItem('token');
let price = 5000;
const fmt = n => Number(n).toLocaleString('ru-RU');

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

async function api(path, method = 'GET', body) {
  const r = await fetch('/api/' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { setUser(null); }
  if (!r.ok) throw new Error(d.error || 'Xatolik yuz berdi');
  return d;
}

function setUser(u) {
  $('authBox').classList.toggle('hidden', !!u);
  $('userBox').classList.toggle('hidden', !u);
  if (u) { $('uName').textContent = u.username; $('uBalance').textContent = fmt(u.balance); }
  else { token = null; localStorage.removeItem('token'); }
}

async function loadRegions() {
  const d = await api('regions');
  price = d.price;
  $('priceTxt').textContent = fmt(price);
  updateTotal();
  $('list').innerHTML = d.regions.map(r => `
    <div class="item r${r.rank}">
      <div class="rank">${r.rank}</div>
      <div class="info"><b>${r.name}</b><span>${fmt(r.votes)} ta ovoz</span></div>
      <button onclick="vote(${r.id})">Ovoz berish</button>
    </div>`).join('');
}

async function refreshMe() {
  if (!token) return;
  try { setUser((await api('me')).user); } catch (e) {}
}

async function auth(kind) {
  try {
    const d = await api(kind, 'POST', { username: $('username').value, password: $('password').value });
    token = d.token; localStorage.setItem('token', token); setUser(d.user);
    toast(kind === 'register' ? "Ro'yxatdan o'tdingiz!" : 'Xush kelibsiz!');
  } catch (e) { toast(e.message); }
}

async function vote(regionId) {
  if (!token) { toast('Ovoz berish uchun avval tizimga kiring'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  try {
    const d = await api('vote', 'POST', { regionId, count: $('voteCount').value });
    setUser(d.user); await loadRegions(); toast('Ovoz qabul qilindi! ✅');
  } catch (e) { toast(e.message); }
}

function updateTotal() { $('buyTotal').textContent = fmt((parseInt($('buyCount').value, 10) || 0) * price); }

$('btnLogin').onclick = () => auth('login');
$('btnRegister').onclick = () => auth('register');
$('btnLogout').onclick = () => setUser(null);
$('buyCount').oninput = updateTotal;
$('chips').onclick = e => { if (e.target.dataset.n) { $('buyCount').value = e.target.dataset.n; updateTotal(); } };
$('btnBuy').onclick = async () => {
  try {
    const d = await api('orders', 'POST', { votes: $('buyCount').value });
    $('payLink').href = d.link; $('payLink').classList.remove('hidden');
    toast(`To'lov summasi: ${fmt(d.amount)} so'm. Telegram tugmasini bosing`);
  } catch (e) { toast(e.message); }
};

loadRegions(); refreshMe();
setInterval(loadRegions, 10000);
setInterval(refreshMe, 5000);
