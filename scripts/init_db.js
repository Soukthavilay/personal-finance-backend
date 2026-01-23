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

    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    await connection.end();
  }
}

initDb();
