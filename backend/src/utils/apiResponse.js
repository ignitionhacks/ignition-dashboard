/**
 * The API response envelope (design doc §5).
 *
 * Every /api response looks like one of:
 *
 *   { "success": true,  "data": { ... } }
 *   { "success": false, "error": { "code": "NOT_FOUND", "message": "...", "details": [...] } }
 *
 * so the frontend can write one generic response handler instead of parsing a
 * different shape per endpoint. `details` only ever appears on validation
 * failures.
 *
 * GET /health is deliberately NOT enveloped: it is an ops/liveness endpoint
 * mounted outside /api and uptime probes match its literal body.
 */

/** Machine-readable error codes. `message` is for humans and may change; these must not. */
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR', // 400, a field failed validation
  BAD_REQUEST: 'BAD_REQUEST', // 400, malformed request that isn't field validation
  UNAUTHORIZED: 'UNAUTHORIZED', // 401, missing/invalid authentication
  FORBIDDEN: 'FORBIDDEN', // 403, authenticated but wrong role
  NOT_FOUND: 'NOT_FOUND', // 404, resource doesn't exist
  CONFLICT: 'CONFLICT', // 409, e.g. submitting twice for the same team
  INTERNAL_ERROR: 'INTERNAL_ERROR', // 500, unexpected server failure
};

/**
 * Default error code for a status code, so controllers can just
 * `throw new ApiError(404, '...')` without naming a code every time.
 */
function codeForStatus(statusCode) {
  switch (statusCode) {
    case 400:
      return ERROR_CODES.BAD_REQUEST;
    case 401:
      return ERROR_CODES.UNAUTHORIZED;
    case 403:
      return ERROR_CODES.FORBIDDEN;
    case 404:
      return ERROR_CODES.NOT_FOUND;
    case 409:
      return ERROR_CODES.CONFLICT;
    default:
      return ERROR_CODES.INTERNAL_ERROR;
  }
}

/** Send a success envelope. `data` is whatever the route used to return at the top level. */
function ok(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

/** Send a 201 with the created resource. */
function created(res, data) {
  return ok(res, data, 201);
}

/**
 * Send a failure envelope. `details` is omitted entirely unless supplied, so a
 * client can rely on "details present => it was a field validation failure".
 */
function fail(res, statusCode, message, code, details) {
  const error = { code: code || codeForStatus(statusCode), message };
  if (details !== undefined) error.details = details;
  return res.status(statusCode).json({ success: false, error });
}

module.exports = { ERROR_CODES, codeForStatus, ok, created, fail };
