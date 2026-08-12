const mongoose = require('mongoose');

const QRCode = require('../models/QRCode');
const Attendance = require('../models/Attendance');
const ScheduleEvent = require('../models/ScheduleEvent');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
// Only `ok` is imported: `created` is already a local variable name in this file.
const { ok } = require('../utils/apiResponse');

/**
 * QR code issuing, scanning and lookup (design doc §3.2.1).
 *
 * The backend deals only in the raw code string - it never renders or stores an
 * image. The frontend turns the string into a QR graphic client side.
 */

/**
 * Find the user behind a QR code.
 *
 * ⚠️ Phase 2.6 note: this is the ONLY place in this file that reads the User
 * collection. When users move to the read-only portal database, this function is
 * the single thing that changes - not six scattered `User.findById` calls.
 */
async function findUserById(userId) {
  return User.findById(userId);
}

/**
 * Get this user's QR code, creating it on first request.
 *
 * §3.2.1 allows generating the code "at account creation (or first login)". We do
 * it lazily here instead of in the register controller, because Phase 2.6 deletes
 * `POST /api/auth/register` outright - anything hooked there would be thrown away.
 */
const getMyQrCode = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const existing = await QRCode.findOne({ userId });
  if (existing) return ok(res, existing);

  try {
    const created = await QRCode.create({ userId });
    return ok(res, created);
  } catch (err) {
    // Two of the user's own requests raced. The unique index on userId rejected
    // the loser; read back the winner rather than returning a 500.
    if (err.code === 11000) {
      return ok(res, await QRCode.findOne({ userId }));
    }
    throw err;
  }
});

/**
 * POST /api/qrcode/scan  {code, scheduleEventId}
 * Called by the organizer-facing check-in tool. This is the only thing that ever
 * ticks a box on a hacker's Profile checklist.
 *
 * A re-scan returns 200 with `alreadyCheckedIn: true` rather than an error: at a
 * food line organizers re-scan constantly, and an error colour reads as "the
 * scanner is broken" and holds up the queue.
 */
const scanQrCode = catchAsync(async (req, res) => {
  const { code, scheduleEventId } = req.body;

  if (typeof code !== 'string' || code.trim() === '') {
    throw new ApiError(400, 'code is required');
  }
  if (!scheduleEventId) {
    throw new ApiError(400, 'scheduleEventId is required');
  }
  // Distinguish "that could never be an id" (400) from "no such event" (404).
  if (!mongoose.isValidObjectId(scheduleEventId)) {
    throw new ApiError(400, 'scheduleEventId must be a valid id');
  }

  const qrCode = await QRCode.findOne({ code });
  if (!qrCode) throw new ApiError(404, 'Unknown QR code');

  const event = await ScheduleEvent.findById(scheduleEventId);
  if (!event) throw new ApiError(404, 'Event not found');

  const { attendance, created } = await Attendance.recordCheckIn({
    userId: qrCode.userId,
    scheduleEventId: event._id,
    checkedInBy: req.user._id,
  });

  ok(res, { alreadyCheckedIn: !created, attendance }, created ? 201 : 200);
});

/**
 * GET /api/qrcode/:code/user
 * Support/manual lookup: which hacker does this code belong to?
 * Organizer/Admin only - this resolves to another user's details.
 */
const getUserByCode = catchAsync(async (req, res) => {
  const qrCode = await QRCode.findOne({ code: req.params.code });
  if (!qrCode) throw new ApiError(404, 'Unknown QR code');

  const user = await findUserById(qrCode.userId);
  if (!user) throw new ApiError(404, 'User not found');

  ok(res, user);
});

module.exports = { getMyQrCode, scanQrCode, getUserByCode };
