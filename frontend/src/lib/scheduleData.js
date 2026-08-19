/**
 * Hardcoded Ignition Hacks 2026 schedule, transcribed from the team's
 * schedule sheet (Main tab): https://docs.google.com/spreadsheets/d/15D_ZM12PHI6jChNH1oSbaN5QnytNyJEpfzVXcEtgpmc
 * No backend call — the Home and Schedule pages are frontend-only for now.
 * The sheet has no location column, so none is fabricated here.
 */

export const CATEGORIES = ['General', 'Ceremonies', 'Workshops', 'Fun Event']

export const CATEGORY_COLORS = {
  General: '#4894ff',
  Ceremonies: '#e0508a',
  Workshops: '#ff585b',
  'Fun Event': '#7bc96f',
}

export const SCHEDULE_DAYS = [
  {
    day: 'Day 1',
    dateLabel: 'August 14',
    events: [
      { id: 'opening-ceremonies', time: '7:00 PM – 8:00 PM', title: 'Opening Ceremonies', category: 'Ceremonies' },
      { id: 'hacking-starts', time: '8:00 PM', title: 'Hacking Starts', category: 'General' },
      { id: 'skribbl-minigame', time: '10:00 PM – 11:00 PM', title: 'skribbl.io Minigame', category: 'Workshops' },
    ],
  },
  {
    day: 'Day 2',
    dateLabel: 'August 15',
    events: [
      { id: 'after-hours-game-night', time: '1:00 AM – 9:00 AM', title: 'After-Hours Game Night', category: 'Fun Event' },
      { id: 'scavenger-hunt', time: '9:00 AM – 6:00 PM', title: 'Google Form Scavenger Hunt', category: 'Fun Event' },
      { id: 'waterloo-panel', time: '12:00 PM – 12:40 PM', title: 'Waterloo Engineering Admissions Panel', category: 'Workshops' },
      { id: 'world-labs-speaker', time: '12:45 PM – 1:30 PM', title: 'World Labs Guest Speaker', category: 'Workshops' },
      { id: 'hacking-ends', time: '6:00 PM', title: 'Hacking Ends', category: 'General' },
      { id: 'judging-period', time: '6:00 PM – 8:00 PM', title: 'Judging Period', category: 'General' },
      { id: 'closing-ceremonies', time: '8:00 PM – 9:00 PM', title: 'Closing Ceremonies', category: 'Ceremonies' },
    ],
  },
]

/** Flat chronological list, for the Home page's "Happening Next" widget. */
export const ALL_EVENTS = SCHEDULE_DAYS.flatMap((d) => d.events)
