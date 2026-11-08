const fs = require('fs');
const path = require('path');
const FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');

const REGION_NAMES = [
  'Andijon viloyati', 'Buxoro viloyati', "Farg'ona viloyati", 'Jizzax viloyati',
  'Xorazm viloyati', 'Namangan viloyati', 'Navoiy viloyati', 'Qashqadaryo viloyati',
  'Samarqand viloyati', 'Sirdaryo viloyati', 'Surxondaryo viloyati', 'Toshkent viloyati',
  "Qoraqalpog'iston Respublikasi", 'Toshkent shahri'
];

let data = { users: [], sessions: {}, orders: [], regions: {} };
try { data = Object.assign(data, JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch (e) {}
REGION_NAMES.forEach((_, i) => { if (data.regions[i + 1] === undefined) data.regions[i + 1] = 0; });

function save() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, FILE);
}
save();

// To'lov muvaffaqiyatli bo'lganda ovozlarni balansga qo'shadi (ikki marta qo'shilmaydi)
function payOrder(orderId, chargeId, totalTiyin) {
  const o = data.orders.find(x => x.id === orderId);
  if (!o) return { ok: false, error: 'Buyurtma topilmadi' };
  if (o.status === 'paid') return { ok: true, already: true, order: o };
  if (totalTiyin !== o.amount * 100) return { ok: false, error: 'Summa mos emas' };
  const u = data.users.find(x => x.id === o.userId);
  if (!u) return { ok: false, error: 'Foydalanuvchi topilmadi' };
  u.balance += o.votes;
  o.status = 'paid';
  o.chargeId = chargeId;
  o.paidAt = Date.now();
  save();
  return { ok: true, order: o, user: u };
}

module.exports = { data, save, REGION_NAMES, payOrder };
