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

function normalizeType(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (v !== 'cash' && v !== 'bank' && v !== 'credit') return null;
  return v;
}

function normalizeBalance(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

exports.getAllWallets = async (req, res) => {
  const userId = req.user.id;

  try {
    const [wallets] = await db.execute(
      'SELECT id, user_id, name, type, currency, balance, is_default, created_at, updated_at FROM Wallets WHERE user_id = ? ORDER BY is_default DESC, id ASC',
      [userId]
    );
    res.json(wallets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createWallet = async (req, res) => {
  const userId = req.user.id;
  const body = req.body || {};

  const name = normalizeString(body.name, 255);
  const type = normalizeType(body.type);
  const currency = normalizeCurrency(body.currency);
  const balance = normalizeBalance(body.balance);
  const isDefault = body.is_default === undefined ? false : !!body.is_default;

  if (!name) {
    return res.status(400).json({ message: 'Invalid name' });
  }
  if (!type) {
    return res.status(400).json({ message: 'Invalid type' });
  }
  if (currency === null) {
    return res.status(400).json({ message: 'Invalid currency' });
  }
  if (balance === null) {
    return res.status(400).json({ message: 'Invalid balance' });
  }

  try {
    let finalCurrency = currency;
    if (finalCurrency === undefined) {
      const [userRows] = await db.execute('SELECT currency FROM Users WHERE id = ?', [userId]);
      finalCurrency = (userRows[0] && userRows[0].currency) || 'VND';
    }

    if (isDefault) {
      await db.execute('UPDATE Wallets SET is_default = 0 WHERE user_id = ?', [userId]);
    }

    const [result] = await db.execute(
      'INSERT INTO Wallets (user_id, name, type, currency, balance, is_default) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, name, type, finalCurrency, balance === undefined ? 0 : balance, isDefault]
    );

    const [rows] = await db.execute(
      'SELECT id, user_id, name, type, currency, balance, is_default, created_at, updated_at FROM Wallets WHERE id = ? AND user_id = ?',
      [result.insertId, userId]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateWallet = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const body = req.body || {};

  const name = normalizeString(body.name, 255);
  const type = normalizeType(body.type);
  const currency = normalizeCurrency(body.currency);
  const balance = normalizeBalance(body.balance);
  const isDefault = body.is_default === undefined ? undefined : !!body.is_default;

  if (body.name !== undefined && body.name !== null && name === null) {
    return res.status(400).json({ message: 'Invalid name' });
  }
  if (body.type !== undefined && type === null) {
    return res.status(400).json({ message: 'Invalid type' });
  }
  if (currency === null) {
    return res.status(400).json({ message: 'Invalid currency' });
  }
  if (balance === null) {
    return res.status(400).json({ message: 'Invalid balance' });
  }

  try {
    const [existing] = await db.execute('SELECT id FROM Wallets WHERE id = ? AND user_id = ?', [id, userId]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Wallet not found or unauthorized' });
    }

    if (isDefault === true) {
      await db.execute('UPDATE Wallets SET is_default = 0 WHERE user_id = ?', [userId]);
    }

    const setParts = [];
    const params = [];

    if (name !== undefined) {
      setParts.push('name = ?');
      params.push(name);
    }
    if (type !== undefined) {
      setParts.push('type = ?');
      params.push(type);
    }
    if (currency !== undefined) {
      setParts.push('currency = ?');
      params.push(currency);
    }
    if (balance !== undefined) {
      setParts.push('balance = ?');
      params.push(balance);
    }
    if (isDefault !== undefined) {
      setParts.push('is_default = ?');
      params.push(isDefault);
    }

    if (setParts.length === 0) {
      const [rows] = await db.execute(
        'SELECT id, user_id, name, type, currency, balance, is_default, created_at, updated_at FROM Wallets WHERE id = ? AND user_id = ?',
        [id, userId]
      );
      return res.json(rows[0]);
    }

    params.push(id, userId);

    const [result] = await db.execute(`UPDATE Wallets SET ${setParts.join(', ')} WHERE id = ? AND user_id = ?`, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Wallet not found or unauthorized' });
    }

    const [rows] = await db.execute(
      'SELECT id, user_id, name, type, currency, balance, is_default, created_at, updated_at FROM Wallets WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteWallet = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const [txCountResult] = await db.execute('SELECT COUNT(*) as count FROM Transactions WHERE user_id = ? AND wallet_id = ?', [userId, id]);
    if (txCountResult[0].count > 0) {
      return res.status(400).json({ message: 'Wallet is in use by transactions and cannot be deleted' });
    }

    const [result] = await db.execute('DELETE FROM Wallets WHERE id = ? AND user_id = ?', [id, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Wallet not found or unauthorized' });
    }

    res.json({ message: 'Wallet deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
