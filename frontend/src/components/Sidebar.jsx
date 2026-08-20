import { useLocation, useNavigate } from 'react-router-dom'
import logoImg from '../assets/logo.svg'
import { useAuth } from '../lib/auth'
import {
  HomeIcon,
  ScheduleIcon,
  DiscordIcon,
  PackageIcon,
} from './icons'

const HACKER_MENU_ITEMS = [
  { key: 'schedule', label: 'Schedule', icon: ScheduleIcon, path: '/' },
]

const ORGANIZER_MENU_ITEMS = [
  { key: 'organizer', label: 'Organizer Portal', icon: HomeIcon, path: '/organizer' },
]

const QUICK_LINKS = [
  { key: 'discord', label: 'Discord', icon: DiscordIcon, href: 'https://discord.gg/rKgSHQVtk' },
  { key: 'hacker-package', label: 'Hacker Package', icon: PackageIcon, href: 'https://drive.google.com/file/d/10DOm224rWEhRUBs4r4NMvzFsvHvR7aY0/view' },
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
          {QUICK_LINKS.map(({ key, label, icon: Icon, href }) => (
            <a
              key={key}
              className="hk-landing-nav-item"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="hk-landing-nav-icon"><Icon /></span>
              <span>{label}</span>
            </a>
          ))}
        </nav>
      </div>

      <BrandIcons />
    </aside>
  )
}
