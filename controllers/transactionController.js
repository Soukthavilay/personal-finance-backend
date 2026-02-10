const db = require('../config/db');

async function getCategoryType(categoryId, userId) {
  const [rows] = await db.execute(
    'SELECT type FROM Categories WHERE id = ? AND user_id = ?',
    [categoryId, userId],
  );
  return rows && rows[0] && rows[0].type;
}

function deltaForCategoryType(categoryType, amount) {
  if (categoryType === 'income') return amount;
  if (categoryType === 'expense') return -amount;
  return null;
}

exports.getAllTransactions = async (req, res) => {
  const { startDate, endDate, categoryId, categoryStr, walletId, wallet_id, limit, offset } = req.query;
  const userId = req.user.id;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if ((startDate && !endDate) || (!startDate && endDate)) {
    return res.status(400).json({ message: 'startDate and endDate must be provided together' });
  }
  if (startDate && endDate && (!dateRegex.test(startDate) || !dateRegex.test(endDate))) {
    return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
  }

  const parsedLimit = limit !== undefined ? Number.parseInt(String(limit), 10) : 50;
  const parsedOffset = offset !== undefined ? Number.parseInt(String(offset), 10) : 0;
  const pageLimit = Math.min(Number.isFinite(parsedLimit) ? parsedLimit : 50, 200);
  const pageOffset = Math.max(Number.isFinite(parsedOffset) ? parsedOffset : 0, 0);

  const categoryFilter = categoryId || categoryStr;
  const walletFilter = walletId || wallet_id;

  let query = `SELECT t.*, c.name AS category_name, c.type AS category_type,
                w.name AS wallet_name, w.type AS wallet_type, w.currency AS wallet_currency
               FROM Transactions t
               LEFT JOIN Categories c ON t.category_id = c.id AND c.user_id = t.user_id
               LEFT JOIN Wallets w ON t.wallet_id = w.id AND w.user_id = t.user_id
               WHERE t.user_id = ?`;
  let params = [userId];

  if (startDate && endDate) {
    query += ' AND transaction_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  if (categoryFilter) {
      query += ' AND t.category_id = ?';
      params.push(categoryFilter);
  }

  if (walletFilter) {
    query += ' AND t.wallet_id = ?';
    params.push(walletFilter);
  }

  query += ` ORDER BY t.transaction_date DESC LIMIT ${pageLimit} OFFSET ${pageOffset}`;

  try {
    const [transactions] = await db.execute(query, params);
    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getTransactionById = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const [transactions] = await db.execute(
      `SELECT t.*, c.name AS category_name, c.type AS category_type,
        w.name AS wallet_name, w.type AS wallet_type, w.currency AS wallet_currency
       FROM Transactions t
       LEFT JOIN Categories c ON t.category_id = c.id AND c.user_id = t.user_id
       LEFT JOIN Wallets w ON t.wallet_id = w.id AND w.user_id = t.user_id
       WHERE t.id = ? AND t.user_id = ?`,
      [id, userId]
    );

    if (transactions.length === 0) {
      return res.status(404).json({ message: 'Transaction not found or unauthorized' });
    }

    res.json(transactions[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createTransaction = async (req, res) => {
  const { category_id, wallet_id, amount, transaction_date, description } = req.body;
  const userId = req.user.id;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const numericAmount = Number(amount);

  if (!wallet_id) {
    return res.status(400).json({ message: 'wallet_id is required' });
  }

  if (!category_id || !amount || !transaction_date) {
    return res.status(400).json({ message: 'Category, amount, and date are required' });
  }

  const walletIdNum = Number(wallet_id);
  if (!Number.isInteger(walletIdNum) || walletIdNum <= 0) {
    return res.status(400).json({ message: 'Invalid wallet_id' });
  }

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ message: 'Invalid amount' });
  }

  if (!dateRegex.test(transaction_date)) {
    return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
  }

  try {
    if (category_id) {
      const [categories] = await db.execute('SELECT id FROM Categories WHERE id = ? AND user_id = ?', [category_id, userId]);
      if (categories.length === 0) {
        return res.status(400).json({ message: 'Invalid category' });
      }
    }

    const [wallets] = await db.execute('SELECT id FROM Wallets WHERE id = ? AND user_id = ?', [walletIdNum, userId]);
    if (wallets.length === 0) {
      return res.status(400).json({ message: 'Invalid wallet_id' });
    }

    const categoryType = await getCategoryType(category_id, userId);
    const delta = deltaForCategoryType(categoryType, numericAmount);
    if (delta === null) {
      return res.status(400).json({ message: 'Invalid category type' });
    }

    const [result] = await db.execute(
      'INSERT INTO Transactions (user_id, category_id, wallet_id, amount, transaction_date, description) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, category_id, walletIdNum, numericAmount, transaction_date, description]
    );

    await db.execute(
      'UPDATE Wallets SET balance = balance + ? WHERE id = ? AND user_id = ?',
      [delta, walletIdNum, userId],
    );

    res.status(201).json({ id: result.insertId, user_id: userId, category_id, wallet_id: walletIdNum, amount, transaction_date, description });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateTransaction = async (req, res) => {
  const { id } = req.params;
  const { category_id, wallet_id, amount, transaction_date, description } = req.body;
  const userId = req.user.id;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const numericAmount = Number(amount);

  if (!wallet_id) {
    return res.status(400).json({ message: 'wallet_id is required' });
  }

  const walletIdNum = Number(wallet_id);
  if (!Number.isInteger(walletIdNum) || walletIdNum <= 0) {
    return res.status(400).json({ message: 'Invalid wallet_id' });
  }

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ message: 'Invalid amount' });
  }

  if (!dateRegex.test(transaction_date)) {
    return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
  }

  try {
    if (category_id) {
      const [categories] = await db.execute('SELECT id FROM Categories WHERE id = ? AND user_id = ?', [category_id, userId]);
      if (categories.length === 0) {
        return res.status(400).json({ message: 'Invalid category' });
      }
    }

    const [wallets] = await db.execute('SELECT id FROM Wallets WHERE id = ? AND user_id = ?', [walletIdNum, userId]);
    if (wallets.length === 0) {
      return res.status(400).json({ message: 'Invalid wallet_id' });
    }

    const oldCategoryType = await getCategoryType(existingTx.category_id, userId);
    const newCategoryType = await getCategoryType(category_id, userId);
    const oldAmountNum = Number(existingTx.amount);
    const oldDelta = deltaForCategoryType(oldCategoryType, oldAmountNum);
    const newDelta = deltaForCategoryType(newCategoryType, numericAmount);
    if (oldDelta === null || newDelta === null) {
      return res.status(400).json({ message: 'Invalid category type' });
    }

    const [result] = await db.execute(
      'UPDATE Transactions SET category_id = ?, wallet_id = ?, amount = ?, transaction_date = ?, description = ? WHERE id = ? AND user_id = ?',
      [category_id, walletIdNum, numericAmount, transaction_date, description, id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Transaction not found or unauthorized' });
    }

    const oldWalletIdNum = Number(existingTx.wallet_id);
    if (oldWalletIdNum === walletIdNum) {
      const diff = newDelta - oldDelta;
      if (diff !== 0) {
        await db.execute(
          'UPDATE Wallets SET balance = balance + ? WHERE id = ? AND user_id = ?',
          [diff, walletIdNum, userId],
        );
      }
    } else {
      await db.execute(
        'UPDATE Wallets SET balance = balance - ? WHERE id = ? AND user_id = ?',
        [oldDelta, oldWalletIdNum, userId],
      );
      await db.execute(
        'UPDATE Wallets SET balance = balance + ? WHERE id = ? AND user_id = ?',
        [newDelta, walletIdNum, userId],
      );
    }

    res.json({ message: 'Transaction updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteTransaction = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const [txRows] = await db.execute(
      'SELECT id, wallet_id, category_id, amount FROM Transactions WHERE id = ? AND user_id = ?',
      [id, userId],
    );
    if (!txRows || txRows.length === 0) {
      return res.status(404).json({ message: 'Transaction not found or unauthorized' });
    }
    const tx = txRows[0];

    const [result] = await db.execute('DELETE FROM Transactions WHERE id = ? AND user_id = ?', [id, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Transaction not found or unauthorized' });
    }

    const categoryType = await getCategoryType(tx.category_id, userId);
    const amountNum = Number(tx.amount);
    const delta = deltaForCategoryType(categoryType, amountNum);
    if (delta === null) {
      return res.status(400).json({ message: 'Invalid category type' });
    }

    await db.execute(
      'UPDATE Wallets SET balance = balance - ? WHERE id = ? AND user_id = ?',
      [delta, Number(tx.wallet_id), userId],
    );

    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
