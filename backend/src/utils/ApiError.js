const { codeForStatus } = require('./apiResponse');

/**
 * Small helper for throwing errors with an attached HTTP status code.
 * The central error handler reads `.statusCode` and `.code` to build the
 * §5 failure envelope.
 *
 * `code` is optional: it defaults to the standard code for the status, so most
 * throws stay `new ApiError(404, 'Event not found')`. Pass one explicitly when
 * the client needs to tell two failures with the same status apart - e.g.
 * `new ApiError(409, '...', 'NO_TEAM')`.
 */
class ApiError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || codeForStatus(statusCode);
    this.name = 'ApiError';
  }
}

module.exports = ApiError;
