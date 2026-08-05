require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB } = require('../config/db');

/**
 * Removes the leftovers from a manual-QA run so Postman folders 9 / 10 / 11 can
 * start from a clean slate. See manual-qa.md §9 / §10 and CHECKLIST 6.11.
 *
 * Why this exists: folder 9 creates three fresh events on every run, and folder 11
 * only deletes the newest set. After five runs the meal checklist had fifteen
 * "QA - Lunch" rows on it and the attendance assertions stopped meaning anything.
 *
 * Scope, deliberately narrow:
 *   attendances    - every document. The collection exists only because of our work.
 *   qrcodes        - every document. Same.
 *   scheduleevents - ONLY documents whose title starts with "QA".
 *   users          - untouched. The qa-* accounts are reused every run, and deleting
 *                    qa-admin would cost you its hand-set admin role (there's no
 *                    HTTP route that creates an admin).
 *
 * Refuses to run against a database whose name doesn't contain "dashboard", so it
 * can never touch ignition-portal-dev.
 *
 *   npm run clean:qa          <- dry run, counts only
 *   npm run clean:qa -- --yes <- actually delete
 */

const QA_EVENTS = { title: { $regex: '^QA' } };

const pad = (n) => String(n).padStart(4);

async function main() {
  const uri = process.env.MONGO_URI;
  if (uri && /portal/i.test(uri)) {
    throw new Error('MONGO_URI points at a portal database. Refusing - that DB is read only.');
  }

  await connectDB();
  const { db } = mongoose.connection;

  if (!/dashboard/i.test(db.databaseName)) {
    throw new Error(`Connected to "${db.databaseName}", which is not the dashboard DB. Refusing.`);
  }

  const attendances = await db.collection('attendances').countDocuments();
  const qrcodes = await db.collection('qrcodes').countDocuments();
  const qaEvents = await db.collection('scheduleevents').countDocuments(QA_EVENTS);
  const allEvents = await db.collection('scheduleevents').countDocuments();

  console.log(`\nIn ${db.databaseName}:`);
  console.log(`${pad(attendances)}  attendances     (all will go)`);
  console.log(`${pad(qrcodes)}  qrcodes         (all will go)`);
  console.log(`${pad(qaEvents)}  scheduleevents  of ${allEvents} total (title starts with "QA")`);

  if (!process.argv.includes('--yes')) {
    console.log('\nDry run - nothing deleted. Re-run with --yes to do it for real.\n');
    return;
  }

  const a = await db.collection('attendances').deleteMany({});
  const q = await db.collection('qrcodes').deleteMany({});
  const s = await db.collection('scheduleevents').deleteMany(QA_EVENTS);

  console.log('\nDeleted:');
  console.log(`${pad(a.deletedCount)}  attendances`);
  console.log(`${pad(q.deletedCount)}  qrcodes`);
  console.log(`${pad(s.deletedCount)}  scheduleevents`);
  console.log(`\nNon-QA scheduleevents left alone: ${await db.collection('scheduleevents').countDocuments()}`);
  console.log('Now run Postman folder 9, then 10, then 11.\n');
}

main()
  .catch((err) => {
    console.error(`\nFAILED: ${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
