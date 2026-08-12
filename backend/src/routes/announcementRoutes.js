const express = require('express');
const {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} = require('../controllers/announcementController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Every announcement route requires a valid token.
router.use(requireAuth);

// Read - any authenticated role (§1.2.2).
router.get('/', listAnnouncements);

// Write - Organizer/Admin only. §4: enforced here at the authorization layer,
// so a hacker calling the route directly still gets a 403.
router.post('/', requireRole('organizer', 'admin'), createAnnouncement);
router.patch('/:id', requireRole('organizer', 'admin'), updateAnnouncement);
router.delete('/:id', requireRole('organizer', 'admin'), deleteAnnouncement);

module.exports = router;
