// index.js
require('dotenv').config();
const { Telegraf } = require('telegraf');
const db = require('./firebase');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Start command
bot.start((ctx) => {
    const userId = ctx.from.id.toString();
    const user = {
    userId,
    username: ctx.from.username || '',
    firstName: ctx.from.first_name || '',
    lastName: ctx.from.last_name || '',
    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    subscription: 'none',
  };

  await db.collection('users').doc(userId).set(user, { merge: true });

  ctx.reply(
    'Welcome to BoostBizz Kenya! 🚀\nLet’s register your business.',
    {
      reply_markup: {
        keyboard: [['Register Business']],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );
});

// Start Registration
bot.hears('Register Business', (ctx) => {
  ctx.session = {};
  ctx.reply('What is your business name?');

  bot.on('text', collectBusinessName);
});

function collectBusinessName(ctx) {
  ctx.session.name = ctx.message.text;
  ctx.reply('What type of business is it? (e.g., Salon, Electronics, Food)');
  bot.on('text', collectBusinessType);
}

function collectBusinessType(ctx) {
  ctx.session.type = ctx.message.text;
  ctx.reply('Where are you located?');
  bot.on('text', collectLocation);
}

function collectLocation(ctx) {
  ctx.session.location = ctx.message.text;
  ctx.reply('What is your contact phone or email?');
  bot.on('text', collectContact);
}

function collectContact(ctx) {
  ctx.session.contact = ctx.message.text;
  const { name, type, location, contact } = ctx.session;

  ctx.reply(
    `Please confirm your details:\n\n` +
      `📏 Business Name: ${name}\n` +
      `📦 Type: ${type}\n` +
      `📍 Location: ${location}\n` +
      `☎️ Contact: ${contact}`,
    {
      reply_markup: {
        keyboard: [['✅ Confirm', '✏️ Edit']],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );

  bot.hears('✅ Confirm', async (ctx) => {
    const userId = ctx.from.id.toString();
    await db.collection('users').doc(userId).set({
      ...ctx.session,
      isSubscribed: false,
      subscriptionTier: null,
      createdAt: new Date()
    });

    ctx.reply('Choose your subscription:', {
      reply_markup: {
        keyboard: [['Free'], ['Premium (KES 500)']],
        resize_keyboard: true
      }
    });
  });
}

bot.hears(['Free', 'Premium (KES 500)'], async (ctx) => {
  const userId = ctx.from.id.toString();
  const tier = ctx.message.text;

  if (tier === 'Free') {
    await db.collection('users').doc(userId).update({
      isSubscribed: true,
      subscriptionTier: 'Free'
    });

    return ctx.reply('✅ You are now registered under the Free plan. Proceed to the app:', {
      reply_markup: {
        inline_keyboard: [[
          { text: '🚀 Open Dashboard', web_app: { url: `https://yourapp.com/dashboard?userId=${userId}` } }
        ]]
      }
    });
  }

  if (tier === 'Premium (KES 500)') {
    return ctx.reply('Choose a payment method:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 Pay via Telegram', callback_data: 'pay_telegram' }],
          [{ text: '📱 Pay via M-Pesa', web_app: { url: `https://your-mpesa-page.com/pay?userId=${userId}` } }]
        ]
      }
    });
  }
});

bot.command('continue', async (ctx) => {
  const userId = ctx.from.id.toString();
  const userDoc = await db.collection('users').doc(userId).get();

  if (userDoc.exists && userDoc.data().isSubscribed) {
    return ctx.reply('✅ Payment received! Launch your dashboard:', {
      reply_markup: {
        inline_keyboard: [[
          { text: '🚀 Open Dashboard', web_app: { url: `https://yourapp.com/dashboard?userId=${userId}` } }
        ]]
      }
    });
  } else {
    ctx.reply('❌ We couldn’t verify your payment. Please try again or contact support.');
  }
});

bot.launch();
