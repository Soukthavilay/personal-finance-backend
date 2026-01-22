const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');
const verifyToken = require('../middleware/authMiddleware');

router.get('/', verifyToken, budgetController.getAllBudgets);
router.post('/', verifyToken, budgetController.createBudget);
router.put('/:id', verifyToken, budgetController.updateBudget);
router.delete('/:id', verifyToken, budgetController.deleteBudget);

module.exports = router;
