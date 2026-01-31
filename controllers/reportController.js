const db = require('../config/db');

exports.getDashboardStats = async (req, res) => {
  const userId = req.user.id;
  const { month, year, walletId, wallet_id } = req.query;

  try {
    let dateFilter = '';
    let walletFilter = '';
    let params = [userId];

    const walletFilterValue = walletId || wallet_id;
    if (walletFilterValue !== undefined) {
      const walletIdNum = Number(walletFilterValue);
      if (!Number.isInteger(walletIdNum) || walletIdNum <= 0) {
        return res.status(400).json({ message: 'Invalid wallet_id' });
      }

      const [wallets] = await db.execute('SELECT id FROM Wallets WHERE id = ? AND user_id = ?', [walletIdNum, userId]);
      if (wallets.length === 0) {
        return res.status(400).json({ message: 'Invalid wallet' });
      }

      walletFilter = ' AND t.wallet_id = ?';
      params.push(walletIdNum);
    }

    if (month && year) {
        dateFilter = ' AND MONTH(transaction_date) = ? AND YEAR(transaction_date) = ?';
        params.push(month, year);
    }

    // Total Income
    const [incomeResult] = await db.execute(
        `SELECT SUM(t.amount) as total FROM Transactions t 
         JOIN Categories c ON t.category_id = c.id 
         WHERE t.user_id = ? AND c.user_id = t.user_id AND c.type = 'income' ${walletFilter} ${dateFilter}`, 
         params
    );

    // Total Expense
    const [expenseResult] = await db.execute(
        `SELECT SUM(t.amount) as total FROM Transactions t 
         JOIN Categories c ON t.category_id = c.id 
         WHERE t.user_id = ? AND c.user_id = t.user_id AND c.type = 'expense' ${walletFilter} ${dateFilter}`,
         params
    );

    // Expense by Category
    const [categoryStats] = await db.execute(
        `SELECT c.name, SUM(t.amount) as total FROM Transactions t 
         JOIN Categories c ON t.category_id = c.id 
         WHERE t.user_id = ? AND c.user_id = t.user_id AND c.type = 'expense' ${walletFilter} ${dateFilter} 
         GROUP BY c.name`,
         params
    );

    res.json({
        income: incomeResult[0].total || 0,
        expense: expenseResult[0].total || 0,
        balance: (incomeResult[0].total || 0) - (expenseResult[0].total || 0),
        categoryStats
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
