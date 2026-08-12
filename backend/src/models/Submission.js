const mongoose = require('mongoose');

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;

/**
 * Deliberately permissive: `http(s)://` followed by something.
 *
 * Hackers paste GitHub, GitLab, Devpost, and occasionally a Google Drive link.
 * Rejecting a valid submission at 11:58pm because of an over-tight regex is a
 * far worse failure than accepting an odd URL, so this checks the scheme and
 * stops there.
 */
const URL_PATTERN = /^https?:\/\/\S+$/;

/**
 * Project Submission (design doc §1.2.4).
 *
 * Backs the Home dashboard's "Submit Project" button and its "already submitted"
 * state. §4: "Each Project Submission belongs to a Team … only one submission
 * exists per team" - so this is scoped to a team, never to a user, and every
 * teammate reads and edits the same document.
 */
const submissionSchema = new mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'teamId is required'],
    },
    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
      minlength: [1, 'title cannot be blank'],
      maxlength: [MAX_TITLE_LENGTH, `title cannot be longer than ${MAX_TITLE_LENGTH} characters`],
    },
    description: {
      type: String,
      required: [true, 'description is required'],
      trim: true,
      minlength: [1, 'description cannot be blank'],
      maxlength: [
        MAX_DESCRIPTION_LENGTH,
        `description cannot be longer than ${MAX_DESCRIPTION_LENGTH} characters`,
      ],
    },
    devpostUrl: {
      type: String,
      trim: true,
      default: null,
      match: [URL_PATTERN, 'devpostUrl must start with http:// or https://'],
    },
    repoUrl: {
      type: String,
      trim: true,
      default: null,
      match: [URL_PATTERN, 'repoUrl must start with http:// or https://'],
    },
    /**
     * When the team first submitted. `immutable` because an edit is an edit -
     * the "submitted at 11:47pm" line on a judging sheet must not move because
     * someone fixed a typo afterwards. `updatedAt` records that separately.
     */
    submittedAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    /**
     * An addition to §1.2.4's field list: which teammate pressed submit.
     *
     * One field, no cost, and it is the difference between being able and unable
     * to answer "who submitted this?" during a judging dispute. It mirrors
     * `Attendance.checkedInBy`, which the doc *does* specify "for audit
     * purposes" - the same reasoning applies. Recorded here so it reads as a
     * decision rather than scope creep.
     */
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

/**
 * §4's "only one submission exists per team", enforced by the database.
 *
 * The controller checks first so the common case gets a clean message, but two
 * teammates can press Submit in the same instant and a controller-side
 * "check then insert" loses that race. This index does not - the loser surfaces
 * as the `409 CONFLICT` §5 names as its example.
 */
submissionSchema.index({ teamId: 1 }, { unique: true });

submissionSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.__v;
    return ret;
  },
});

const Submission = mongoose.model('Submission', submissionSchema);

module.exports = Submission;
module.exports.MAX_TITLE_LENGTH = MAX_TITLE_LENGTH;
module.exports.MAX_DESCRIPTION_LENGTH = MAX_DESCRIPTION_LENGTH;
module.exports.URL_PATTERN = URL_PATTERN;
