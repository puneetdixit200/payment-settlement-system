const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');
const { verifyToken, adminOnly } = require('../middleware');

// Public routes
router.post('/login', authController.login);
router.post('/refresh', authController.refreshAccessToken);

// Protected routes
router.use(verifyToken);

router.post('/logout', authController.logout);
router.get('/me', authController.getMe);
router.put('/password', authController.updatePassword);

// Admin only routes
router.post('/users', adminOnly, authController.createUser);
router.get('/users', adminOnly, authController.getUsers);
router.put('/users/:id', adminOnly, authController.updateUser);
router.delete('/users/:id', adminOnly, authController.deleteUser);

module.exports = router;
