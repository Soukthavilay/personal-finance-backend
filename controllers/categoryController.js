const db = require('../config/db');

exports.getAllCategories = async (req, res) => {
  try {
    const userId = req.user.id;
    const [categories] = await db.execute('SELECT * FROM Categories WHERE user_id = ?', [userId]);
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createCategory = async (req, res) => {
  const { name, type } = req.body;
  const userId = req.user.id;
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  if (!normalizedName || !type) {
    return res.status(400).json({ message: 'Name and type are required' });
  }

  if (type !== 'income' && type !== 'expense') {
    return res.status(400).json({ message: 'Invalid category type' });
  }

  try {
    const [existing] = await db.execute(
      'SELECT id FROM Categories WHERE user_id = ? AND type = ? AND LOWER(name) = LOWER(?) LIMIT 1',
      [userId, type, normalizedName]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Category name already exists' });
    }

    const [result] = await db.execute('INSERT INTO Categories (user_id, name, type) VALUES (?, ?, ?)', [userId, normalizedName, type]);
    res.status(201).json({ id: result.insertId, user_id: userId, name: normalizedName, type });
  } catch (error) {
    console.error(error);
    if (error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062)) {
      return res.status(400).json({ message: 'Category name already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, type } = req.body;
  const userId = req.user.id;

  const normalizedName = typeof name === 'string' ? name.trim() : '';
  if (!normalizedName || !type) {
    return res.status(400).json({ message: 'Name and type are required' });
  }

  if (type !== 'income' && type !== 'expense') {
    return res.status(400).json({ message: 'Invalid category type' });
  }

  try {
    const [existing] = await db.execute(
      'SELECT id FROM Categories WHERE user_id = ? AND type = ? AND LOWER(name) = LOWER(?) AND id <> ? LIMIT 1',
      [userId, type, normalizedName, id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Category name already exists' });
    }

    const [result] = await db.execute('UPDATE Categories SET name = ?, type = ? WHERE id = ? AND user_id = ?', [normalizedName, type, id, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Category not found or unauthorized' });
    }

    res.json({ message: 'Category updated' });
  } catch (error) {
    console.error(error);
    if (error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062)) {
      return res.status(400).json({ message: 'Category name already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteCategory = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const [txCountResult] = await db.execute(
      'SELECT COUNT(*) as count FROM Transactions WHERE user_id = ? AND category_id = ?',
      [userId, id]
    );

    if (txCountResult[0].count > 0) {
      return res.status(400).json({ message: 'Category is in use by transactions and cannot be deleted' });
    }

    const [budgetCountResult] = await db.execute(
      'SELECT COUNT(*) as count FROM Budgets WHERE user_id = ? AND category_id = ?',
      [userId, id]
    );

    if (budgetCountResult[0].count > 0) {
      return res.status(400).json({ message: 'Category is in use by budgets and cannot be deleted' });
    }

    const [result] = await db.execute('DELETE FROM Categories WHERE id = ? AND user_id = ?', [id, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Category not found or unauthorized' });
    }

    res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
