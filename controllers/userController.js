const db = require('../config/db');

function normalizeString(value, maxLen) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (typeof maxLen === 'number' && trimmed.length > maxLen) return null;
  return trimmed;
}

function normalizeCurrency(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(trimmed)) return null;
  return trimmed;
}

exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const [users] = await db.execute(
      'SELECT id, username, email, full_name, currency, timezone, avatar_url, created_at FROM Users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateMe = async (req, res) => {
  const userId = req.user.id;
  const body = req.body || {};

  const fullName = normalizeString(body.full_name, 255);
  if (body.full_name !== undefined && body.full_name !== null && fullName === null) {
    return res.status(400).json({ message: 'Invalid full_name' });
  }

  const currency = normalizeCurrency(body.currency);
  if (currency === null) {
    return res.status(400).json({ message: 'Invalid currency' });
  }

  const timezone = normalizeString(body.timezone, 64);
  if (body.timezone !== undefined && body.timezone !== null && timezone === null) {
    return res.status(400).json({ message: 'Invalid timezone' });
  }

  const avatarUrl = normalizeString(body.avatar_url, 2048);
  if (body.avatar_url !== undefined && body.avatar_url !== null && avatarUrl === null) {
    return res.status(400).json({ message: 'Invalid avatar_url' });
  }

  const updates = [];
  const params = [];

  if (fullName !== undefined) {
    updates.push('full_name = ?');
    params.push(fullName);
  }

  if (currency !== undefined) {
    updates.push('currency = ?');
    params.push(currency);
  }

  if (timezone !== undefined) {
    updates.push('timezone = ?');
    params.push(timezone);
  }

  if (avatarUrl !== undefined) {
    updates.push('avatar_url = ?');
    params.push(avatarUrl);
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  try {
    params.push(userId);
    await db.execute(`UPDATE Users SET ${updates.join(', ')} WHERE id = ?`, params);

    const [users] = await db.execute(
      'SELECT id, username, email, full_name, currency, timezone, avatar_url, created_at FROM Users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
