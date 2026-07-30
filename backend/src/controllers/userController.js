const User = require('../models/User');
const { ROLES } = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

// Fields a user may change about themselves. Deliberately excludes `role`,
// `status`, `email`, and `passwordHash` — a hacker must not be able to promote
// themselves by PATCHing their own profile.
const SELF_WRITABLE_FIELDS = ['firstName', 'lastName'];

/**
 * GET /api/users/me
 * Feeds the "Welcome, {firstName}!" header and gates role-specific UI.
 */
const getMe = catchAsync(async (req, res) => {
  res.json(req.user);
});

/**
 * PATCH /api/users/me
 * Update own profile (name only — see SELF_WRITABLE_FIELDS).
 */
const updateMe = catchAsync(async (req, res) => {
  const user = req.user;
  for (const field of SELF_WRITABLE_FIELDS) {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  }
  await user.save();
  res.json(user);
});

/**
 * GET /api/users/:id
 * Organizer/Admin lookup, e.g. for the check-in desk.
 */
const getUserById = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  res.json(user);
});

/**
 * PATCH /api/users/:id/role
 * Admin-only role change.
 */
const updateUserRole = catchAsync(async (req, res) => {
  const { role } = req.body;

  if (!ROLES.includes(role)) {
    throw new ApiError(400, `role must be one of: ${ROLES.join(', ')}`);
  }

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  user.role = role;
  await user.save();
  res.json(user);
});

module.exports = { getMe, updateMe, getUserById, updateUserRole };
