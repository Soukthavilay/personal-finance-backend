const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const verifyToken = require('../middleware/authMiddleware');

router.get('/', verifyToken, transactionController.getAllTransactions);
router.get('/:id', verifyToken, transactionController.getTransactionById);
router.post('/', verifyToken, transactionController.createTransaction);
router.put('/:id', verifyToken, transactionController.updateTransaction);
router.delete('/:id', verifyToken, transactionController.deleteTransaction);

module.exports = router;
