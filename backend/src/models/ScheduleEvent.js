const mongoose = require('mongoose');

// Fixed, small set of categories (design doc 2.2.1). Modeled as an enum field
// on the event rather than its own collection.
const CATEGORIES = ['Main', 'Fun', 'Food', 'Workshop'];

/**
 * Derive a "YYYY-MM-DD" day string from a Date, in UTC.
 * Stored redundantly alongside startTime so the frontend can group/filter by
 * day cheaply (design doc 2.2.1: `day` derived from startTime).
 *
 * Assumption: event times are stored in UTC. If the hackathon later needs a
 * fixed local timezone for day grouping, this is the single place to change it.
 */
function toDayString(date) {
  return date.toISOString().slice(0, 10);
}

const scheduleEventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
      minlength: [1, 'title cannot be blank'],
    },
    // Optional longer detail, not shown on the compact card but useful for a detail view.
    description: {
      type: String,
      trim: true,
      default: '',
    },
    startTime: {
      type: Date,
      required: [true, 'startTime is required'],
    },
    // Optional but recommended for duration display and conflict checks.
    endTime: {
      type: Date,
      default: null,
    },
    location: {
      type: String,
      required: [true, 'location is required'],
      trim: true,
      minlength: [1, 'location cannot be blank'],
    },
    category: {
      type: String,
      required: [true, 'category is required'],
      enum: {
        values: CATEGORIES,
        message: `category must be one of: ${CATEGORIES.join(', ')}`,
      },
    },
    // Derived from startTime (see toDayString). Indexed for fast per-day queries.
    day: {
      type: String,
      index: true,
    },
    // Convenience flag; mirrors `category === 'Food'`. Used later by the Profile
    // page to know which events generate attendance/QR check-in records.
    isFoodEvent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Keep derived fields consistent on every create and save, and validate that
// endTime (when present) is after startTime.
scheduleEventSchema.pre('validate', function deriveFields(next) {
  if (this.startTime instanceof Date && !Number.isNaN(this.startTime.getTime())) {
    this.day = toDayString(this.startTime);
  }
  this.isFoodEvent = this.category === 'Food';
  next();
});

scheduleEventSchema.path('endTime').validate(function endAfterStart(value) {
  if (value == null) return true;
  if (!(this.startTime instanceof Date)) return true;
  return value.getTime() > this.startTime.getTime();
}, 'endTime must be after startTime');

// Drop the internal version key from API responses.
scheduleEventSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.__v;
    return ret;
  },
});

const ScheduleEvent = mongoose.model('ScheduleEvent', scheduleEventSchema);

module.exports = ScheduleEvent;
module.exports.CATEGORIES = CATEGORIES;
module.exports.toDayString = toDayString;
