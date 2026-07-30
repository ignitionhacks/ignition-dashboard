const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Design doc §1.2.1. Roles drive every authorization check in the API.
const ROLES = ['hacker', 'organizer', 'mentor', 'admin'];

const BCRYPT_ROUNDS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'firstName is required'],
      trim: true,
      minlength: [1, 'firstName cannot be blank'],
    },
    lastName: {
      type: String,
      required: [true, 'lastName is required'],
      trim: true,
      minlength: [1, 'lastName cannot be blank'],
    },
    email: {
      type: String,
      required: [true, 'email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [EMAIL_PATTERN, 'email must be a valid email address'],
    },
    // Local auth. `select: false` keeps it out of every query result by default,
    // so it can never leak through a route that forgot to strip it.
    passwordHash: {
      type: String,
      required: [true, 'passwordHash is required'],
      select: false,
    },
    // Reserved for a future OAuth/SSO path (design doc offers either approach).
    authProviderId: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      required: true,
      enum: {
        values: ROLES,
        message: `role must be one of: ${ROLES.join(', ')}`,
      },
      default: 'hacker',
    },
    // Shown on the Profile page as "Status: Hacker".
    status: {
      type: String,
      trim: true,
      default: 'Hacker',
    },
    // Nullable until the hacker joins/creates a team.
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    qrCodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QRCode',
      default: null,
    },
  },
  { timestamps: true }
);

/** Hash a plaintext password. Used by the auth controller before create/update. */
userSchema.statics.hashPassword = function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
};

/**
 * Compare a plaintext password against this user's hash.
 * Requires the document to have been loaded with `.select('+passwordHash')`.
 */
userSchema.methods.verifyPassword = function verifyPassword(plaintext) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plaintext, this.passwordHash);
};

/** Convenience for the "Welcome, Bobby!" header. */
userSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Belt and braces: even if a query explicitly selects passwordHash, never
// serialize it (or the version key) into an API response.
userSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    delete ret.id; // `virtuals: true` adds this duplicate of _id
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.ROLES = ROLES;
