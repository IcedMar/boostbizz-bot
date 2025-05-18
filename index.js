// index.js
require('dotenv').config();
const { Telegraf } = require('telegraf');
const { Markup } = require('telegraf'); 
const db = require('./firebase');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  const user = {
    userId,
    username: ctx.from.username || '',
    firstName: ctx.from.first_name || '',
    lastName: ctx.from.last_name || '',
    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    subscription: 'none',
  };

  try {
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
  } catch (error) {
    console.error('Error saving user to Firestore:', error);
    ctx.reply('⚠️ An error occurred while registering. Please try again later.');
  }
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

    ctx.reply('Choose your subscription plan:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Starter (KES 1500)', callback_data: 'subscribe_starter' }],
          [{ text: 'Standard (KES 3000)', callback_data: 'subscribe_standard' }],
          [{ text: 'Premium (KES 5500)', callback_data: 'subscribe_premium' }],
        ],
      },
    });
  });
}

bot.action(['subscribe_starter', 'subscribe_standard', 'subscribe_premium'], async (ctx) => {
  const userId = ctx.from.id.toString();
  const tier = ctx.callbackQuery.data.split('_')[1]; // Extract 'starter', 'standard', or 'premium'
  let price;

  switch (tier) {
    case 'starter':
      price = 1500;
      break;
    case 'standard':
      price = 3000;
      break;
    case 'premium':
      price = 5500;
      break;
    default:
      return ctx.reply('⚠️ Invalid subscription tier selected.');
  }

  ctx.reply(`You have selected the ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan (KES ${price}). How would you like to pay?`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💳 Telegram Payments', callback_data: `pay_telegram_${tier}` }],
        [{ text: '📱 M-Pesa', web_app: { url: `https://your-mpesa-miniapp.com/pay?userId=${userId}&plan=${tier}&price=${price}` } }],
      ],
    },
  });
});

bot.action(/pay_telegram_(starter|standard|premium)/, async (ctx) => {
  const userId = ctx.from.id.toString();
  const tier = ctx.match[1];
  let price;

  switch (tier) {
    case 'starter':
      price = 1500;
      break;
    case 'standard':
      price = 3000;
      break;
    case 'premium':
      price = 5500;
      break;
    default:
      return ctx.reply('⚠️ Invalid subscription tier for Telegram payment.');
  }

  // In a real application, you would initiate the Telegram payment here.
  // This might involve using a Telegram Payments API and handling the payment process.
  // For this example, we'll just simulate a successful payment.
  await db.collection('users').doc(userId).update({
    isSubscribed: true,
    subscriptionTier: tier
  });

  return ctx.reply(`✅ Payment of KES ${price} for the ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan received! Launch your dashboard:`, {
    reply_markup: {
      inline_keyboard: [[
        { text: '🚀 Open Dashboard', web_app: { url: `https://yourapp.com/dashboard?userId=${userId}` } }
      ]]
    }
  });
});

bot.command('continue', async (ctx) => {
  const userId = ctx.from.id.toString();
  const userDoc = await db.collection('users').doc(userId).get();

  if (userDoc.exists && userDoc.data().isSubscribed) {
    return ctx.reply('✅ Subscription active! Launch your dashboard:', {
      reply_markup: {
        inline_keyboard: [[
          { text: '🚀 Open Dashboard', web_app: { url: `https://yourapp.com/dashboard?userId=${userId}` } }
        ]]
      }
    });
  } else {
    ctx.reply('❌ We couldn’t verify your subscription. Please try again or contact support.');
  }
});

bot.launch();