const Announcement = require('../models/Announcement');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/apiResponse');

/**
 * Announcements (design doc §1.2.2, §4).
 *
 * Role restriction lives on the routes (`requireRole('organizer', 'admin')`), so
 * §4's "enforced at the authorization layer, not just by convention" holds even
 * if someone calls the route directly.
 */

// Fields a client may set. `authorId`/`authorName` are taken from the token and
// are deliberately absent: otherwise anyone could post under someone else's name.
const CREATE_FIELDS = ['title', 'body', 'pinned', 'postedAt'];
// `postedAt` is not updatable - an edit must not re-order the feed.
const UPDATE_FIELDS = ['title', 'body', 'pinned'];

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function pickWritable(body, fields) {
  const out = {};
  for (const key of fields) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

/**
 * Clamp rather than reject. A bad `?limit=` is a UI bug, not something worth
 * failing a page load over - and it matches how GET /api/schedule/upcoming
 * already treats its limit.
 */
function parsePagination(query) {
  let limit = Number.parseInt(query.limit, 10);
  if (!Number.isInteger(limit) || limit <= 0) limit = DEFAULT_LIMIT;
  limit = Math.min(limit, MAX_LIMIT);

  let page = Number.parseInt(query.page, 10);
  if (!Number.isInteger(page) || page <= 0) page = 1;

  return { limit, page };
}

/**
 * GET /api/announcements?limit=10&page=1
 * Any authenticated role. Pinned first, then newest by `postedAt` - a pinned
 * item outranks an unpinned one regardless of time (§1.2.2).
 */
const listAnnouncements = catchAsync(async (req, res) => {
  const { limit, page } = parsePagination(req.query);

  const [announcements, total] = await Promise.all([
    Announcement.find()
      .sort({ pinned: -1, postedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Announcement.countDocuments(),
  ]);

  // `count` is this page's length (matching every other list route); `total` is
  // the collection-wide count, which is what a pager needs.
  ok(res, { count: announcements.length, announcements, page, limit, total });
});

/**
 * POST /api/announcements
 * Organizer/Admin only.
 */
const createAnnouncement = catchAsync(async (req, res) => {
  const announcement = await Announcement.create({
    ...pickWritable(req.body, CREATE_FIELDS),
    authorId: req.user._id,
    authorName: req.user.fullName,
  });

  created(res, announcement);
});

/**
 * PATCH /api/announcements/:id
 * Organizer/Admin only. Any organizer may edit any announcement - §1.2.2
 * restricts by role, not by ownership, and an ops team needs to be able to fix
 * a colleague's typo mid-event.
 */
const updateAnnouncement = catchAsync(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) throw new ApiError(404, 'Announcement not found');

  Object.assign(announcement, pickWritable(req.body, UPDATE_FIELDS));
  await announcement.save();

  ok(res, announcement);
});

/**
 * DELETE /api/announcements/:id
 * Organizer/Admin only.
 */
const deleteAnnouncement = catchAsync(async (req, res) => {
  const announcement = await Announcement.findByIdAndDelete(req.params.id);
  if (!announcement) throw new ApiError(404, 'Announcement not found');

  ok(res, { deleted: true, id: announcement._id });
});

module.exports = {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};
