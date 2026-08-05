/**
 * Small helper for throwing errors with an attached HTTP status code.
 * The central error handler reads `.statusCode` to build the response.
 */
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

module.exports = ApiError;
