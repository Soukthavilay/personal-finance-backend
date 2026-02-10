const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function initDb() {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  if (process.env.DB_PORT && Number.isNaN(port)) {
    throw new Error(`Invalid DB_PORT: ${process.env.DB_PORT}`);
  }

  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true
  });

  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
    console.log('Running schema.sql...');
    await connection.query(schemaSql);

    // Ensure Wallets table exists for older DBs
    await connection.query(`CREATE TABLE IF NOT EXISTS Wallets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      type ENUM('cash', 'bank', 'credit') NOT NULL,
      currency VARCHAR(3) NOT NULL,
      opening_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
      balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES Users(id)
    )`);

    // Add opening_balance for existing DBs (idempotent)
    try {
      await connection.query('ALTER TABLE Wallets ADD COLUMN opening_balance DECIMAL(12, 2) NOT NULL DEFAULT 0');
    } catch (err) {
      if (!(err && (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060))) {
        throw err;
      }
    }

    // Backfill opening_balance for existing rows (safe heuristic).
    // Only wallets with NO transactions can safely treat Wallets.balance as opening_balance.
    await connection.query(
      `UPDATE Wallets w
       LEFT JOIN Transactions t ON t.wallet_id = w.id AND t.user_id = w.user_id
       SET w.opening_balance = w.balance
       WHERE w.opening_balance = 0 AND w.balance <> 0 AND t.id IS NULL`
    );

    // Ensure every existing user has at least one default wallet (for backfilling budgets/transactions)
    await connection.query(
      `INSERT INTO Wallets (user_id, name, type, currency, opening_balance, balance, is_default)
       SELECT u.id, 'Cash', 'cash', u.currency, 0, 0, 1
       FROM Users u
       LEFT JOIN Wallets w ON w.user_id = u.id
       WHERE w.id IS NULL`
    );

    try {
      await connection.query('ALTER TABLE Transactions ADD COLUMN wallet_id INT NULL');
    } catch (err) {
      if (!(err && (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060))) {
        throw err;
      }
    }

    try {
      await connection.query('ALTER TABLE Transactions ADD CONSTRAINT fk_transactions_wallet_id FOREIGN KEY (wallet_id) REFERENCES Wallets(id)');
    } catch (err) {
      if (
        !(
          err &&
          (err.code === 'ER_CANT_CREATE_TABLE' ||
            err.errno === 1005 ||
            err.code === 'ER_DUP_KEYNAME' ||
            err.errno === 1061 ||
            err.code === 'ER_FK_DUP_NAME' ||
            err.errno === 1826)
        )
      ) {
        throw err;
      }
    }

    // Wallet-scoped Budgets (backward-compatible migration)
    try {
      await connection.query('ALTER TABLE Budgets ADD COLUMN wallet_id INT NULL');
    } catch (err) {
      if (!(err && (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060))) {
        throw err;
      }
    }

    // Backfill wallet_id for existing budgets using the user's default wallet
    await connection.query(
      `UPDATE Budgets b
       JOIN Wallets w ON w.user_id = b.user_id AND w.is_default = 1
       SET b.wallet_id = w.id
       WHERE b.wallet_id IS NULL`
    );

    // Enforce NOT NULL after backfill
    try {
      await connection.query('ALTER TABLE Budgets MODIFY wallet_id INT NOT NULL');
    } catch (err) {
      if (!(err && (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060))) {
        throw err;
      }
    }

    // Add FK constraint (idempotent)
    try {
      await connection.query('ALTER TABLE Budgets ADD CONSTRAINT fk_budgets_wallet_id FOREIGN KEY (wallet_id) REFERENCES Wallets(id)');
    } catch (err) {
      if (
        !(
          err &&
          (err.code === 'ER_CANT_CREATE_TABLE' ||
            err.errno === 1005 ||
            err.code === 'ER_DUP_KEYNAME' ||
            err.errno === 1061 ||
            err.code === 'ER_FK_DUP_NAME' ||
            err.errno === 1826)
        )
      ) {
        throw err;
      }
    }

    // Add unique key per wallet/category/period (idempotent)
    try {
      await connection.query('ALTER TABLE Budgets ADD CONSTRAINT unique_user_wallet_budget UNIQUE (user_id, wallet_id, category_id, period)');
    } catch (err) {
      if (!(err && (err.code === 'ER_DUP_KEYNAME' || err.errno === 1061))) {
        throw err;
      }
    }

    try {
      await connection.query(`ALTER TABLE Users
        ADD COLUMN reset_password_token_hash VARCHAR(64) NULL,
        ADD COLUMN reset_password_expires_at DATETIME NULL`);
    } catch (err) {
      if (!(err && (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060))) {
        throw err;
      }
    }

    try {
      await connection.query(`ALTER TABLE Users
        ADD COLUMN full_name VARCHAR(255) NULL,
        ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'VND',
        ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Bangkok',
        ADD COLUMN avatar_url TEXT NULL`);
    } catch (err) {
      if (!(err && (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060))) {
        throw err;
      }
    }

    try {
      await connection.query(`ALTER TABLE Users
        ADD COLUMN monthly_income_target DECIMAL(12, 2) NULL,
        ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT 'vi',
        ADD COLUMN date_format VARCHAR(32) NOT NULL DEFAULT 'YYYY-MM-DD',
        ADD COLUMN week_start_day TINYINT NOT NULL DEFAULT 1,
        ADD COLUMN phone VARCHAR(32) NULL,
        ADD COLUMN gender VARCHAR(16) NULL,
        ADD COLUMN dob DATE NULL,
        ADD COLUMN last_login_at DATETIME NULL`);
    } catch (err) {
      if (!(err && (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060))) {
        throw err;
      }
    }

    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    await connection.end();
  }
}

initDb();
