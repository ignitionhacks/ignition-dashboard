import { useLocation, useNavigate } from 'react-router-dom'
import logoImg from '../assets/logo.svg'
import { useAuth } from '../lib/auth'
import {
  HomeIcon,
  ScheduleIcon,
  LinkIcon,
  DiscordIcon,
  MapIcon,
  HelpIcon,
} from './icons'

const HACKER_MENU_ITEMS = [
  { key: 'home', label: 'Home', icon: HomeIcon, path: '/landing' },
  { key: 'schedule', label: 'Schedule', icon: ScheduleIcon, path: '/schedule' },
]

const ORGANIZER_MENU_ITEMS = [
  { key: 'organizer', label: 'Organizer Portal', icon: HomeIcon, path: '/organizer' },
]

const QUICK_LINKS = [
  { key: 'devpost', label: 'Devpost', icon: LinkIcon },
  { key: 'discord', label: 'Discord', icon: DiscordIcon },
  { key: 'map', label: 'Venue Map', icon: MapIcon },
  { key: 'help', label: 'Need Help?', icon: HelpIcon },
]

function BrandIcons() {
  return (
    <div className="hk-landing-brand-icons" aria-hidden="true">
      <span className="hk-landing-brand-icon hk-landing-brand-icon--sun" />
      <span className="hk-landing-brand-icon hk-landing-brand-icon--orb" />
      <span className="hk-landing-brand-icon hk-landing-brand-icon--cloud" />
      <img src={logoImg} alt="" className="hk-landing-brand-icon hk-landing-brand-icon--flame" />
    </div>
  )
}

export default function Sidebar({ activeKey }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user } = useAuth()
  const isOrganizer = user?.role === 'organizer' || user?.role === 'admin'
  const menuItems = isOrganizer ? ORGANIZER_MENU_ITEMS : HACKER_MENU_ITEMS

  return (
    <aside className="hk-landing-sidebar">
      <div className="hk-landing-sidebar-section">
        <h2 className="hk-landing-sidebar-heading">Menu</h2>
        <nav className="hk-landing-sidebar-nav" aria-label="Main">
          {menuItems.map(({ key, label, icon: Icon, path }) => {
            const isActive = activeKey ? activeKey === key : path === pathname
            return (
              <button
                key={key}
                type="button"
                className={`hk-landing-nav-item${isActive ? ' hk-landing-nav-item--active' : ''}`}
                onClick={path ? () => navigate(path) : undefined}
              >
                <span className="hk-landing-nav-icon"><Icon /></span>
                <span>{label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="hk-landing-sidebar-divider" role="presentation" />

      <div className="hk-landing-sidebar-section">
        <h2 className="hk-landing-sidebar-heading">Quick Links</h2>
        <nav className="hk-landing-sidebar-nav" aria-label="Quick links">
          {QUICK_LINKS.map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" className="hk-landing-nav-item">
              <span className="hk-landing-nav-icon"><Icon /></span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      <BrandIcons />
    </aside>
  )
}
