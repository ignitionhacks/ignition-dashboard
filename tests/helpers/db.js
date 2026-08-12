/**
 * In-memory MongoDB lifecycle for the test suite.
 *
 * Every test file gets its own throwaway server, so the suite needs no Atlas
 * access, no credentials, and can never touch the shared
 * `ignition-dashboard-dev` database.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const { backendDependency } = require('./backend');

const mongoose = backendDependency('mongoose');

let mongod = null;

async function connect() {
  mongod = await MongoMemoryServer.create();
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongod.getUri());
}

/** Wipe every collection between tests so files/cases can't leak state into each other. */
async function clear() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

async function disconnect() {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

module.exports = { connect, clear, disconnect, mongoose };
