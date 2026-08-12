const express = require('express');
const { getHackathonConfig, putHackathonConfig } = require('../controllers/configController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Every config route requires a valid token.
router.use(requireAuth);

// Read - any authenticated role. The countdown is on every hacker's home screen.
router.get('/hackathon', getHackathonConfig);

// Write - admin only, and deliberately narrower than the organizer/admin pair
// used elsewhere: this one moves the deadline for every team at once.
router.put('/hackathon', requireRole('admin'), putHackathonConfig);

module.exports = router;
