require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const ScheduleEvent = require('../models/ScheduleEvent');
const HackathonConfig = require('../models/HackathonConfig');

// Sample events across the two days shown in the Figma (Fri Aug 14 / Sat Aug 15).
const SAMPLE_EVENTS = [
  {
    title: 'Opening Ceremony',
    description: 'Kick-off, sponsor intros, and rules.',
    startTime: '2026-08-14T09:00:00Z',
    endTime: '2026-08-14T10:00:00Z',
    location: 'Main Auditorium',
    category: 'Main',
  },
  {
    title: 'Hacking Begins!',
    startTime: '2026-08-14T10:00:00Z',
    location: 'Floor 2, 3, 4',
    category: 'Main',
  },
  {
    title: 'Lunch',
    startTime: '2026-08-14T12:00:00Z',
    endTime: '2026-08-14T13:00:00Z',
    location: 'Cafeteria',
    category: 'Food',
  },
  {
    title: 'Intro to AI Wrappers',
    description: 'Beginner-friendly workshop.',
    startTime: '2026-08-14T14:00:00Z',
    endTime: '2026-08-14T15:00:00Z',
    location: 'Workshop Room A',
    category: 'Workshop',
  },
  {
    title: 'Clash Royale Tournament',
    startTime: '2026-08-14T20:00:00Z',
    location: 'Floor 3 Lounge',
    category: 'Fun',
  },
  {
    title: 'Dinner',
    startTime: '2026-08-14T18:00:00Z',
    endTime: '2026-08-14T19:00:00Z',
    location: 'Cafeteria',
    category: 'Food',
  },
  {
    title: 'Submissions Due',
    startTime: '2026-08-15T09:00:00Z',
    location: 'Devpost',
    category: 'Main',
  },
  {
    title: 'Closing Ceremony',
    startTime: '2026-08-15T14:00:00Z',
    endTime: '2026-08-15T15:30:00Z',
    location: 'Main Auditorium',
    category: 'Main',
  },
];

// The singleton config (§1.2.3) so a fresh dev database has a working countdown
// instead of a 404. Matches the sample events above: Fri Aug 14 -> Sat Aug 15.
const SAMPLE_CONFIG = {
  hackathonStartAt: '2026-08-14T10:00:00Z',
  hackathonEndAt: '2026-08-15T09:00:00Z',
  submissionDeadline: '2026-08-15T09:00:00Z',
};

async function seed() {
  // `ignition-dashboard-dev` is shared by the whole team, and this script wipes
  // the collection before inserting. Require an explicit opt-in so nobody
  // destroys a teammate's schedule data by running `npm run seed` on autopilot.
  if (!process.argv.includes('--yes')) {
    console.error(
      '[seed] REFUSING TO RUN.\n' +
        '       This DELETES every schedule event AND the hackathon config in the\n' +
        '       target database, which is shared with the rest of the team.\n\n' +
        '       Check the db name at the end of MONGO_URI in your .env first, then:\n' +
        '           npm run seed -- --yes\n'
    );
    process.exitCode = 1;
    return;
  }

  try {
    await connectDB();
    console.log(`[seed] Target database: ${mongoose.connection.name}`);
    await ScheduleEvent.deleteMany({});
    const created = await ScheduleEvent.insertMany(SAMPLE_EVENTS);
    console.log(`[seed] Inserted ${created.length} schedule events.`);

    // The config is a singleton, so replace it rather than inserting a second one.
    await HackathonConfig.deleteMany({});
    await HackathonConfig.create(SAMPLE_CONFIG);
    console.log('[seed] Wrote the hackathon config (start, end, submission deadline).');
  } catch (err) {
    console.error('[seed] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seed();
