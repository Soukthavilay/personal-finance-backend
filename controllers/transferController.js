const db = require('../config/db');

function normalizeAmount(value) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function toSafeErrorMessage(error) {
  const code = error && error.code;
  if (code === 'ER_NO_SUCH_TABLE') {
    return 'Database missing Transfers table. Run node scripts/init_db.js and restart the server.';
  }
  if (code === 'ER_NO_REFERENCED_ROW_2' || code === 'ER_ROW_IS_REFERENCED_2') {
    return 'Invalid wallet reference for transfer.';
  }
  if (code === 'ER_LOCK_DEADLOCK') {
    return 'Please retry (deadlock).';
  }
  return null;
}

exports.getAllTransfers = async (req, res) => {
  const userId = req.user.id;
  const { walletId, wallet_id, startDate, endDate, limit, offset } = req.query;

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

  const walletFilterValue = walletId || wallet_id;

  let query = `SELECT tr.*, 
    wf.name AS from_wallet_name, wf.type AS from_wallet_type, wf.currency AS from_wallet_currency,
    wt.name AS to_wallet_name, wt.type AS to_wallet_type, wt.currency AS to_wallet_currency
    FROM Transfers tr
    JOIN Wallets wf ON tr.from_wallet_id = wf.id AND wf.user_id = tr.user_id
    JOIN Wallets wt ON tr.to_wallet_id = wt.id AND wt.user_id = tr.user_id
    WHERE tr.user_id = ?`;
  const params = [userId];

  if (walletFilterValue !== undefined) {
    const walletIdNum = Number(walletFilterValue);
    if (!Number.isInteger(walletIdNum) || walletIdNum <= 0) {
      return res.status(400).json({ message: 'Invalid wallet_id' });
    }
    query += ' AND (tr.from_wallet_id = ? OR tr.to_wallet_id = ?)';
    params.push(walletIdNum, walletIdNum);
  }

  if (startDate && endDate) {
    query += ' AND tr.transfer_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }

  query += ` ORDER BY tr.transfer_date DESC LIMIT ${pageLimit} OFFSET ${pageOffset}`;

  try {
    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: toSafeErrorMessage(error) || 'Server error' });
  }
};

exports.createTransfer = async (req, res) => {
  const userId = req.user.id;
  const { from_wallet_id, to_wallet_id, amount, transfer_date, description } = req.body;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const numericAmount = normalizeAmount(amount);

  if (!from_wallet_id || !to_wallet_id) {
    return res.status(400).json({ message: 'from_wallet_id and to_wallet_id are required' });
  }

  const fromWalletIdNum = Number(from_wallet_id);
  const toWalletIdNum = Number(to_wallet_id);
  if (!Number.isInteger(fromWalletIdNum) || fromWalletIdNum <= 0) {
    return res.status(400).json({ message: 'Invalid from_wallet_id' });
  }
  if (!Number.isInteger(toWalletIdNum) || toWalletIdNum <= 0) {
    return res.status(400).json({ message: 'Invalid to_wallet_id' });
  }
  if (fromWalletIdNum === toWalletIdNum) {
    return res.status(400).json({ message: 'from_wallet_id and to_wallet_id must be different' });
  }

  if (numericAmount === null) {
    return res.status(400).json({ message: 'Invalid amount' });
  }

  if (!transfer_date || !dateRegex.test(transfer_date)) {
    return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [fromWalletRows] = await conn.execute(
      'SELECT id, balance FROM Wallets WHERE id = ? AND user_id = ? FOR UPDATE',
      [fromWalletIdNum, userId]
    );
    if (!fromWalletRows || fromWalletRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Invalid from_wallet' });
    }

    const [toWalletRows] = await conn.execute(
      'SELECT id FROM Wallets WHERE id = ? AND user_id = ? FOR UPDATE',
      [toWalletIdNum, userId]
    );
    if (!toWalletRows || toWalletRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Invalid to_wallet' });
    }

    const fromBalance = Number(fromWalletRows[0].balance) || 0;
    if (fromBalance < numericAmount) {
      await conn.rollback();
      return res.status(400).json({ message: 'Insufficient balance in from_wallet' });
    }

    const [result] = await conn.execute(
      'INSERT INTO Transfers (user_id, from_wallet_id, to_wallet_id, amount, transfer_date, description) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, fromWalletIdNum, toWalletIdNum, numericAmount, transfer_date, description]
    );

    await conn.execute(
      'UPDATE Wallets SET balance = balance - ? WHERE id = ? AND user_id = ?',
      [numericAmount, fromWalletIdNum, userId]
    );

    await conn.execute(
      'UPDATE Wallets SET balance = balance + ? WHERE id = ? AND user_id = ?',
      [numericAmount, toWalletIdNum, userId]
    );

    await conn.commit();

    res.status(201).json({
      id: result.insertId,
      user_id: userId,
      from_wallet_id: fromWalletIdNum,
      to_wallet_id: toWalletIdNum,
      amount: numericAmount,
      transfer_date,
      description,
    });
  } catch (error) {
    try {
      if (conn) await conn.rollback();
    } catch {
      // ignore rollback errors
    }
    console.error(error);
    res.status(500).json({ message: toSafeErrorMessage(error) || 'Server error' });
  } finally {
    if (conn) conn.release();
  }
};

