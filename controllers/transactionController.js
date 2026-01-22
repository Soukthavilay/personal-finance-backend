const db = require('../config/db');

exports.getAllTransactions = async (req, res) => {
  const { startDate, endDate, categoryStr } = req.query;
  const userId = req.user.id;

  let query = 'SELECT * FROM Transactions WHERE user_id = ?';
  let params = [userId];

  if (startDate && endDate) {
    query += ' AND transaction_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  if (categoryStr) {
      query += ' AND category_id = ?';
      params.push(categoryStr);
  }

  query += ' ORDER BY transaction_date DESC';

  try {
    const [transactions] = await db.execute(query, params);
    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createTransaction = async (req, res) => {
  const { category_id, amount, transaction_date, description } = req.body;
  const userId = req.user.id;

  if (!category_id || !amount || !transaction_date) {
    return res.status(400).json({ message: 'Category, amount, and date are required' });
  }

  try {
    const [result] = await db.execute(
      'INSERT INTO Transactions (user_id, category_id, amount, transaction_date, description) VALUES (?, ?, ?, ?, ?)',
      [userId, category_id, amount, transaction_date, description]
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

  try {
    const [result] = await db.execute(
      'UPDATE Transactions SET category_id = ?, amount = ?, transaction_date = ?, description = ? WHERE id = ? AND user_id = ?',
      [category_id, amount, transaction_date, description, id, userId]
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
