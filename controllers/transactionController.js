const db = require('../config/db');

exports.getAllTransactions = async (req, res) => {
  const { startDate, endDate, categoryId, categoryStr, limit, offset } = req.query;
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

  let query = `SELECT t.*, c.name AS category_name, c.type AS category_type
               FROM Transactions t
               LEFT JOIN Categories c ON t.category_id = c.id AND c.user_id = t.user_id
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
      `SELECT t.*, c.name AS category_name, c.type AS category_type
       FROM Transactions t
       LEFT JOIN Categories c ON t.category_id = c.id AND c.user_id = t.user_id
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
  const { category_id, amount, transaction_date, description } = req.body;
  const userId = req.user.id;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const numericAmount = Number(amount);

  if (!category_id || !amount || !transaction_date) {
    return res.status(400).json({ message: 'Category, amount, and date are required' });
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

    const [result] = await db.execute(
      'INSERT INTO Transactions (user_id, category_id, amount, transaction_date, description) VALUES (?, ?, ?, ?, ?)',
      [userId, category_id, numericAmount, transaction_date, description]
    );
    res.status(201).json({ id: result.insertId, user_id: userId, category_id, amount, transaction_date, description });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateTransaction = async (req, res) => {
  const { id } = req.params;
  const { category_id, amount, transaction_date, description } = req.body;
  const userId = req.user.id;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const numericAmount = Number(amount);

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

    const [result] = await db.execute(
      'UPDATE Transactions SET category_id = ?, amount = ?, transaction_date = ?, description = ? WHERE id = ? AND user_id = ?',
      [category_id, numericAmount, transaction_date, description, id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Transaction not found or unauthorized' });
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
    const [result] = await db.execute('DELETE FROM Transactions WHERE id = ? AND user_id = ?', [id, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Transaction not found or unauthorized' });
    }

    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
