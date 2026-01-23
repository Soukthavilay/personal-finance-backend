const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

exports.register = async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
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
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
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
