const mongoose = require('mongoose');

/**
 * Connect to MongoDB using the URI from the environment.
 * Backend is hosted through MongoDB (Atlas in production, local for dev).
 */
async function connectDB(uri) {
  // Team convention is MONGO_URI (not MONGODB_URI) — see the project CLAUDE.md.
  const mongoUri = uri || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not set. Copy .env.example to .env and fill it in.');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri);
  console.log(`[db] Connected to MongoDB (${mongoose.connection.name})`);
  return mongoose.connection;
}

module.exports = { connectDB };
