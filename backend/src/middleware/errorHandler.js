const mongoose = require('mongoose');

/** 404 handler for any route that didn't match. */
function notFound(req, res) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.originalUrl}` });
}

/**
 * Central error handler. Translates the errors we expect (validation, bad
 * ObjectId, our own ApiError) into clean JSON with the right status code.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Mongoose schema validation -> 400 with per-field messages.
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: 'Validation failed', details });
  }

  // Malformed ObjectId (e.g. GET /api/schedule/not-an-id) -> 400.
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: `Invalid ${err.path}: ${err.value}` });
  }

  // Unique-index violation (e.g. registering an email that already exists) -> 409.
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || { field: 1 })[0];
    return res.status(409).json({ error: `A record with that ${field} already exists` });
  }

  // Errors we threw on purpose carry their own status code.
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error('[error]', err);
  return res.status(500).json({ error: 'Internal server error' });
}

module.exports = { notFound, errorHandler };
