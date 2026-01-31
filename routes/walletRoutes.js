const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');
const walletController = require('../controllers/walletController');

router.get('/', verifyToken, walletController.getAllWallets);
router.post('/', verifyToken, walletController.createWallet);
router.put('/:id', verifyToken, walletController.updateWallet);
router.delete('/:id', verifyToken, walletController.deleteWallet);

module.exports = router;
