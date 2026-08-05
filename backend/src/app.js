const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const scheduleRoutes = require('./routes/scheduleRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const qrCodeRoutes = require('./routes/qrCodeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Build the Express app. Exported separately from server.js so tests can import
// it without opening a network port.
function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Lightweight health check.
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/schedule', scheduleRoutes);
  app.use('/api/qrcode', qrCodeRoutes);
  app.use('/api/attendance', attendanceRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
