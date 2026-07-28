const jwt = require('jsonwebtoken');

/**
 * JWT helpers. The secret is read at call time (not import time) so tests and
 * scripts can set it after requiring this module.
 */
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Copy .env.example to .env and fill it in.');
  }
  return secret;
}

/** Sign a login token. Keep the payload small — role is re-checked per request. */
function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/** Verify and decode a token. Throws if invalid or expired. */
function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

module.exports = { signToken, verifyToken };
