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

// Try socket first, fallback to TCP
const socketPath = process.env.DB_SOCKET_PATH || '/tmp/mysql.sock';

const poolConfig = {
  host,
  port,
  user,
  password,
  database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

if (socketPath) {
  poolConfig.socketPath = socketPath;
}

const pool = mysql.createPool(poolConfig);

const promisePool = pool.promise();
promisePool.end = pool.end.bind(pool);

// Test connection and log result
async function testConnection() {
  try {
    const connection = await promisePool.getConnection();
    await connection.ping();
    connection.release();
    console.log('Connected to MySQL');
  } catch (err) {
    console.error('MySQL connection failed:', err.message);
    throw err;
  }
}

module.exports = promisePool;
module.exports.testConnection = testConnection;
