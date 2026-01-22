const mysql = require('mysql2');
require('dotenv').config();

const host = process.env.DB_HOST || 'localhost';

const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
if (process.env.DB_PORT && Number.isNaN(port)) {
  throw new Error(`Invalid DB_PORT: ${process.env.DB_PORT}`);
}

const user = process.env.DB_USER || 'root';
const password = process.env.DB_PASSWORD || '';
const database = process.env.DB_NAME || 'personal_finance';

const pool = mysql.createPool({
  host,
  port,
  user,
  password,
  database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool.promise();
