const db = require('../config/db');

exports.getAllBudgets = async (req, res) => {
  const userId = req.user.id;
  const { period } = req.query;

  let query = 'SELECT b.*, c.name as category_name FROM Budgets b JOIN Categories c ON b.category_id = c.id AND c.user_id = b.user_id WHERE b.user_id = ?';
  let params = [userId];

  if (period) {
    query += ' AND b.period = ?';
    params.push(period);
  }

  try {
    const [budgets] = await db.execute(query, params);
    res.json(budgets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createBudget = async (req, res) => {
  const userId = req.user.id;
  const { category_id, amount, period } = req.body;

  const numericAmount = Number(amount);
  const periodRegex = /^\d{4}-\d{2}$/;

  if (!category_id || !amount || !period) {
    return res.status(400).json({ message: 'Category, amount, and period are required' });
  }

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ message: 'Invalid amount' });
  }

  if (!periodRegex.test(period)) {
    return res.status(400).json({ message: 'Invalid period format. Use YYYY-MM' });
  }

  try {
    const [categories] = await db.execute('SELECT id FROM Categories WHERE id = ? AND user_id = ?', [category_id, userId]);
    if (categories.length === 0) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    // Check if budget already exists for this category and period
    const [existing] = await db.execute(
      'SELECT * FROM Budgets WHERE user_id = ? AND category_id = ? AND period = ?',
      [userId, category_id, period]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: 'Budget already exists for this category and period' });
    }

    const [result] = await db.execute(
      'INSERT INTO Budgets (user_id, category_id, amount, period) VALUES (?, ?, ?, ?)',
      [userId, category_id, numericAmount, period]
    );
    res.status(201).json({ id: result.insertId, user_id: userId, category_id, amount, period });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateBudget = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { amount, category_id } = req.body;

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ message: 'Invalid amount' });
  }

  try {
    if (category_id) {
      const [categories] = await db.execute('SELECT id FROM Categories WHERE id = ? AND user_id = ?', [category_id, userId]);
      if (categories.length === 0) {
        return res.status(400).json({ message: 'Invalid category' });
      }
    }

    const [result] = await db.execute(
      'UPDATE Budgets SET amount = ?, category_id = COALESCE(?, category_id) WHERE id = ? AND user_id = ?',
      [numericAmount, category_id, id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Budget not found or unauthorized' });
    }

    res.json({ message: 'Budget updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteBudget = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const [result] = await db.execute('DELETE FROM Budgets WHERE id = ? AND user_id = ?', [id, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Budget not found or unauthorized' });
    }

    res.json({ message: 'Budget deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
