const db = require('../config/db');

function normalizeTimeHHmm(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return /^\d{2}:\d{2}$/.test(v) ? v : null;
}

exports.getPreferences = async (req, res) => {
  const userId = req.user.id;

  try {
    const [rows] = await db.execute(
      `SELECT user_id, enabled, daily_time, timezone, daily_reminder_enabled, daily_summary_enabled, budget_warning_enabled
       FROM NotificationPreferences
       WHERE user_id = ?`,
      [userId]
    );

    if (rows.length === 0) {
      return res.json({
        user_id: userId,
        enabled: true,
        daily_time: '08:00',
        timezone: 'Asia/Bangkok',
        daily_reminder_enabled: true,
        daily_summary_enabled: true,
        budget_warning_enabled: true
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updatePreferences = async (req, res) => {
  const userId = req.user.id;
  const {
    enabled,
    daily_time,
    timezone,
    daily_reminder_enabled,
    daily_summary_enabled,
    budget_warning_enabled
  } = req.body || {};

  const normalizedTime = daily_time !== undefined ? normalizeTimeHHmm(daily_time) : null;
  if (daily_time !== undefined && !normalizedTime) {
    return res.status(400).json({ message: 'Invalid daily_time format. Use HH:mm' });
  }

  if (timezone !== undefined && (typeof timezone !== 'string' || !timezone.trim())) {
    return res.status(400).json({ message: 'Invalid timezone' });
  }

  try {
    await db.execute(
      `INSERT INTO NotificationPreferences
        (user_id, enabled, daily_time, timezone, daily_reminder_enabled, daily_summary_enabled, budget_warning_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        enabled = VALUES(enabled),
        daily_time = VALUES(daily_time),
        timezone = VALUES(timezone),
        daily_reminder_enabled = VALUES(daily_reminder_enabled),
        daily_summary_enabled = VALUES(daily_summary_enabled),
        budget_warning_enabled = VALUES(budget_warning_enabled)`,
      [
        userId,
        enabled === undefined ? true : !!enabled,
        normalizedTime || '08:00',
        (timezone || 'Asia/Bangkok').trim(),
        daily_reminder_enabled === undefined ? true : !!daily_reminder_enabled,
        daily_summary_enabled === undefined ? true : !!daily_summary_enabled,
        budget_warning_enabled === undefined ? true : !!budget_warning_enabled
      ]
    );

    res.json({ message: 'Notification preferences updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.upsertDeviceToken = async (req, res) => {
  const userId = req.user.id;
  const { token, platform } = req.body || {};

  const normalizedToken = typeof token === 'string' ? token.trim() : '';
  const normalizedPlatform = typeof platform === 'string' ? platform.trim().toLowerCase() : '';

  if (!normalizedToken || !normalizedPlatform) {
    return res.status(400).json({ message: 'token and platform are required' });
  }

  if (normalizedPlatform !== 'ios' && normalizedPlatform !== 'android') {
    return res.status(400).json({ message: 'platform must be ios or android' });
  }

  try {
    await db.execute(
      `INSERT INTO UserDevices (user_id, token, platform, last_seen_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         platform = VALUES(platform),
         last_seen_at = VALUES(last_seen_at)`,
      [userId, normalizedToken, normalizedPlatform]
    );

    res.status(201).json({ message: 'Device token saved' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteDeviceToken = async (req, res) => {
  const userId = req.user.id;
  const { token } = req.body || {};
  const normalizedToken = typeof token === 'string' ? token.trim() : '';

  if (!normalizedToken) {
    return res.status(400).json({ message: 'token is required' });
  }

  try {
    const [result] = await db.execute('DELETE FROM UserDevices WHERE user_id = ? AND token = ?', [userId, normalizedToken]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Device token not found' });
    }

    res.json({ message: 'Device token deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
