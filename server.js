require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const db = require('./db');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const PRICE = parseInt(process.env.VOTE_PRICE || '5000', 10);
const BOT = (process.env.BOT_USERNAME || '').replace('@', '');

function hashPw(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function checkPw(pw, stored) {
  const [salt, h] = stored.split(':');
  const a = Buffer.from(h, 'hex');
  const b = crypto.scryptSync(pw, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function newSession(u) {
  const t = crypto.randomBytes(24).toString('hex');
  db.data.sessions[t] = u.id;
  db.save();
  return t;
}
function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  const u = db.data.users.find(x => x.id === db.data.sessions[t]);
  if (!u) return res.status(401).json({ error: 'Avval tizimga kiring' });
  req.user = u;
  next();
}
const pub = u => ({ username: u.username, balance: u.balance });

app.get('/health', (req, res) => res.send('ok'));

app.post('/api/register', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
    return res.status(400).json({ error: "Login 3-20 ta harf, raqam yoki _ bo'lishi kerak" });
  if (password.length < 6) return res.status(400).json({ error: "Parol kamida 6 ta belgi bo'lsin" });
  if (db.data.users.some(u => u.username.toLowerCase() === username.toLowerCase()))
    return res.status(400).json({ error: 'Bu login band' });
  const u = { id: crypto.randomBytes(8).toString('hex'), username, pass: hashPw(password), balance: 0 };
  db.data.users.push(u);
  res.json({ token: newSession(u), user: pub(u) });
});

app.post('/api/login', (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const u = db.data.users.find(x => x.username.toLowerCase() === username);
  if (!u || !checkPw(String(req.body.password || ''), u.pass))
    return res.status(400).json({ error: "Login yoki parol noto'g'ri" });
  res.json({ token: newSession(u), user: pub(u) });
});

app.get('/api/me', auth, (req, res) => res.json({ user: pub(req.user) }));

app.get('/api/regions', (req, res) => {
  const list = db.REGION_NAMES.map((name, i) => ({ id: i + 1, name, votes: db.data.regions[i + 1] || 0 }));
  list.sort((a, b) => b.votes - a.votes);
  list.forEach((r, i) => (r.rank = i + 1));
  res.json({ regions: list, price: PRICE });
});

app.post('/api/vote', auth, (req, res) => {
  const regionId = parseInt(req.body.regionId, 10);
  const count = parseInt(req.body.count, 10);
  if (!(regionId >= 1 && regionId <= db.REGION_NAMES.length)) return res.status(400).json({ error: 'Hudud topilmadi' });
  if (!(count >= 1)) return res.status(400).json({ error: "Ovoz soni noto'g'ri" });
  if (req.user.balance < count) return res.status(400).json({ error: "Balansingizda ovoz yetarli emas. Avval ovoz sotib oling" });
  req.user.balance -= count;
  db.data.regions[regionId] += count;
  db.save();
  res.json({ user: pub(req.user) });
});

app.post('/api/orders', auth, (req, res) => {
  const votes = parseInt(req.body.votes, 10);
  if (!(votes >= 1 && votes <= 1000)) return res.status(400).json({ error: "Ovoz soni 1 dan 1000 gacha bo'lsin" });
  const o = { id: crypto.randomBytes(6).toString('hex'), userId: req.user.id, votes, amount: votes * PRICE, status: 'pending', createdAt: Date.now() };
  db.data.orders.push(o);
  db.save();
  res.json({ link: `https://t.me/${BOT}?start=order_${o.id}`, amount: o.amount });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Sayt ishga tushdi: port ' + PORT));

if (process.env.BOT_TOKEN) require('./bot')();
else console.log("DIQQAT: .env faylida BOT_TOKEN yo'q, bot ishga tushmadi");
