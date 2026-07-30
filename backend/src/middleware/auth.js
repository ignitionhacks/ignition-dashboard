const User = require('../models/User');
const { verifyToken } = require('../utils/token');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');

/**
 * Authentication + authorization (design doc §1.2.1).
 *
 * `requireAuth` validates the Bearer token and loads the live user onto
 * `req.user`. We re-read the user from the DB rather than trusting the role in
 * the token, so a role change (or a deleted account) takes effect immediately
 * instead of when the token expires.
 */
const requireAuth = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'Missing or malformed Authorization header. Expected: Bearer <token>');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new ApiError(401, 'Token expired, please log in again');
    if (err.name === 'JsonWebTokenError') throw new ApiError(401, 'Invalid token');
    throw err; // e.g. JWT_SECRET missing -> real 500, not a fake 401
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, 'User no longer exists');

  req.user = user;
  next();
});

/**
 * Restrict a route to specific roles. Must run after `requireAuth`.
 * Usage: router.post('/', requireAuth, requireRole('organizer', 'admin'), handler)
 */
function requireRole(...allowedRoles) {
  return function checkRole(req, res, next) {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(403, `Forbidden: requires role ${allowedRoles.join(' or ')}`)
      );
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
