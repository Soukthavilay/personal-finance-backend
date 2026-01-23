const express = require('express');
const router = express.Router();

const verifyToken = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');

router.get('/me', verifyToken, userController.getMe);
router.put('/me', verifyToken, userController.updateMe);

module.exports = router;
