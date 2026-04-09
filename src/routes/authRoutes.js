const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/register
router.post('/register', authController.register);

// GET /api/auth/profile  [protected]
router.get('/profile', authenticateToken, authController.getProfile);

// POST /api/auth/cloud-account  [protected] — add a new cloud account
router.post('/cloud-account', authenticateToken, authController.addCloudAccount);

// DELETE /api/auth/cloud-account/:cloud  [protected]
router.delete('/cloud-account/:cloud', authenticateToken, authController.removeCloudAccount);

module.exports = router;
