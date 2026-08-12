const mongoose = require('mongoose');
const { ERROR_CODES, fail } = require('../utils/apiResponse');

/** 404 handler for any route that didn't match. */
function notFound(req, res) {
  return fail(res, 404, `Not found: ${req.method} ${req.originalUrl}`, ERROR_CODES.NOT_FOUND);
}

/**
 * Central error handler (design doc §5). Translates the errors we expect
 * (validation, bad ObjectId, duplicate key, our own ApiError) into the failure
 * envelope with the right status code, so controllers can simply `throw` and
 * never format a response themselves.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Mongoose schema validation -> 400 with per-field messages.
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => e.message);
    return fail(res, 400, 'Validation failed', ERROR_CODES.VALIDATION_ERROR, details);
  }

  // Malformed ObjectId (e.g. GET /api/schedule/not-an-id) -> 400. It is a bad
  // field value like any other, so it carries VALIDATION_ERROR too.
  if (err instanceof mongoose.Error.CastError) {
    return fail(
      res,
      400,
      `Invalid ${err.path}: ${err.value}`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  // Unique-index violation (e.g. registering an email that already exists) -> 409.
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || { field: 1 })[0];
    return fail(
      res,
      409,
      `A record with that ${field} already exists`,
      ERROR_CODES.CONFLICT
    );
  }

  // Errors we threw on purpose carry their own status code, and optionally
  // their own more specific error code.
  if (err.statusCode) {
    return fail(res, err.statusCode, err.message, err.code);
  }

  // Anything else is a bug. Log the real error server-side; tell the client nothing.
  console.error('[error]', err);
  return fail(res, 500, 'Internal server error', ERROR_CODES.INTERNAL_ERROR);
}

module.exports = { notFound, errorHandler };
