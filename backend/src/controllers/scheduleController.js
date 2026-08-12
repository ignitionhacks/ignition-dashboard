const ScheduleEvent = require('../models/ScheduleEvent');
const { CATEGORIES } = require('../models/ScheduleEvent');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/apiResponse');

// Fields a client is allowed to set. Anything else in the body is ignored so
// clients can't write derived/internal fields (day, isFoodEvent, timestamps).
const WRITABLE_FIELDS = ['title', 'description', 'startTime', 'endTime', 'location', 'category'];

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pickWritable(body) {
  const out = {};
  for (const key of WRITABLE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

/**
 * GET /api/schedule
 * Retrieve all events, optionally filtered by ?day=YYYY-MM-DD and/or ?category.
 * Always returned in time order (startTime ascending) so the frontend never has
 * to sort. Blank titles/times/locations can't exist (enforced by the schema),
 * but we also guard the query so any legacy bad rows never reach the client.
 */
const listEvents = catchAsync(async (req, res) => {
  const { day, category } = req.query;
  const filter = {};

  if (day !== undefined) {
    if (!DAY_PATTERN.test(day)) {
      throw new ApiError(400, 'day must be in YYYY-MM-DD format, e.g. 2026-08-14');
    }
    filter.day = day;
  }

  if (category !== undefined) {
    if (!CATEGORIES.includes(category)) {
      throw new ApiError(400, `category must be one of: ${CATEGORIES.join(', ')}`);
    }
    filter.category = category;
  }

  // Defensive cleanliness guard: never hand back events with a blank
  // title/startTime/location even if bad data somehow got in.
  filter.title = { $nin: [null, ''] };
  filter.location = { $nin: [null, ''] };
  filter.startTime = { $ne: null };

  const events = await ScheduleEvent.find(filter).sort({ startTime: 1 });
  ok(res, { count: events.length, events });
});

/**
 * GET /api/schedule/upcoming?limit=5
 * The next N events with startTime >= now, ascending. Powers the "Happening
 * Next" panel on the Home Dashboard (design doc 1.2.3). Computed, not stored.
 */
const upcomingEvents = catchAsync(async (req, res) => {
  let limit = Number.parseInt(req.query.limit, 10);
  if (!Number.isInteger(limit) || limit <= 0) limit = 5;
  limit = Math.min(limit, 50); // hard cap

  const events = await ScheduleEvent.find({ startTime: { $gte: new Date() } })
    .sort({ startTime: 1 })
    .limit(limit);

  ok(res, { count: events.length, events });
});

/**
 * GET /api/schedule/:id
 * Retrieve a single event's detail.
 */
const getEvent = catchAsync(async (req, res) => {
  const event = await ScheduleEvent.findById(req.params.id);
  if (!event) throw new ApiError(404, 'Event not found');
  ok(res, event);
});

/**
 * POST /api/schedule
 * Create a new event. (Intended access: Organizer/Admin.)
 */
const createEvent = catchAsync(async (req, res) => {
  const event = await ScheduleEvent.create(pickWritable(req.body));
  created(res, event);
});

/**
 * PATCH /api/schedule/:id
 * Update an event (time change, location change, ...). Loads-then-saves so the
 * derived fields (day, isFoodEvent) and all validators re-run on every edit.
 */
const updateEvent = catchAsync(async (req, res) => {
  const event = await ScheduleEvent.findById(req.params.id);
  if (!event) throw new ApiError(404, 'Event not found');

  Object.assign(event, pickWritable(req.body));
  await event.save();
  ok(res, event);
});

/**
 * DELETE /api/schedule/:id
 * Remove a cancelled event.
 *
 * Returns 200 with a body rather than 204: design doc §5 lists 200 for a
 * successful DELETE and lists no 204 at all, and a 204 has no body to carry
 * the response envelope in.
 */
const deleteEvent = catchAsync(async (req, res) => {
  const event = await ScheduleEvent.findByIdAndDelete(req.params.id);
  if (!event) throw new ApiError(404, 'Event not found');
  ok(res, { deleted: true, id: event._id });
});

module.exports = {
  listEvents,
  upcomingEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
};
