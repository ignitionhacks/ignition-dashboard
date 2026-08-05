const express = require('express');
const {
  getMyChecklist,
  getEventAttendance,
  createAttendance,
} = require('../controllers/attendanceController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Every attendance route requires a valid token (design doc §3.2.2).
router.use(requireAuth);

// The Profile checklist - a hacker's own attendance only.
router.get('/me', getMyChecklist);

// Headcount for one event. Reveals who attended, so organizer/admin only.
// Declared after /me so the literal path can't be read as an event id.
router.get('/event/:scheduleEventId', requireRole('organizer', 'admin'), getEventAttendance);

// Manual fallback when a scan fails. Never available to hackers - self-reported
// attendance would undermine the catering and headcount numbers.
router.post('/', requireRole('organizer', 'mentor'), createAttendance);

module.exports = router;
