const mongoose = require('mongoose');

/**
 * Ignition Hacks' published rule is teams of up to four. The design doc never
 * states a limit, so this is an assumption - kept as one exported constant so
 * changing it is a one-line edit (see docs/plan/04-team.md, open question 2).
 */
const MAX_TEAM_SIZE = 4;

/**
 * Team (design doc §7's assumption, §4, §1.2.1's `User.teamId`).
 *
 * §7: "a Team entity (with membership) exists even though it is not directly
 * visible in the three provided screens. It is required to make the 'Submit
 * Project' button and its 'already submitted' state meaningful."
 *
 * Deliberately has **no router**: §5's router list is explicit and contains no
 * `teamRouter`, so teams are provisioned out-of-band by
 * `scripts/manageTeams.js`, the same way §7 handles elevated roles. Every
 * invariant that spans Team and User lives in `services/teamService.js` - never
 * write `memberIds` or `User.teamId` directly.
 */
const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      minlength: [1, 'name cannot be blank'],
    },
    /**
     * The team's side of the membership. Mirrored onto `User.teamId` because the
     * Profile page reads the user, not the team, and Phase 2.6 moves users onto
     * a second mongoose connection that a `.populate()` could not cross.
     */
    memberIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
      validate: {
        validator: (ids) => ids.length <= MAX_TEAM_SIZE,
        message: `memberIds cannot hold more than ${MAX_TEAM_SIZE} members`,
      },
    },
    // Null for script-provisioned teams, which is every team today.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

/**
 * One team per name, case-insensitively: "Team Rocket" and "team rocket" are the
 * same team to a human reading a leaderboard, so they must be the same team to
 * the database. `strength: 2` compares base letters + accents but ignores case.
 *
 * Declared here rather than as `unique: true` on the field so the collation can
 * be attached - a field-level `unique` would build a second, case-sensitive index.
 */
teamSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

// Supports teamService.reconcile()'s "which team lists this user" scan.
teamSchema.index({ memberIds: 1 });

teamSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.__v;
    return ret;
  },
});

const Team = mongoose.model('Team', teamSchema);

module.exports = Team;
module.exports.MAX_TEAM_SIZE = MAX_TEAM_SIZE;
