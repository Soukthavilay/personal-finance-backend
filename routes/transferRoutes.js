const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');
const transferController = require('../controllers/transferController');

router.get('/', verifyToken, transferController.getAllTransfers);
router.post('/', verifyToken, transferController.createTransfer);
router.put('/:id', verifyToken, transferController.updateTransfer);
router.delete('/:id', verifyToken, transferController.deleteTransfer);

module.exports = router;
