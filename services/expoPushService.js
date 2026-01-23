async function sendExpoPushNotifications(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: true, tickets: [] };
  }

  const url = 'https://exp.host/--/api/v2/push/send';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(messages)
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return { ok: false, status: res.status, data };
  }

  return { ok: true, tickets: data && data.data ? data.data : data };
}

function isExpoPushToken(token) {
  return typeof token === 'string' && token.startsWith('ExponentPushToken[');
}

module.exports = {
  sendExpoPushNotifications,
  isExpoPushToken
};
