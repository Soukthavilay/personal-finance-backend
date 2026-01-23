const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const verifyCsrf = require('./middleware/csrfMiddleware');
const authRoutes = require('./routes/authRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const reportRoutes = require('./routes/reportRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const jsonParser = express.json();
app.use((req, res, next) => {
  if (req.path === '/api/auth/logout') {
    return next();
  }

  return jsonParser(req, res, next);
});
app.use(cookieParser());

if (process.env.CORS_ORIGIN) {
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true
    })
  );
}

app.use((req, res, next) => {
  const path = req.path || '';
  if (path === '/api/auth/login' || path === '/api/auth/register' || path === '/api/auth/csrf') {
    return next();
  }

  return verifyCsrf(req, res, next);
});

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/reports', reportRoutes);

app.get('/', (req, res) => {
  res.send('Personal Finance API is running');
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
