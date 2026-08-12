const Submission = require('../models/Submission');
const HackathonConfig = require('../models/HackathonConfig');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/apiResponse');

/**
 * Project Submission (design doc §1.2.4, §4, §5's `submissionRouter`).
 *
 * Two rules shape everything here:
 *
 *   1. A submission belongs to a **team**, never to a user. The team comes from
 *      the token, so one teammate's submission is the other's - and no hacker
 *      can submit on behalf of a team they are not on.
 *   2. There is exactly **one** submission per team, enforced by a unique index.
 */

// Fields a client may set. `teamId` and `submittedBy` are absent on purpose:
// both come from the token, and accepting either from the body would let any
// hacker submit for any team under anyone's name.
const CREATE_FIELDS = ['title', 'description', 'devpostUrl', 'repoUrl'];
// The same list on update - `submittedAt` is immutable in the schema too.
const UPDATE_FIELDS = CREATE_FIELDS;

function pickWritable(body, fields) {
  const out = {};
  for (const key of fields) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

/**
 * Throw if submissions are closed.
 *
 * The deadline is `submissionDeadline` when set, otherwise `hackathonEndAt`
 * (§1.2.4 allows either). **No config at all means the write is allowed**: a
 * missing config must not silently lock every team out of submitting, so this
 * fails open and warns rather than failing closed and ruining the event.
 *
 * 403 rather than 400 - the request is valid and the caller is authenticated,
 * they are simply not permitted to do this *now*.
 */
async function assertSubmissionsOpen() {
  const config = await HackathonConfig.getSingleton();

  if (!config) {
    console.warn(
      '[submissions] No hackathon config is set, so no deadline can be enforced. ' +
        'Allowing the write. Set one with PUT /api/config/hackathon.'
    );
    return;
  }

  const deadline = config.submissionDeadline || config.hackathonEndAt;
  if (Date.now() > deadline.getTime()) {
    throw new ApiError(
      403,
      `Submissions closed at ${deadline.toISOString()}`,
      'SUBMISSION_CLOSED'
    );
  }
}

/** The caller's team, or a 409 telling them to get on one first. */
function requireTeam(req) {
  if (!req.user.teamId) {
    throw new ApiError(
      409,
      'You are not on a team yet. Ask an organizer to add you to one before submitting.',
      'NO_TEAM'
    );
  }
  return req.user.teamId;
}

/**
 * GET /api/submissions/mine
 * Hacker. Answers "has my team submitted?" - so **not submitted is a 200 with
 * `data: null`, not a 404**. It is a normal state, and it is exactly what drives
 * the Home page button's two faces; a 404 would force the frontend to treat it
 * as an error. A hacker with no team gets the same `null` for the same reason.
 */
const getMySubmission = catchAsync(async (req, res) => {
  if (!req.user.teamId) return ok(res, null);

  const submission = await Submission.findOne({ teamId: req.user.teamId });
  ok(res, submission || null);
});

/**
 * POST /api/submissions
 * Hacker only - an organizer has no team, so there is nothing for them to submit.
 */
const createSubmission = catchAsync(async (req, res) => {
  const teamId = requireTeam(req);
  await assertSubmissionsOpen();

  // Checked here for a clean message; the unique index is what actually
  // guarantees it when two teammates submit at the same instant.
  const existing = await Submission.findOne({ teamId });
  if (existing) {
    throw new ApiError(409, 'Your team has already submitted a project. Edit it instead.');
  }

  const submission = await Submission.create({
    ...pickWritable(req.body, CREATE_FIELDS),
    teamId,
    submittedBy: req.user._id,
  });

  created(res, submission);
});

/**
 * PATCH /api/submissions/:id
 * Hacker, own team only. §4: "every teammate sees the same submission state" -
 * which means any teammate may edit it, and nobody else may.
 */
const updateSubmission = catchAsync(async (req, res) => {
  const submission = await Submission.findById(req.params.id);
  if (!submission) throw new ApiError(404, 'Submission not found');

  // Not on this team (or on no team at all) -> 403. Checked before the deadline
  // so a stranger never learns whether submissions are still open.
  if (!req.user.teamId || !submission.teamId.equals(req.user.teamId)) {
    throw new ApiError(403, "You can only edit your own team's submission");
  }

  await assertSubmissionsOpen();

  Object.assign(submission, pickWritable(req.body, UPDATE_FIELDS));
  await submission.save();

  ok(res, submission);
});

/**
 * GET /api/submissions
 * Organizer/Admin only - the judging list. Newest submission first.
 */
const listSubmissions = catchAsync(async (req, res) => {
  const submissions = await Submission.find().sort({ submittedAt: -1 });
  ok(res, { count: submissions.length, submissions });
});

module.exports = {
  getMySubmission,
  createSubmission,
  updateSubmission,
  listSubmissions,
};
