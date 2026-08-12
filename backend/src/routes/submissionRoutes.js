const express = require('express');
const {
  getMySubmission,
  createSubmission,
  updateSubmission,
  listSubmissions,
} = require('../controllers/submissionController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Every submission route requires a valid token.
router.use(requireAuth);

/**
 * `/mine` must be declared before any `/:id` route, or Express matches "mine"
 * as an id. There is no `GET /:id` today, but the ordering is the safe habit.
 */
router.get('/mine', requireRole('hacker'), getMySubmission);

// The judging list. Organizer/Admin only - §4's authorization layer, not convention.
router.get('/', requireRole('organizer', 'admin'), listSubmissions);

/**
 * Writes are hacker-only. An organizer has no team, so there is nothing for them
 * to submit - and this deliberately means an organizer cannot fix a team's typo.
 * See CHECKLIST open question 5.Q1.
 */
router.post('/', requireRole('hacker'), createSubmission);
router.patch('/:id', requireRole('hacker'), updateSubmission);

module.exports = router;
