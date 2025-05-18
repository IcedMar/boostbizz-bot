const admin = require('firebase-admin');

const base64Key = process.env.FIREBASE_CONFIG_BASE64;
if (!base64Key) throw new Error("Missing FIREBASE_CONFIG_BASE64 env variable");

const serviceAccount = JSON.parse(Buffer.from(base64Key, 'base64').toString('utf-8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = db;
