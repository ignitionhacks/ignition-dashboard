/**
 * Bridge between this test package and the backend package.
 *
 * `tests/` and `backend/` are separate npm packages with separate node_modules.
 * That means a plain `require('mongoose')` in here would load a SECOND copy of
 * mongoose: the models would register themselves on the backend's instance
 * while the tests connected a different one, and every query would hang on a
 * connection that was never opened. So we deliberately resolve mongoose (and
 * everything else backend-owned) out of the backend package.
 */
const path = require('path');

const BACKEND_DIR = path.resolve(__dirname, '..', '..', 'backend');
const BACKEND_SRC = path.join(BACKEND_DIR, 'src');

// Test environment must be set before anything reads it. The app skips request
// logging when NODE_ENV is 'test'; token.js reads JWT_SECRET at call time.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-not-used-anywhere-real';

/** Require a module from the backend's src/, e.g. backendRequire('models/User'). */
function backendRequire(relativePath) {
  return require(path.join(BACKEND_SRC, relativePath));
}

/** Resolve a backend *dependency* (mongoose, express, ...) from backend/node_modules. */
function backendDependency(name) {
  return require(require.resolve(name, { paths: [BACKEND_DIR] }));
}

module.exports = { BACKEND_DIR, BACKEND_SRC, backendRequire, backendDependency };
