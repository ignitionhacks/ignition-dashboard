const mongoose = require('mongoose');

/**
 * Attendance (design doc §3.2.2).
 *
 * One record per hacker per event, created when an organizer scans their badge.
 *
 * Records are **never pre-created**. The Profile checklist is computed on read by
 * joining Food events against whatever records exist (see the attendance
 * controller), so adding an event costs no writes and a hacker who has attended
 * nothing costs no storage.
 *
 * Hackers cannot check themselves in - there is no hacker-facing write route.
 * That keeps the numbers trustworthy for catering and headcount.
 */
const attendanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
    },
    // Links the checklist row back to the authoritative event definition
    // (date, title, location) rather than copying those fields.
    scheduleEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScheduleEvent',
      required: [true, 'scheduleEventId is required'],
    },
    checkedIn: {
      type: Boolean,
      default: false,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
    // The organizer/mentor operating the scanner, kept for audit purposes.
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

/**
 * The rule that makes re-scanning safe. Enforced by the database, because two
 * scanners can hit the same hacker at the same instant and controller-side
 * "check then insert" logic loses that race.
 */
attendanceSchema.index({ userId: 1, scheduleEventId: 1 }, { unique: true });

// The compound index above leads with userId, so it cannot serve a headcount
// query that only knows the event. GET /api/attendance/event/:id needs this one.
attendanceSchema.index({ scheduleEventId: 1 });

/**
 * Stamp the check-in time when the flag goes true, and never overwrite an
 * existing one - the first scan is the real arrival time, which is what catering
 * counts care about. Mirrors the derived-field hook on ScheduleEvent.
 */
attendanceSchema.pre('validate', function stampCheckIn(next) {
  if (this.checkedIn && !this.checkedInAt) {
    this.checkedInAt = new Date();
  }
  next();
});

/**
 * Record a check-in, creating the document if it does not exist yet.
 *
 * Both `POST /api/qrcode/scan` and `POST /api/attendance` (the manual fallback)
 * go through here, so the two paths cannot drift apart.
 *
 * Returns `{ attendance, created }`. `created: false` means this was a re-scan -
 * the caller turns that into a 200 with `alreadyCheckedIn: true` rather than an
 * error, because at a food line an organizer re-scans constantly and a red error
 * reads as "the scanner is broken".
 */
attendanceSchema.statics.recordCheckIn = async function recordCheckIn({
  userId,
  scheduleEventId,
  checkedInBy,
}) {
  const existing = await this.findOne({ userId, scheduleEventId });

  if (existing) {
    // A placeholder row (checkedIn: false) can still be flipped. An already
    // checked-in row is left exactly as it is, original scanner and all.
    if (!existing.checkedIn) {
      existing.checkedIn = true;
      existing.checkedInBy = checkedInBy;
      await existing.save();
    }
    return { attendance: existing, created: false };
  }

  try {
    const attendance = await this.create({
      userId,
      scheduleEventId,
      checkedIn: true,
      checkedInBy,
    });
    return { attendance, created: true };
  } catch (err) {
    // Lost a race with a second scanner between the findOne and the insert.
    // The unique index did its job; read back what the winner wrote.
    if (err.code === 11000) {
      const attendance = await this.findOne({ userId, scheduleEventId });
      return { attendance, created: false };
    }
    throw err;
  }
};

attendanceSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.__v;
    return ret;
  },
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
