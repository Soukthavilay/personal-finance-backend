const fs = require('fs');

let initialized = false;
let admin = null;

function ensureInitialized() {
  if (initialized) return;
  initialized = true;

  const serviceAccountPath = process.env.FCM_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    return;
  }

  try {
    // Lazy require so local dev/tests don't need firebase-admin installed/initialized.
    // But package.json includes it; still keep lazy to avoid misconfig crashes.
    admin = require('firebase-admin');

    if (admin.apps && admin.apps.length > 0) {
      return;
    }

    const raw = fs.readFileSync(serviceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(raw);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (err) {
    console.error('FCM initialization failed:', err);
    admin = null;
  }
}

async function sendToTokens(tokens, payload) {
  ensureInitialized();

  if (!admin) {
    return { sent: 0, failed: tokens.length, errors: ['FCM not configured'] };
  }

  if (!Array.isArray(tokens) || tokens.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  const message = {
    tokens,
    notification: payload.notification,
    data: payload.data
  };

  const response = await admin.messaging().sendEachForMulticast(message);
  const errors = [];

  response.responses.forEach((r, idx) => {
    if (!r.success && r.error) {
      errors.push({ token: tokens[idx], code: r.error.code, message: r.error.message });
    }
  });

  return {
    sent: response.successCount,
    failed: response.failureCount,
    errors
  };
}

module.exports = {
  sendToTokens
};
