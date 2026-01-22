const db = require('../config/db');

exports.getAllCategories = async (req, res) => {
  try {
    const [categories] = await db.execute('SELECT * FROM Categories');
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createCategory = async (req, res) => {
  const { name, type } = req.body;
  if (!name || !type) {
    return res.status(400).json({ message: 'Name and type are required' });
  }

  try {
    const [result] = await db.execute('INSERT INTO Categories (name, type) VALUES (?, ?)', [name, type]);
    res.status(201).json({ id: result.insertId, name, type });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, type } = req.body;

  try {
    await db.execute('UPDATE Categories SET name = ?, type = ? WHERE id = ?', [name, type, id]);
    res.json({ message: 'Category updated' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    // Optional: Check if used in transactions before deleting
    await db.execute('DELETE FROM Categories WHERE id = ?', [id]);
    res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
