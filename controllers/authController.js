const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

function normalizeEmail(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function normalizeUsername(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function isValidEmail(email) {
  // Simple, pragmatic email check for coursework projects.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
  // 3-20 chars, letters/numbers/._ only
  return /^[a-zA-Z0-9._]{3,20}$/.test(username);
}

function isStrongPassword(password) {
  // 8-64 chars, at least 1 letter and 1 number
  if (typeof password !== 'string') return false;
  if (password.length < 8 || password.length > 64) return false;
  if (!/[A-Za-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

exports.register = async (req, res) => {
  const rawUsername = req.body && req.body.username;
  const rawEmail = req.body && req.body.email;
  const rawPassword = req.body && req.body.password;

  const username = normalizeUsername(rawUsername);
  const email = normalizeEmail(rawEmail);
  const password = typeof rawPassword === 'string' ? rawPassword : '';

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (!isValidUsername(username)) {
    return res.status(400).json({ message: 'Invalid username. Use 3-20 chars: letters, numbers, . or _' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({ message: 'Password must be 8-64 characters and include letters and numbers' });
  }

  try {
    const [existingUsers] = await db.execute('SELECT * FROM Users WHERE email = ?', [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [result] = await db.execute('INSERT INTO Users (username, email, password_hash) VALUES (?, ?, ?)', [username, email, passwordHash]);

    const userId = result.insertId;
    const defaultCategories = [
      { name: 'Salary', type: 'income' },
      { name: 'Bonus', type: 'income' },
      { name: 'Other Income', type: 'income' },
      { name: 'Food', type: 'expense' },
      { name: 'Transportation', type: 'expense' },
      { name: 'Rent', type: 'expense' },
      { name: 'Utilities', type: 'expense' },
      { name: 'Entertainment', type: 'expense' },
      { name: 'Shopping', type: 'expense' },
      { name: 'Healthcare', type: 'expense' },
      { name: 'Education', type: 'expense' },
      { name: 'Other Expense', type: 'expense' }
    ];

    const values = defaultCategories.map((c) => [userId, c.name, c.type]);
    await db.query('INSERT INTO Categories (user_id, name, type) VALUES ?', [values]);

    await db.execute(
      `INSERT INTO Wallets (user_id, name, type, currency, balance, is_default)
       SELECT id, 'Cash', 'cash', currency, 0, 1
       FROM Users
       WHERE id = ?`,
      [userId]
    );

    await db.execute(
      `INSERT INTO NotificationPreferences
        (user_id, enabled, daily_time, timezone, daily_reminder_enabled, daily_summary_enabled, budget_warning_enabled)
       VALUES (?, 1, '08:00', 'Asia/Bangkok', 1, 1, 1)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [userId]
    );

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.forgotPassword = async (req, res) => {
  const rawEmail = req.body && req.body.email;
  const email = normalizeEmail(rawEmail);

  if (!email) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  try {
    const [users] = await db.execute('SELECT id FROM Users WHERE email = ? LIMIT 1', [email]);
    if (users.length === 0) {
      return res.json({ message: 'If the email exists, a reset token has been generated' });
    }

    const userId = users[0].id;
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = sha256Hex(resetToken);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await db.execute(
      'UPDATE Users SET reset_password_token_hash = ?, reset_password_expires_at = ? WHERE id = ?',
      [resetTokenHash, expiresAt, userId]
    );

    if (process.env.NODE_ENV === 'production') {
      return res.json({ message: 'If the email exists, a reset token has been generated' });
    }

    return res.json({ message: 'Reset token generated', resetToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.resetPassword = async (req, res) => {
  const rawEmail = req.body && req.body.email;
  const rawToken = req.body && req.body.token;
  const rawNewPassword = req.body && req.body.newPassword;

  const email = normalizeEmail(rawEmail);
  const token = typeof rawToken === 'string' ? rawToken.trim() : '';
  const newPassword = typeof rawNewPassword === 'string' ? rawNewPassword : '';

  if (!email || !token || !newPassword) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ message: 'Password must be 8-64 characters and include letters and numbers' });
  }

  try {
    const tokenHash = sha256Hex(token);
    const [users] = await db.execute(
      `SELECT id
       FROM Users
       WHERE email = ?
         AND reset_password_token_hash = ?
         AND reset_password_expires_at IS NOT NULL
         AND reset_password_expires_at > NOW()
       LIMIT 1`,
      [email, tokenHash]
    );

    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const userId = users[0].id;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await db.execute(
      'UPDATE Users SET password_hash = ?, reset_password_token_hash = NULL, reset_password_expires_at = NULL WHERE id = ?',
      [passwordHash, userId]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.csrf = async (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');

  res.cookie('csrfToken', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 1000
  });

  res.json({ csrfToken: token });
};

exports.login = async (req, res) => {
  const rawEmail = req.body && req.body.email;
  const rawPassword = req.body && req.body.password;

  const email = normalizeEmail(rawEmail);
  const password = typeof rawPassword === 'string' ? rawPassword : '';

  if (!email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  try {
    const [users] = await db.execute('SELECT * FROM Users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    await db.execute('UPDATE Users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1h' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000
    });

    res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.logout = async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  res.json({ message: 'Logged out' });
};

exports.me = async (req, res) => {
  try {
    const userId = req.user.id;
    const [users] = await db.execute('SELECT id, username, email FROM Users WHERE id = ?', [userId]);

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
