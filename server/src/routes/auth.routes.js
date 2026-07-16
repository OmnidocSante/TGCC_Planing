const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const { validateLogin, validateRegister, validateId } = require('../middleware/validate.middleware');

router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.get('/me', authenticate, authController.getMe);
router.get('/users', authenticate, requireAdmin, authController.getUsers);
router.put('/users/:id', authenticate, requireAdmin, authController.updateUser);
router.delete('/users/:id', authenticate, requireAdmin, authController.deleteUser);

module.exports = router;
