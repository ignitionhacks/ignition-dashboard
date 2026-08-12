require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Team = require('../models/Team');
const User = require('../models/User');
const teamService = require('../services/teamService');

/**
 * The §7 "existing admin process" for teams.
 *
 * §5's router list has no `teamRouter`, so there is no HTTP way to create a team
 * or join one (see docs/plan/04-team.md for that decision and its cost). This is
 * the replacement: a hackathon organizer provisions teams from the command line,
 * exactly as §7 says elevated roles are provisioned "by an existing admin
 * process, for example a seed script or an internal admin panel".
 *
 * Run from `backend/`:
 *
 *   node src/scripts/manageTeams.js list
 *   node src/scripts/manageTeams.js create "Team Rocket"
 *   node src/scripts/manageTeams.js add    "Team Rocket" bobby@example.com
 *   node src/scripts/manageTeams.js remove "Team Rocket" bobby@example.com
 *   node src/scripts/manageTeams.js reconcile
 *
 * Unlike `seed.js` this is non-destructive: it has no `deleteMany` and never
 * removes a team or a user, so it needs no `--yes` guard. All the logic lives in
 * `services/teamService.js`; this file is argument parsing and printing.
 */

const USAGE = `
Usage (run from backend/):

  node src/scripts/manageTeams.js list
  node src/scripts/manageTeams.js create "<team name>"
  node src/scripts/manageTeams.js add    "<team name>" <email>
  node src/scripts/manageTeams.js remove "<team name>" <email>
  node src/scripts/manageTeams.js reconcile

Reads MONGO_URI from backend/.env. Never deletes anything.
`;

/** Look a team up by name, case-insensitively - matching the unique index. */
async function findTeam(name) {
  const team = await Team.findOne({ name }).collation({ locale: 'en', strength: 2 });
  if (!team) throw new Error(`No team named "${name}". Create it first, or run "list".`);
  return team;
}

async function findUser(email) {
  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) throw new Error(`No user with email "${email}".`);
  return user;
}

/** Print a team with its members resolved to names, for `list`. */
async function describe(team) {
  const members = await User.find({ _id: { $in: team.memberIds } }).sort({ firstName: 1 });
  const roster = members.length
    ? members.map((m) => `      - ${m.fullName} <${m.email}>`).join('\n')
    : '      (no members yet)';
  console.log(`  ${team.name}  [${team.memberIds.length}/${Team.MAX_TEAM_SIZE}]\n${roster}`);
}

const COMMANDS = {
  async list() {
    const teams = await Team.find().sort({ name: 1 });
    if (!teams.length) {
      console.log('\nNo teams yet. Create one:\n  node src/scripts/manageTeams.js create "Team Rocket"\n');
      return;
    }
    console.log(`\n${teams.length} team(s):\n`);
    for (const team of teams) await describe(team);
    console.log('');
  },

  async create(name) {
    if (!name) throw new Error('create needs a team name.');
    const team = await teamService.createTeam({ name });
    console.log(`\nCreated "${team.name}" (${team._id}). No members yet.\n`);
  },

  async add(name, email) {
    if (!name || !email) throw new Error('add needs a team name and an email.');
    const team = await findTeam(name);
    const user = await findUser(email);
    await teamService.addMember(team._id, user._id);
    console.log(`\nAdded ${user.email} to "${team.name}".`);
    await describe(await Team.findById(team._id));
    console.log('');
  },

  async remove(name, email) {
    if (!name || !email) throw new Error('remove needs a team name and an email.');
    const team = await findTeam(name);
    const user = await findUser(email);
    await teamService.removeMember(team._id, user._id);
    console.log(`\nRemoved ${user.email} from "${team.name}".`);
    await describe(await Team.findById(team._id));
    console.log('');
  },

  async reconcile() {
    const summary = await teamService.reconcile();
    console.log(
      `\nReconciled: ${summary.usersLinked} user(s) linked, ` +
        `${summary.usersCleared} cleared, ${summary.membersDropped} stale member(s) dropped.\n`
    );
  },
};

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || !COMMANDS[command]) {
    console.log(USAGE);
    process.exitCode = command ? 1 : 0;
    return;
  }

  // Same guard as cleanQaData.js: ignition-portal-dev is strictly read only, and
  // this script writes. Refuse before opening a connection to it.
  const uri = process.env.MONGO_URI;
  if (uri && /portal/i.test(uri)) {
    throw new Error('MONGO_URI points at a portal database. Refusing - that DB is read only.');
  }

  await connectDB();
  if (!/dashboard/i.test(mongoose.connection.name)) {
    throw new Error(
      `Connected to "${mongoose.connection.name}", which is not the dashboard DB. Refusing.`
    );
  }

  await COMMANDS[command](...args);
}

main()
  .catch((err) => {
    console.error(`\nFAILED: ${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
