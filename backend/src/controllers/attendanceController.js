const mongoose = require('mongoose');

const Attendance = require('../models/Attendance');
const ScheduleEvent = require('../models/ScheduleEvent');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

/**
 * Attendance checklist, headcount and manual entry (design doc §3.2.2).
 *
 * ⚠️ Phase 2.6 note: every read of the User collection in this file goes through
 * `findUserById` / `findUsersByIds` below. Those two functions are the only thing
 * that changes when users move to the read-only portal database. Note they are
 * deliberately plain queries rather than `.populate()` - a populate cannot cross
 * two mongoose connections, so it would have to be unpicked later anyway.
 */
async function findUserById(userId) {
  return User.findById(userId);
}

async function findUsersByIds(userIds) {
  return User.find({ _id: { $in: userIds } });
}

/** Reject ids that could never be an ObjectId with a 400, so 404 keeps its meaning. */
function assertValidId(value, fieldName) {
  if (!value) throw new ApiError(400, `${fieldName} is required`);
  if (!mongoose.isValidObjectId(value)) {
    throw new ApiError(400, `${fieldName} must be a valid id`);
  }
}

/**
 * GET /api/attendance/me
 * The Profile checklist. The single call the Profile page needs.
 *
 * Computed on read, never pre-created: every Food event is fetched and left
 * joined against this user's Attendance records. A hacker who has attended
 * nothing still receives every row, each with `checkedIn: false`. That is the
 * whole point of the design - adding an event costs no writes, and no storage is
 * spent on rows that only say "hasn't happened yet".
 */
const getMyChecklist = catchAsync(async (req, res) => {
  const userId = req.user._id;

  // Sorted here so the frontend never has to, matching GET /api/schedule.
  const events = await ScheduleEvent.find({ isFoodEvent: true }).sort({ startTime: 1 });

  const records = await Attendance.find({ userId });
  const byEventId = new Map(records.map((r) => [r.scheduleEventId.toString(), r]));

  const checklist = events.map((event) => {
    const record = byEventId.get(event._id.toString());
    return {
      scheduleEventId: event._id,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      day: event.day,
      location: event.location,
      category: event.category,
      checkedIn: record ? record.checkedIn : false,
      checkedInAt: record ? record.checkedInAt : null,
    };
  });

  res.json({ count: checklist.length, checklist });
});

/**
 * GET /api/attendance/event/:scheduleEventId
 * Headcount for one event. Organizer/Admin only.
 *
 * An event nobody has attended returns an empty list, not a 404 - the event
 * exists, the attendance is simply zero.
 */
const getEventAttendance = catchAsync(async (req, res) => {
  const { scheduleEventId } = req.params;
  assertValidId(scheduleEventId, 'scheduleEventId');

  const event = await ScheduleEvent.findById(scheduleEventId);
  if (!event) throw new ApiError(404, 'Event not found');

  const records = await Attendance.find({ scheduleEventId }).sort({ checkedInAt: 1 });

  const users = await findUsersByIds(records.map((r) => r.userId));
  const byUserId = new Map(users.map((u) => [u._id.toString(), u]));

  const attendance = records.map((record) => ({
    ...record.toJSON(),
    user: byUserId.get(record.userId.toString()) || null,
  }));

  res.json({ count: attendance.length, scheduleEventId: event._id, attendance });
});

/**
 * POST /api/attendance  {userId, scheduleEventId}
 * Manual fallback for when a QR scan fails. Organizer/Mentor only - there is
 * deliberately no hacker-facing way to self-report attendance.
 *
 * Shares `Attendance.recordCheckIn` with POST /api/qrcode/scan so the manual path
 * and the scanned path cannot drift apart.
 */
const createAttendance = catchAsync(async (req, res) => {
  const { userId, scheduleEventId } = req.body;

  assertValidId(userId, 'userId');
  assertValidId(scheduleEventId, 'scheduleEventId');

  const user = await findUserById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  const event = await ScheduleEvent.findById(scheduleEventId);
  if (!event) throw new ApiError(404, 'Event not found');

  const { attendance, created } = await Attendance.recordCheckIn({
    userId: user._id,
    scheduleEventId: event._id,
    checkedInBy: req.user._id,
  });

  res.status(created ? 201 : 200).json({ alreadyCheckedIn: !created, attendance });
});

module.exports = { getMyChecklist, getEventAttendance, createAttendance };
