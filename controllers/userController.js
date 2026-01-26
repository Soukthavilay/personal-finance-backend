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

function normalizePositiveDecimal(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function normalizeLanguage(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (v !== 'vi' && v !== 'en') return null;
  return v;
}

function normalizeDateFormat(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (v !== 'YYYY-MM-DD' && v !== 'DD/MM/YYYY' && v !== 'MM/DD/YYYY') return null;
  return v;
}

function normalizeWeekStartDay(value) {
  if (value === undefined) return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 7) return null;
  return n;
}

function normalizePhone(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (v.length > 32) return null;
  if (!/^[0-9+\-()\s]+$/.test(v)) return null;
  return v;
}

function normalizeGender(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v !== 'male' && v !== 'female' && v !== 'other') return null;
  return v;
}

function normalizeDob(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const [users] = await db.execute(
      `SELECT id, username, email, full_name, currency, timezone, avatar_url,
        monthly_income_target, language, date_format, week_start_day, phone, gender,
        DATE_FORMAT(dob, '%Y-%m-%d') AS dob,
        last_login_at, created_at
       FROM Users WHERE id = ?`,
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

  const monthlyIncomeTarget = normalizePositiveDecimal(body.monthly_income_target);
  if (body.monthly_income_target !== undefined && monthlyIncomeTarget === null) {
    return res.status(400).json({ message: 'Invalid monthly_income_target' });
  }

  const language = normalizeLanguage(body.language);
  if (language === null) {
    return res.status(400).json({ message: 'Invalid language' });
  }

  const dateFormat = normalizeDateFormat(body.date_format);
  if (dateFormat === null) {
    return res.status(400).json({ message: 'Invalid date_format' });
  }

  const weekStartDay = normalizeWeekStartDay(body.week_start_day);
  if (weekStartDay === null) {
    return res.status(400).json({ message: 'Invalid week_start_day' });
  }

  const phone = normalizePhone(body.phone);
  if (body.phone !== undefined && phone === null) {
    return res.status(400).json({ message: 'Invalid phone' });
  }

  const gender = normalizeGender(body.gender);
  if (body.gender !== undefined && gender === null) {
    return res.status(400).json({ message: 'Invalid gender' });
  }

  const dob = normalizeDob(body.dob);
  if (body.dob !== undefined && dob === null) {
    return res.status(400).json({ message: 'Invalid dob' });
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

  if (monthlyIncomeTarget !== undefined) {
    updates.push('monthly_income_target = ?');
    params.push(monthlyIncomeTarget);
  }

  if (language !== undefined) {
    updates.push('language = ?');
    params.push(language);
  }

  if (dateFormat !== undefined) {
    updates.push('date_format = ?');
    params.push(dateFormat);
  }

  if (weekStartDay !== undefined) {
    updates.push('week_start_day = ?');
    params.push(weekStartDay);
  }

  if (phone !== undefined) {
    updates.push('phone = ?');
    params.push(phone);
  }

  if (gender !== undefined) {
    updates.push('gender = ?');
    params.push(gender);
  }

  if (dob !== undefined) {
    updates.push('dob = ?');
    params.push(dob);
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  try {
    params.push(userId);
    await db.execute(`UPDATE Users SET ${updates.join(', ')} WHERE id = ?`, params);

    const [users] = await db.execute(
      `SELECT id, username, email, full_name, currency, timezone, avatar_url,
        monthly_income_target, language, date_format, week_start_day, phone, gender,
        DATE_FORMAT(dob, '%Y-%m-%d') AS dob,
        last_login_at, created_at
       FROM Users WHERE id = ?`,
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
