const mongoose = require('mongoose');

const MAX_TITLE_LENGTH = 200;

/**
 * Announcement (design doc §1.2.2). Backs the announcements feed on the Home
 * Dashboard: organizers post, every role reads, pinned items stay on top.
 *
 * §1.2.2 is explicit that there is **no per-user read/unread state**, so there
 * is deliberately no `readBy` here.
 */
const announcementSchema = new mongoose.Schema(
  {
    // Optional per §1.2.2 - short notices ("Doors open at 9") often have no title.
    title: {
      type: String,
      trim: true,
      default: '',
      maxlength: [MAX_TITLE_LENGTH, `title cannot be longer than ${MAX_TITLE_LENGTH} characters`],
    },
    body: {
      type: String,
      required: [true, 'body is required'],
      trim: true,
      minlength: [1, 'body cannot be blank'],
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'authorId is required'],
    },
    /**
     * Denormalized author name, per §1.2.2's stored-information list.
     *
     * Two reasons it is stored rather than populated. The feed renders the
     * author on every row, so this keeps it a single-collection query; and
     * Phase 2.6 moves users onto a separate mongoose connection (the read-only
     * portal database), which a `.populate()` cannot cross.
     *
     * It is a snapshot: renaming a user later does not rewrite their old
     * announcements. That is normal for a feed, and it is tested.
     */
    authorName: {
      type: String,
      required: [true, 'authorName is required'],
      trim: true,
    },
    // The feed's sort key. Set on create and never moved by an edit, so fixing a
    // typo doesn't jump the announcement back to the top.
    postedAt: {
      type: Date,
      default: Date.now,
    },
    pinned: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Matches the feed's sort exactly: pinned first, then newest.
announcementSchema.index({ pinned: -1, postedAt: -1 });

announcementSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.__v;
    return ret;
  },
});

const Announcement = mongoose.model('Announcement', announcementSchema);

module.exports = Announcement;
module.exports.MAX_TITLE_LENGTH = MAX_TITLE_LENGTH;
