const express = require('express');
const {
  listEvents,
  upcomingEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
} = require('../controllers/scheduleController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Every schedule route requires a valid token (design doc §2.2.1: all four roles
// may read; only organizer/admin may write).
router.use(requireAuth);

// Read routes — any authenticated role.
// `/upcoming` is declared before `/:id` so it isn't swallowed by the id param.
router.get('/upcoming', upcomingEvents);
router.get('/', listEvents);
router.get('/:id', getEvent);

// Write routes — Organizer/Admin only.
router.post('/', requireRole('organizer', 'admin'), createEvent);
router.patch('/:id', requireRole('organizer', 'admin'), updateEvent);
router.delete('/:id', requireRole('organizer', 'admin'), deleteEvent);

module.exports = router;
