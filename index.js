require('dotenv').config();
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const session = require('telegraf/session');
const db = require('./firebase');

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

// Middleware for session handling
bot.use(session());

// Webhook path and domain
const PORT = process.env.PORT || 3000;
const WEBHOOK_PATH = `/bot${process.env.BOT_TOKEN}`;
const WEBHOOK_URL = `${process.env.WEBHOOK_DOMAIN}${WEBHOOK_PATH}`; // e.g. https://yourapp.onrender.com/botTOKEN

// Express middleware for webhook
app.use(express.json());
app.use(bot.webhookCallback(WEBHOOK_PATH));

// Set webhook
bot.telegram.setWebhook(WEBHOOK_URL);

// Web server start
app.get('/', (req, res) => res.send('BoostBizz Bot is running...'));
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Start command
bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  const user = {
    userId,
    username: ctx.from.username || '',
    firstName: ctx.from.first_name || '',
    lastName: ctx.from.last_name || '',
    joinedAt: new Date(),
    subscription: 'none',
  };

  try {
    await db.collection('users').doc(userId).set(user, { merge: true });

    ctx.reply(
      'Welcome to BoostBizz Kenya! 🚀\nLet’s register your business.',
      Markup.keyboard([['Register Business']])
        .resize()
        .oneTime()
    );
  } catch (error) {
    console.error('Error saving user:', error);
    ctx.reply('⚠️ Failed to register. Please try again.');
  }
});

// Registration flow
bot.hears('Register Business', (ctx) => {
  ctx.session.registrationStep = 'business_name';
  ctx.reply('What is your business name?');
});

bot.on('text', async (ctx) => {
  const step = ctx.session.registrationStep;

  if (!step) return;

  switch (step) {
    case 'business_name':
      ctx.session.name = ctx.message.text;
      ctx.session.registrationStep = 'type';
      ctx.reply('What type of business is it? (e.g., Salon, Electronics)');
      break;

    case 'type':
      ctx.session.type = ctx.message.text;
      ctx.session.registrationStep = 'location';
      ctx.reply('Where are you located?');
      break;

    case 'location':
      ctx.session.location = ctx.message.text;
      ctx.session.registrationStep = 'contact';
      ctx.reply('What is your contact phone or email?');
      break;

    case 'contact':
      ctx.session.contact = ctx.message.text;
      ctx.session.registrationStep = 'confirm';

      const { name, type, location, contact } = ctx.session;

      ctx.reply(
        `Please confirm your details:\n\n` +
        `📏 Name: ${name}\n` +
        `📦 Type: ${type}\n` +
        `📍 Location: ${location}\n` +
        `☎️ Contact: ${contact}`,
        Markup.keyboard([['✅ Confirm', '✏️ Edit']]).resize().oneTime()
      );
      break;
  }
});

bot.hears('✅ Confirm', async (ctx) => {
  const userId = ctx.from.id.toString();
  const { name, type, location, contact } = ctx.session;

  await db.collection('users').doc(userId).set({
    name,
    type,
    location,
    contact,
    isSubscribed: false,
    subscriptionTier: null,
    createdAt: new Date()
  }, { merge: true });

  ctx.reply('Choose your subscription plan:', Markup.inlineKeyboard([
    [Markup.button.callback('Starter (KES 1500)', 'subscribe_starter')],
    [Markup.button.callback('Standard (KES 3000)', 'subscribe_standard')],
    [Markup.button.callback('Premium (KES 5500)', 'subscribe_premium')],
  ]));
});

bot.action(['subscribe_starter', 'subscribe_standard', 'subscribe_premium'], async (ctx) => {
  const userId = ctx.from.id.toString();
  const tier = ctx.callbackQuery.data.split('_')[1];
  let price;

  switch (tier) {
    case 'starter': price = 1500; break;
    case 'standard': price = 3000; break;
    case 'premium': price = 5500; break;
    default: return ctx.reply('⚠️ Invalid tier');
  }

  ctx.reply(
    `You chose ${tier.charAt(0).toUpperCase() + tier.slice(1)} (KES ${price}). Select payment method:`,
    Markup.inlineKeyboard([
      [Markup.button.callback('💳 Telegram Pay', `pay_telegram_${tier}`)],
      [Markup.button.webApp('📱 M-Pesa', `https://your-mpesa-miniapp.com/pay?userId=${userId}&plan=${tier}&price=${price}`)],
    ])
  );
});

bot.action(/pay_telegram_(starter|standard|premium)/, async (ctx) => {
  const userId = ctx.from.id.toString();
  const tier = ctx.match[1];
  let price = tier === 'starter' ? 1500 : tier === 'standard' ? 3000 : 5500;

  await db.collection('users').doc(userId).update({
    isSubscribed: true,
    subscriptionTier: tier
  });

  ctx.reply(`✅ Payment of KES ${price} for ${tier} plan received!`, Markup.inlineKeyboard([
    [Markup.button.webApp('🚀 Open Dashboard', `https://yourapp.com/dashboard?userId=${userId}`)]
  ]));
});

bot.command('continue', async (ctx) => {
  const userId = ctx.from.id.toString();
  const userDoc = await db.collection('users').doc(userId).get();

  if (userDoc.exists && userDoc.data().isSubscribed) {
    ctx.reply('✅ Subscription active. Open your dashboard:', Markup.inlineKeyboard([
      [Markup.button.webApp('🚀 Open Dashboard', `https://yourapp.com/dashboard?userId=${userId}`)]
    ]));
  } else {
    ctx.reply('❌ Subscription not found. Please register or contact support.');
  }
});
