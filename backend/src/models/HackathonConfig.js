const mongoose = require('mongoose');

// The only value the discriminator may ever hold. It exists purely to give the
// unique index something to be unique on.
const SINGLETON_KEY = 'hackathon';

/**
 * HackathonConfig (design doc §1.2.3, §4).
 *
 * §4: "A HackathonConfig is a singleton, referenced implicitly by everything
 * time based" - the Home countdown and the submission deadline both read from
 * here rather than hardcoding dates.
 *
 * The singleton is enforced by the **database**, not by convention: a
 * `singleton` field pinned to one enum value with a unique index. A second
 * document is impossible, and an attempt surfaces as the standard §5
 * `409 CONFLICT`. The alternatives - a hardcoded `_id`, or trusting whatever
 * `findOne()` returns first - both look fine until two documents exist, and
 * then fail silently in different directions.
 */
const hackathonConfigSchema = new mongoose.Schema(
  {
    singleton: {
      type: String,
      enum: {
        values: [SINGLETON_KEY],
        message: `singleton must be "${SINGLETON_KEY}"`,
      },
      default: SINGLETON_KEY,
      unique: true,
      immutable: true,
    },
    hackathonStartAt: {
      type: Date,
      required: [true, 'hackathonStartAt is required'],
    },
    hackathonEndAt: {
      type: Date,
      required: [true, 'hackathonEndAt is required'],
    },
    /**
     * Optional. §1.2.4 permits "a dedicated submissionDeadline"; when it is
     * absent the submission routes fall back to `hackathonEndAt`, so "no
     * deadline configured" and "deadline passed" stay distinguishable.
     */
    submissionDeadline: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Same rule, and the same implementation, as ScheduleEvent's endTime: strictly
// after, so a zero-length hackathon is rejected too.
hackathonConfigSchema.path('hackathonEndAt').validate(function endAfterStart(value) {
  if (value == null) return true;
  if (!(this.hackathonStartAt instanceof Date)) return true;
  return value.getTime() > this.hackathonStartAt.getTime();
}, 'hackathonEndAt must be after hackathonStartAt');

/**
 * The one way to read the config. Returns the document or `null` - never a
 * fabricated default, because a countdown to an invented date is worse than a
 * visibly missing one.
 */
hackathonConfigSchema.statics.getSingleton = function getSingleton() {
  return this.findOne({ singleton: SINGLETON_KEY });
};

// `singleton` is an internal implementation detail of the uniqueness rule -
// clients have no use for it and should never send it back.
hackathonConfigSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.__v;
    delete ret.singleton;
    return ret;
  },
});

const HackathonConfig = mongoose.model('HackathonConfig', hackathonConfigSchema);

module.exports = HackathonConfig;
module.exports.SINGLETON_KEY = SINGLETON_KEY;
