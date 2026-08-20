import { useState } from 'react';
import { CATEGORIES, CATEGORY_COLORS, SCHEDULE_DAYS } from '../lib/scheduleData';

const ALL = 'All';

export default function SchedulePage() {
  const [selectedCategory, setSelectedCategory] = useState(ALL);

  const filters = [ALL, ...CATEGORIES];

  const visibleDays = SCHEDULE_DAYS.map((section) => ({
    ...section,
    events:
      selectedCategory === ALL
        ? section.events
        : section.events.filter((event) => event.category === selectedCategory),
  }));

  return (
    <section className="schedule-panel">
      <div className="schedule-header">
        <p className="schedule-title">Event Schedule</p>

        <div className="chip-row chip-row--proportional">
          {filters.map((category) => {
            const isActive = selectedCategory === category;
            const color = CATEGORY_COLORS[category] || '#6B5A45';
            return (
              <button
                key={category}
                type="button"
                className={`chip chip--proportional ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
                style={{ backgroundColor: category === ALL ? '#6B5A45' : color }}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      <p className="date-label">August 21–22</p>

      <div className="schedule-body">
        {visibleDays.map(({ day, dateLabel, events }) => (
          <section key={day} className="day-section">
            <h2>
              {day}
              {dateLabel ? `, ${dateLabel}` : ''}
            </h2>
            {events.length === 0 ? (
              <p>No events in this category.</p>
            ) : (
              <div className="event-list">
                {events.map((event) => (
                  <article key={event.id} className="event-row">
                    <div className="event-time">{event.time}</div>
                    <div className="event-details">
                      <h3>{event.title}</h3>
                    </div>
                    <div className="event-bar" style={{ backgroundColor: CATEGORY_COLORS[event.category] }} />
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
