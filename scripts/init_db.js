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
