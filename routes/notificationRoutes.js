const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const verifyToken = require('../middleware/authMiddleware');

router.get('/preferences', verifyToken, notificationController.getPreferences);
router.put('/preferences', verifyToken, notificationController.updatePreferences);
router.post('/device-token', verifyToken, notificationController.upsertDeviceToken);
router.delete('/device-token', verifyToken, notificationController.deleteDeviceToken);

module.exports = router;
