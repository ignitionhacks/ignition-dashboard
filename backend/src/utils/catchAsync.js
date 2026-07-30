/**
 * Wrap an async route handler so any rejected promise is forwarded to Express's
 * error-handling middleware instead of crashing the process.
 */
module.exports = function catchAsync(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
