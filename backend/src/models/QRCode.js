const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

/**
 * QR Code (design doc §3.2.1).
 *
 * Backs the "Show this at each event you attend" block on the Profile page.
 * Each hacker has exactly one code that identifies them at a check-in station.
 *
 * Two deliberate choices from the doc:
 *
 * - **No image is ever rendered or stored.** This model holds the raw string and
 *   nothing else; the frontend turns it into a QR graphic client side. That keeps
 *   binary blobs out of the database entirely.
 * - **The code is generated once and never changes**, so a printed badge stays
 *   valid for the whole event and there is no regeneration flow to get wrong.
 *   `immutable` enforces that at the schema level rather than by convention.
 */
const qrCodeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      unique: true, // one QR code per user (doc §4: one-to-one)
    },
    // A non-guessable token. `randomUUID` is built into Node's crypto module,
    // so this needs no extra dependency.
    code: {
      type: String,
      required: [true, 'code is required'],
      default: () => randomUUID(),
      immutable: true,
      unique: true,
    },
  },
  // The record is write-once, so an `updatedAt` would never be anything but a
  // copy of `createdAt`. The doc lists `createdAt` only.
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Drop the internal version key from API responses (matches ScheduleEvent/User).
qrCodeSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.__v;
    return ret;
  },
});

const QRCode = mongoose.model('QRCode', qrCodeSchema);

module.exports = QRCode;
