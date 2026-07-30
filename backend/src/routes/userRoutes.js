const express = require('express');
const {
  getMe,
  updateMe,
  getUserById,
  updateUserRole,
} = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Every user route requires a valid token.
router.use(requireAuth);

// `/me` is declared before `/:id` so it isn't captured by the id param.
router.get('/me', getMe);
router.patch('/me', updateMe);

router.get('/:id', requireRole('organizer', 'admin'), getUserById);
router.patch('/:id/role', requireRole('admin'), updateUserRole);

module.exports = router;
