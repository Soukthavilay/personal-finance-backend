const db = require('../config/db');

exports.getAllBudgets = async (req, res) => {
  const userId = req.user.id;
  const { period } = req.query;

  let query = 'SELECT b.*, c.name as category_name FROM Budgets b JOIN Categories c ON b.category_id = c.id WHERE b.user_id = ?';
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

  if (!category_id || !amount || !period) {
    return res.status(400).json({ message: 'Category, amount, and period are required' });
  }

  try {
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
      [userId, category_id, amount, period]
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
  const { amount } = req.body;

  try {
    const [result] = await db.execute(
      'UPDATE Budgets SET amount = ? WHERE id = ? AND user_id = ?',
      [amount, id, userId]
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
