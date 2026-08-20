import iggyImg from '../../assets/iggy.svg'
import { useAuth } from '../../lib/auth'
import { ALL_EVENTS, CATEGORY_COLORS } from '../../lib/scheduleData'
import Sidebar from '../../components/Sidebar'
import TopBar from '../../components/TopBar'
import { StarIcon } from '../../components/icons'
import './Landing.css'

// Static for now — no backend call on this page yet.
const MOCK_ANNOUNCEMENTS = [
  { id: 1, body: 'Welcome to Ignition Hacks!', author: 'Ignition Hacks Team', time: '' },
]

// "Happening Next" — the first few events off the hardcoded schedule (lib/scheduleData.js).
const HAPPENING_NEXT = ALL_EVENTS.slice(0, 5)

function AnnouncementCard({ body, author, time }) {
  return (
    <article className="hk-landing-announcement">
      <p className="hk-landing-announcement-body">{body}</p>
      <div className="hk-landing-announcement-meta">
        <span>{author}</span>
        {time && <span>{time}</span>}
      </div>
    </article>
  )
}

function ScheduleItem({ time, title, category }) {
  return (
    <div className="hk-landing-event">
      <span className="hk-landing-event-time">{time}</span>
      <div className="hk-landing-event-details">
        <p className="hk-landing-event-title">{title}</p>
        <p className="hk-landing-event-location">{category}</p>
      </div>
      <span className="hk-landing-event-bar" style={{ backgroundColor: CATEGORY_COLORS[category] }} aria-hidden="true" />
    </div>
  )
}

export default function Landing() {
  const { user } = useAuth()
  const firstName = user?.firstName || 'Bobby'

  return (
    <div className="hk-landing">
      <TopBar />

      <div className="hk-landing-body">
        <Sidebar activeKey="home" />

        <main className="hk-landing-main">
          <div className="hk-landing-main-header">
            <div>
              <h2 className="hk-landing-welcome">Welcome, {firstName}!</h2>
              <p className="hk-landing-subtext">
                Ignition Hacks V7 is live! You have <span className="hk-landing-timer">24:00:00</span> hours to hack
              </p>
            </div>
            <button type="button" className="hk-landing-submit-btn">
              <StarIcon />
              <span>Submit Project</span>
            </button>
          </div>

          <div className="hk-landing-banner">
            <img src={iggyImg} alt="" className="hk-landing-banner-iggy" />
          </div>

          <div className="hk-landing-columns">
            <section className="hk-landing-announcements" aria-labelledby="hk-landing-announcements-title">
              <h3 id="hk-landing-announcements-title" className="hk-landing-section-title">
                Announcements:
              </h3>
              <div className="hk-landing-announcement-list">
                {MOCK_ANNOUNCEMENTS.map((item) => <AnnouncementCard key={item.id} {...item} />)}
              </div>
            </section>

            <section className="hk-landing-happening" aria-labelledby="hk-landing-happening-title">
              <h3 id="hk-landing-happening-title" className="hk-landing-happening-title">
                Happening Next
              </h3>
              <div className="hk-landing-event-list">
                {HAPPENING_NEXT.map((item) => <ScheduleItem key={item.id} {...item} />)}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
