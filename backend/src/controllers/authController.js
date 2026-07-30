const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../utils/token');

const MIN_PASSWORD_LENGTH = 8;

/**
 * POST /api/auth/register
 *
 * Not in the design doc's routes table, but without it there is no way to create
 * the first user. Self-registration is limited to the `hacker` role — a client
 * cannot make itself an organizer. Elevating a role goes through
 * PATCH /api/users/:id/role (admin only).
 */
const register = catchAsync(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(400, `password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    firstName,
    lastName,
    email,
    passwordHash,
    role: 'hacker',
  });

  res.status(201).json({ user, token: signToken(user) });
});

/**
 * POST /api/auth/login
 * Verify credentials and return a JWT. The same generic message is returned for
 * an unknown email and a wrong password so the endpoint can't be used to probe
 * which emails are registered.
 */
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'email and password are required');
  }

  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select(
    '+passwordHash'
  );

  const ok = user ? await user.verifyPassword(password) : false;
  if (!ok) throw new ApiError(401, 'Invalid email or password');

  res.json({ user, token: signToken(user) });
});

/**
 * POST /api/auth/logout
 *
 * JWTs are stateless, so there is no server-side session to destroy — the client
 * discards the token. This endpoint exists so the frontend has the route the
 * design doc lists, and gives us a place to hang a token denylist later if
 * instant revocation is ever needed.
 */
const logout = (req, res) => {
  res.json({ message: 'Logged out. Discard the token on the client.' });
};

module.exports = { register, login, logout };
