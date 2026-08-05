const express = require('express');
const { getMyQrCode, scanQrCode, getUserByCode } = require('../controllers/qrCodeController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Every QR route requires a valid token (design doc §3.2.1).
router.use(requireAuth);

// Any authenticated user can fetch their own code to render on Profile.
router.get('/me', getMyQrCode);

// The organizer-facing check-in tool. Mentors help staff the stations, so §3.2.1
// grants them this too.
router.post('/scan', requireRole('organizer', 'mentor'), scanQrCode);

// Support lookup - resolves to another user's details, so organizer/admin only.
// Declared after /me so a literal code can never shadow it.
router.get('/:code/user', requireRole('organizer', 'admin'), getUserByCode);

module.exports = router;
