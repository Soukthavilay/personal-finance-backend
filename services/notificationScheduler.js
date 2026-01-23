const cron = require('node-cron');
const { DateTime } = require('luxon');
const db = require('../config/db');
const { sendToTokens } = require('./fcmService');
const { isExpoPushToken, sendExpoPushNotifications } = require('./expoPushService');

let task = null;

function safeZone(zone) {
  if (typeof zone !== 'string' || !zone.trim()) return 'Asia/Bangkok';
  const dt = DateTime.now().setZone(zone.trim());
  return dt.isValid ? zone.trim() : 'Asia/Bangkok';
}

async function buildDailyMessage(userId, nowInZone) {
  const today = nowInZone.toFormat('yyyy-LL-dd');
  const period = nowInZone.toFormat('yyyy-LL');

  // Daily totals for today
  const [incomeRows] = await db.execute(
    `SELECT SUM(t.amount) as total
     FROM Transactions t
     JOIN Categories c ON t.category_id = c.id
     WHERE t.user_id = ? AND c.user_id = t.user_id AND c.type = 'income' AND t.transaction_date = ?`,
    [userId, today]
  );

  const [expenseRows] = await db.execute(
    `SELECT SUM(t.amount) as total
     FROM Transactions t
     JOIN Categories c ON t.category_id = c.id
     WHERE t.user_id = ? AND c.user_id = t.user_id AND c.type = 'expense' AND t.transaction_date = ?`,
    [userId, today]
  );

  const income = Number(incomeRows[0].total || 0);
  const expense = Number(expenseRows[0].total || 0);

  // Budget warning: month-to-date expense by category compared to budgets for this period
  const [warnings] = await db.execute(
    `SELECT c.name AS category_name,
            b.amount AS budget_amount,
            COALESCE(SUM(t.amount), 0) AS spent_amount
     FROM Budgets b
     JOIN Categories c ON b.category_id = c.id AND c.user_id = b.user_id
     LEFT JOIN Transactions t
       ON t.user_id = b.user_id
      AND t.category_id = b.category_id
      AND t.transaction_date BETWEEN CONCAT(?, '-01') AND ?
     WHERE b.user_id = ? AND b.period = ?
     GROUP BY b.id, c.name, b.amount
     HAVING spent_amount > budget_amount
     ORDER BY (spent_amount - budget_amount) DESC
     LIMIT 3`,
    [period, today, userId, period]
  );

  const warningText = warnings.length
    ? `Over budget: ${warnings
        .map((w) => `${w.category_name} ${Number(w.spent_amount).toFixed(2)}/${Number(w.budget_amount).toFixed(2)}`)
        .join(', ')}`
    : '';

  const title = 'Daily Finance Reminder';
  const parts = [`Today income: ${income.toFixed(2)}`, `Today expense: ${expense.toFixed(2)}`];
  if (warningText) parts.push(warningText);

  return {
    title,
    body: parts.join(' | '),
    data: {
      type: 'daily',
      date: today,
      period
    }
  };
}

async function runTick() {
  // Load all enabled prefs and decide who to send now.
  const [prefs] = await db.execute(
    `SELECT user_id, enabled, daily_time, timezone, daily_reminder_enabled, daily_summary_enabled, budget_warning_enabled, last_daily_sent_on
     FROM NotificationPreferences
     WHERE enabled = 1`
  );

  for (const p of prefs) {
    const zone = safeZone(p.timezone);
    const now = DateTime.now().setZone(zone);
    if (!now.isValid) continue;

    const currentHHmm = now.toFormat('HH:mm');
    const dailyTime = typeof p.daily_time === 'string' ? p.daily_time : '08:00';

    if (currentHHmm !== dailyTime) continue;

    const todayStr = now.toFormat('yyyy-LL-dd');
    const lastSent = p.last_daily_sent_on ? DateTime.fromJSDate(new Date(p.last_daily_sent_on)).toFormat('yyyy-LL-dd') : null;

    if (lastSent === todayStr) continue;

    const [devices] = await db.execute('SELECT token FROM UserDevices WHERE user_id = ?', [p.user_id]);
    const rawTokens = devices.map((d) => d.token).filter(Boolean);
    if (rawTokens.length === 0) {
      await db.execute('UPDATE NotificationPreferences SET last_daily_sent_on = ? WHERE user_id = ?', [todayStr, p.user_id]);
      continue;
    }

    const expoTokens = rawTokens.filter(isExpoPushToken);
    const fcmTokens = rawTokens.filter((t) => !isExpoPushToken(t));

    const msg = await buildDailyMessage(p.user_id, now);

    const payload = {
      notification: {
        title: msg.title,
        body: msg.body
      },
      data: msg.data
    };

    if (fcmTokens.length > 0) {
      const result = await sendToTokens(fcmTokens, payload);

      // Remove invalid tokens
      if (result.errors && result.errors.length > 0) {
        for (const e of result.errors) {
          if (e.code === 'messaging/registration-token-not-registered' || e.code === 'messaging/invalid-registration-token') {
            await db.execute('DELETE FROM UserDevices WHERE token = ?', [e.token]);
          }
        }
      }
    }

    if (expoTokens.length > 0) {
      const messages = expoTokens.map((to) => ({
        to,
        title: payload.notification.title,
        body: payload.notification.body,
        data: payload.data
      }));

      const result = await sendExpoPushNotifications(messages);
      if (result && result.ok && Array.isArray(result.tickets)) {
        result.tickets.forEach(async (ticket, idx) => {
          if (ticket && ticket.status === 'error') {
            // Common errors: DeviceNotRegistered
            if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
              await db.execute('DELETE FROM UserDevices WHERE token = ?', [expoTokens[idx]]);
            }
          }
        });
      }
    }

    await db.execute('UPDATE NotificationPreferences SET last_daily_sent_on = ? WHERE user_id = ?', [todayStr, p.user_id]);
  }
}

function startScheduler() {
  if (task) return;

  // If FCM is not configured, still run (it will no-op); you can disable via env.
  if (process.env.NOTIFICATIONS_SCHEDULER_ENABLED === 'false') {
    return;
  }

  task = cron.schedule('* * * * *', async () => {
    try {
      await runTick();
    } catch (err) {
      console.error('Notification scheduler tick failed:', err);
    }
  });
}

function stopScheduler() {
  if (!task) return;
  task.stop();
  task = null;
}

module.exports = {
  startScheduler,
  stopScheduler
};
