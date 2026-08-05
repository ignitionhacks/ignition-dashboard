import { useMemo, useState } from 'react';

const categories = ['Main', 'Fun', 'Food', 'Workshop'];

const categoryStyles = {
  Main: { className: 'chip purple', accent: '#a172ff' },
  Fun: { className: 'chip blue', accent: '#4894ff' },
  Food: { className: 'chip yellow', accent: '#ffb44a' },
  Workshop: { className: 'chip red', accent: '#ff585b' },
};

const mapPinAsset = '/assets/icon-pin.svg';

export const eventsData = [
  {
    id: 1,
    day: 'Friday',
    category: 'Main',
    time: '9:00 AM',
    title: 'Opening Ceremony',
    location: 'Main Auditorium',
    accent: '#a172ff',
  },
  {
    id: 2,
    day: 'Friday',
    category: 'Main',
    time: '10:00 AM',
    title: 'Hacking Begins!',
    location: 'Floor 2, 3, 4',
    accent: '#a172ff',
  },
  {
    id: 3,
    day: 'Friday',
    category: 'Food',
    time: '11:30 AM',
    title: 'Lunch',
    location: 'Floor 4',
    accent: '#ffb44a',
  },
  {
    id: 4,
    day: 'Friday',
    category: 'Fun',
    time: '1:30 PM',
    title: 'Clash Royale',
    location: 'Floor 4',
    accent: '#4894ff',
  },
  {
    id: 5,
    day: 'Friday',
    category: 'Workshop',
    time: '2:00 PM',
    title: 'AI Wrapper',
    location: 'Floor 3',
    accent: '#ff585b',
  },
  {
    id: 6,
    day: 'Saturday',
    category: 'Main',
    time: '9:00 AM',
    title: 'Opening Ceremony',
    location: 'Main Auditorium',
    accent: '#a172ff',
  },
  {
    id: 7,
    day: 'Saturday',
    category: 'Main',
    time: '10:00 AM',
    title: 'Hacking Begins!',
    location: 'Floor 2, 3, 4',
    accent: '#a172ff',
  },
  {
    id: 8,
    day: 'Saturday',
    category: 'Food',
    time: '11:30 AM',
    title: 'Lunch',
    location: 'Floor 4',
    accent: '#ffb44a',
  },
  {
    id: 9,
    day: 'Saturday',
    category: 'Fun',
    time: '1:30 PM',
    title: 'Clash Royale',
    location: 'Floor 4',
    accent: '#4894ff',
  },
  {
    id: 10,
    day: 'Saturday',
    category: 'Workshop',
    time: '2:00 PM',
    title: 'AI Wrapper',
    location: 'Floor 3',
    accent: '#ff585b',
  },
];

export function filterEventsByDay(selectedCategory) {
  const visibleEvents = eventsData.filter((event) => event.category === selectedCategory);

  return ['Friday', 'Saturday'].map((day) => ({
    day,
    events: visibleEvents.filter((event) => event.day === day),
  }));
}

export default function SchedulePage() {
  const [selectedCategory, setSelectedCategory] = useState('Main');
  const eventsByDay = useMemo(() => filterEventsByDay(selectedCategory), [selectedCategory]);

  return (
    <section className="schedule-panel">
      <div className="schedule-header">
        <p className="schedule-title">Event Schedule</p>

        <div className="chip-row">
          {categories.map((category) => {
            const isActive = selectedCategory === category;
            const style = categoryStyles[category];
            return (
              <button
                key={category}
                type="button"
                className={`${style.className} ${isActive ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category)}
                style={isActive ? { backgroundColor: style.accent } : undefined}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      <p className="date-label">August 14-15</p>

      <div className="schedule-body">
        {eventsByDay.map(({ day, events }) => (
          <section key={day} className="day-section">
            <h2>{day}, August {day === 'Friday' ? '14' : '15'}</h2>
            <div className="event-list">
              {events.map((event) => (
                <article key={event.id} className="event-row">
                  <div className="event-time">{event.time}</div>
                  <div className="event-details">
                    <h3>{event.title}</h3>
                    <div className="location-row">
                      <img src={mapPinAsset} alt="" className="location-icon-image" />
                      <span>{event.location}</span>
                    </div>
                  </div>
                  <div className="event-bar" style={{ backgroundColor: event.accent }} />
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
