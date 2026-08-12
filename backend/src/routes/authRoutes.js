const express = require('express');
const { register, login, logout } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register); // public — creates a `hacker`
router.post('/login', login); // public
router.post('/logout', requireAuth, logout);

module.exports = router;
