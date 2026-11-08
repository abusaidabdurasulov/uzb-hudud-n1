const { Telegraf } = require('telegraf');
const db = require('./db');

module.exports = function startBot() {
  const bot = new Telegraf(process.env.BOT_TOKEN);

  bot.start(async ctx => {
    const p = ctx.startPayload || '';
    if (!p.startsWith('order_'))
      return ctx.reply("Salom! Ovoz sotib olish uchun saytdagi «Telegram orqali to'lash» tugmasidan foydalaning.");
    const o = db.data.orders.find(x => x.id === p.slice(6));
    if (!o) return ctx.reply("Buyurtma topilmadi. Saytdan qaytadan urinib ko'ring.");
    if (o.status === 'paid') return ctx.reply("Bu buyurtma allaqachon to'langan.");
    await ctx.replyWithInvoice({
      title: `${o.votes} ta ovoz`,
      description: `Hududlar reytingi uchun ${o.votes} ta ovoz. Narxi: ${o.amount.toLocaleString('ru-RU')} so'm`,
      payload: o.id,
      provider_token: process.env.PAYME_TOKEN,
      currency: 'UZS',
      prices: [{ label: `${o.votes} ta ovoz`, amount: o.amount * 100 }]
    });
  });

  bot.on('pre_checkout_query', async ctx => {
    const q = ctx.preCheckoutQuery;
    const o = db.data.orders.find(x => x.id === q.invoice_payload);
    if (!o || o.status !== 'pending' || q.currency !== 'UZS' || q.total_amount !== o.amount * 100)
      return ctx.answerPreCheckoutQuery(false, "Buyurtma yaroqsiz yoki allaqachon to'langan.");
    return ctx.answerPreCheckoutQuery(true);
  });

  bot.on('successful_payment', async ctx => {
    const sp = ctx.message.successful_payment;
    const r = db.payOrder(sp.invoice_payload, sp.telegram_payment_charge_id, sp.total_amount);
    if (r.ok) await ctx.reply(`✅ To'lov qabul qilindi! Balansingizga ${r.order.votes} ta ovoz qo'shildi. Saytga qaytib ovoz bering.`);
    else {
      console.error('TO\'LOV XATOSI:', r.error, sp);
      await ctx.reply("To'lov qabul qilindi, lekin ovozlarni qo'shishda xatolik bo'ldi. Administratorga murojaat qiling.");
    }
  });

  bot.catch(err => console.error('Bot xatosi:', err));
  bot.launch().catch(e => console.error('Bot ishga tushmadi:', e.message));
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
  console.log('Telegram bot ishga tushdi');
};