exports.updateTransfer = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { from_wallet_id, to_wallet_id, amount, transfer_date, description } = req.body;

  const transferIdNum = Number(id);
  if (!Number.isInteger(transferIdNum) || transferIdNum <= 0) {
    return res.status(400).json({ message: 'Invalid transfer id' });
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const numericAmount = normalizeAmount(amount);

  if (!from_wallet_id || !to_wallet_id) {
    return res.status(400).json({ message: 'from_wallet_id and to_wallet_id are required' });
  }

  const fromWalletIdNum = Number(from_wallet_id);
  const toWalletIdNum = Number(to_wallet_id);
  if (!Number.isInteger(fromWalletIdNum) || fromWalletIdNum <= 0) {
    return res.status(400).json({ message: 'Invalid from_wallet_id' });
  }
  if (!Number.isInteger(toWalletIdNum) || toWalletIdNum <= 0) {
    return res.status(400).json({ message: 'Invalid to_wallet_id' });
  }
  if (fromWalletIdNum === toWalletIdNum) {
    return res.status(400).json({ message: 'from_wallet_id and to_wallet_id must be different' });
  }

  if (numericAmount === null) {
    return res.status(400).json({ message: 'Invalid amount' });
  }

  if (!transfer_date || !dateRegex.test(transfer_date)) {
    return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [existingRows] = await conn.execute(
      'SELECT id, from_wallet_id, to_wallet_id, amount FROM Transfers WHERE id = ? AND user_id = ? FOR UPDATE',
      [transferIdNum, userId]
    );
    if (!existingRows || existingRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Transfer not found or unauthorized' });
    }
    const existing = existingRows[0];

    const oldFromWalletId = Number(existing.from_wallet_id);
    const oldToWalletId = Number(existing.to_wallet_id);
    const oldAmount = Number(existing.amount) || 0;

    // Lock involved wallets
    const walletIdsToLock = Array.from(new Set([oldFromWalletId, oldToWalletId, fromWalletIdNum, toWalletIdNum]));
    for (const wid of walletIdsToLock) {
      await conn.execute('SELECT id FROM Wallets WHERE id = ? AND user_id = ? FOR UPDATE', [wid, userId]);
    }

    // Revert old transfer
    await conn.execute('UPDATE Wallets SET balance = balance + ? WHERE id = ? AND user_id = ?', [oldAmount, oldFromWalletId, userId]);
    await conn.execute('UPDATE Wallets SET balance = balance - ? WHERE id = ? AND user_id = ?', [oldAmount, oldToWalletId, userId]);

    // Validate new wallets exist
    const [fromWalletRows] = await conn.execute('SELECT id, balance FROM Wallets WHERE id = ? AND user_id = ?', [fromWalletIdNum, userId]);
    if (!fromWalletRows || fromWalletRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Invalid from_wallet' });
    }
    const [toWalletRows] = await conn.execute('SELECT id FROM Wallets WHERE id = ? AND user_id = ?', [toWalletIdNum, userId]);
    if (!toWalletRows || toWalletRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Invalid to_wallet' });
    }

    const newFromBalance = Number(fromWalletRows[0].balance) || 0;
    if (newFromBalance < numericAmount) {
      await conn.rollback();
      return res.status(400).json({ message: 'Insufficient balance in from_wallet' });
    }

    // Apply new transfer
    await conn.execute(
      'UPDATE Transfers SET from_wallet_id = ?, to_wallet_id = ?, amount = ?, transfer_date = ?, description = ? WHERE id = ? AND user_id = ?',
      [fromWalletIdNum, toWalletIdNum, numericAmount, transfer_date, description, transferIdNum, userId]
    );

    await conn.execute('UPDATE Wallets SET balance = balance - ? WHERE id = ? AND user_id = ?', [numericAmount, fromWalletIdNum, userId]);
    await conn.execute('UPDATE Wallets SET balance = balance + ? WHERE id = ? AND user_id = ?', [numericAmount, toWalletIdNum, userId]);

    await conn.commit();

    res.json({ message: 'Transfer updated' });
  } catch (error) {
    try {
      if (conn) await conn.rollback();
    } catch {
      // ignore rollback errors
    }
    console.error(error);
    res.status(500).json({ message: toSafeErrorMessage(error) || 'Server error' });
  } finally {
    if (conn) conn.release();
  }
};

exports.deleteTransfer = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const transferIdNum = Number(id);
  if (!Number.isInteger(transferIdNum) || transferIdNum <= 0) {
    return res.status(400).json({ message: 'Invalid transfer id' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [existingRows] = await conn.execute(
      'SELECT id, from_wallet_id, to_wallet_id, amount FROM Transfers WHERE id = ? AND user_id = ? FOR UPDATE',
      [transferIdNum, userId]
    );
    if (!existingRows || existingRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Transfer not found or unauthorized' });
    }
    const existing = existingRows[0];

    const fromWalletId = Number(existing.from_wallet_id);
    const toWalletId = Number(existing.to_wallet_id);
    const amountNum = Number(existing.amount) || 0;

    // Lock wallets
    await conn.execute('SELECT id FROM Wallets WHERE id = ? AND user_id = ? FOR UPDATE', [fromWalletId, userId]);
    await conn.execute('SELECT id FROM Wallets WHERE id = ? AND user_id = ? FOR UPDATE', [toWalletId, userId]);

    const [result] = await conn.execute('DELETE FROM Transfers WHERE id = ? AND user_id = ?', [transferIdNum, userId]);
    if (!result || result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Transfer not found or unauthorized' });
    }

    // Revert transfer effect
    await conn.execute('UPDATE Wallets SET balance = balance + ? WHERE id = ? AND user_id = ?', [amountNum, fromWalletId, userId]);
    await conn.execute('UPDATE Wallets SET balance = balance - ? WHERE id = ? AND user_id = ?', [amountNum, toWalletId, userId]);

    await conn.commit();
    res.json({ message: 'Transfer deleted' });
  } catch (error) {
    try {
      if (conn) await conn.rollback();
    } catch {
      // ignore rollback errors
    }
    console.error(error);
    res.status(500).json({ message: toSafeErrorMessage(error) || 'Server error' });
  } finally {
    if (conn) conn.release();
  }
};
