const HackathonConfig = require('../models/HackathonConfig');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { ok } = require('../utils/apiResponse');
const { buildCountdown } = require('../utils/countdown');

/**
 * Hackathon config + countdown (design doc §1.2.3, §4, §5's `configRouter`).
 */

// The only fields a client may set. `singleton`, `_id` and the timestamps are
// ours; so are `serverTime` and `countdown`, which are computed on every read.
const WRITABLE_FIELDS = ['hackathonStartAt', 'hackathonEndAt', 'submissionDeadline'];

/**
 * The read shape, used by both GET and PUT so the two can never drift.
 *
 * `serverTime` is included so the client can correct for clock skew rather than
 * trusting the browser's clock - that difference decides whether the "Submit
 * Project" button is enabled, so it's worth being exact about.
 */
function serialize(config) {
  const now = new Date();

  return {
    ...config.toJSON(),
    serverTime: now,
    countdown: buildCountdown({
      startAt: config.hackathonStartAt,
      endAt: config.hackathonEndAt,
      now,
    }),
  };
}

/**
 * GET /api/config/hackathon
 * Any authenticated role - the countdown is on every hacker's home screen.
 */
const getHackathonConfig = catchAsync(async (req, res) => {
  const config = await HackathonConfig.getSingleton();
  if (!config) {
    throw new ApiError(404, 'Hackathon config has not been set');
  }

  ok(res, serialize(config));
});

/**
 * PUT /api/config/hackathon
 * Admin only - this moves the deadline for every team at once.
 *
 * PUT rather than POST: the resource is a singleton at a known URL, so the verb
 * has to be the idempotent one. §5 maps POST to "creation of a new document",
 * which is exactly what must never happen here.
 *
 * It is a **full replace**, not a patch: a request that omits
 * `submissionDeadline` clears it. That is what PUT means, and a half-applied
 * deadline is the kind of thing nobody notices until submissions close early.
 *
 * Implemented as read-then-save rather than `findOneAndUpdate({upsert:true})`
 * because the "end after start" validator needs a real document to compare
 * against - in an update query, `this` is the query, not the document.
 */
const putHackathonConfig = catchAsync(async (req, res) => {
  const config = (await HackathonConfig.getSingleton()) || new HackathonConfig();

  for (const field of WRITABLE_FIELDS) {
    config[field] = req.body[field] === undefined ? null : req.body[field];
  }

  await config.save();

  ok(res, serialize(config));
});

module.exports = { getHackathonConfig, putHackathonConfig };
