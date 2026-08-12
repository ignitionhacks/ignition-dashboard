const Team = require('../models/Team');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

const { MAX_TEAM_SIZE } = Team;

/**
 * The only sanctioned way to change team membership.
 *
 * Membership is stored on both sides - `Team.memberIds` and `User.teamId` - so
 * every write has to touch two documents to stay consistent. Putting that in one
 * place means a future `teamRouter` (§5 doesn't ask for one; see
 * docs/plan/04-team.md) or an admin panel reuses these invariants rather than
 * re-implementing them. `scripts/manageTeams.js` is already just a CLI over this
 * file.
 *
 * Functions throw `ApiError`, not plain errors, so the day one of them does sit
 * behind a route the central error handler already produces the right §5
 * failure envelope.
 */

/** ObjectIds, strings and documents all compare correctly this way. */
const sameId = (a, b) => String(a) === String(b);

/**
 * Create a team. `createdBy` is null for script-provisioned teams, which is
 * every team today.
 */
async function createTeam({ name, createdBy = null }) {
  try {
    return await Team.create({ name, createdBy });
  } catch (err) {
    // The unique index is case-insensitive, so this also catches "TEAM ROCKET".
    if (err.code === 11000) {
      throw new ApiError(409, `A team named "${String(name).trim()}" already exists`);
    }
    if (err.name === 'ValidationError') {
      throw new ApiError(400, err.message);
    }
    throw err;
  }
}

/**
 * Put a user on a team.
 *
 * A user belongs to **at most one team**: the doc's data model says so
 * implicitly (a single `User.teamId`, not an array) and this enforces it, because
 * a user on two teams makes "the team's submission" ambiguous in §1.2.4 and would
 * surface as a baffling bug there instead of an error here.
 *
 * Already a member is a no-op rather than an error, so re-running the script is
 * safe.
 */
async function addMember(teamId, userId) {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found');

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  if (team.memberIds.some((id) => sameId(id, user._id))) {
    // Idempotent - but repair the mirror while we are here, in case a previous
    // run died between the two writes below.
    if (!sameId(user.teamId, team._id)) {
      await User.updateOne({ _id: user._id }, { teamId: team._id });
    }
    return team;
  }

  if (user.teamId) {
    throw new ApiError(409, `${user.email} is already on another team`);
  }
  if (team.memberIds.length >= MAX_TEAM_SIZE) {
    throw new ApiError(409, `${team.name} is full (max ${MAX_TEAM_SIZE} members)`);
  }

  /**
   * Two writes, no transaction: there are none on a standalone mongod or the
   * free Atlas tier. The Team goes first so the worst case is a team listing a
   * member whose `teamId` is still null - drift that `reconcile()` repairs, and
   * that is far easier to spot than the reverse.
   */
  team.memberIds.push(user._id);
  await team.save();
  await User.updateOne({ _id: user._id }, { teamId: team._id });

  return team;
}

/** Take a user off a team. Not being a member is a no-op, not an error. */
async function removeMember(teamId, userId) {
  const team = await Team.findById(teamId);
  if (!team) throw new ApiError(404, 'Team not found');

  const remaining = team.memberIds.filter((id) => !sameId(id, userId));
  if (remaining.length !== team.memberIds.length) {
    team.memberIds = remaining;
    await team.save();
  }

  // Scoped to this team so removing a stranger cannot clear someone else's
  // membership.
  await User.updateOne({ _id: userId, teamId: team._id }, { teamId: null });

  return team;
}

/** The team a user is on, or null. Resolves through `User.teamId`. */
async function getTeamForUser(userId) {
  const user = await User.findById(userId);
  if (!user || !user.teamId) return null;
  return Team.findById(user.teamId);
}

/**
 * Repair drift between `Team.memberIds` and `User.teamId`.
 *
 * `memberIds` is the source of truth: a user listed by a team gets their
 * `teamId` set, a user pointing at a team that does not list them gets it
 * cleared, and a `memberIds` entry for a user who no longer exists is dropped.
 *
 * Called by `manageTeams.js reconcile`, and safe to run any time - on a healthy
 * database it writes nothing.
 */
async function reconcile() {
  const summary = { usersLinked: 0, usersCleared: 0, membersDropped: 0 };
  const teams = await Team.find();

  // Who each team legitimately claims, so the sweep below knows which stray
  // `teamId` values have nothing behind them.
  const claimed = new Set();

  for (const team of teams) {
    const members = await User.find({ _id: { $in: team.memberIds } }).select('_id teamId');
    const live = new Set(members.map((member) => String(member._id)));

    const kept = team.memberIds.filter((id) => live.has(String(id)));
    if (kept.length !== team.memberIds.length) {
      summary.membersDropped += team.memberIds.length - kept.length;
      team.memberIds = kept;
      await team.save();
    }

    for (const member of members) {
      claimed.add(String(member._id));
      if (!sameId(member.teamId, team._id)) {
        await User.updateOne({ _id: member._id }, { teamId: team._id });
        summary.usersLinked += 1;
      }
    }
  }

  const linked = await User.find({ teamId: { $ne: null } }).select('_id teamId');
  for (const user of linked) {
    if (!claimed.has(String(user._id))) {
      await User.updateOne({ _id: user._id }, { teamId: null });
      summary.usersCleared += 1;
    }
  }

  return summary;
}

module.exports = {
  createTeam,
  addMember,
  removeMember,
  getTeamForUser,
  reconcile,
  MAX_TEAM_SIZE,
};
