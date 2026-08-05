import { NavLink } from 'react-router-dom';

const navIconAssets = {
  article: '/assets/icon-home.svg',
  calendar: '/assets/icon-calendar.svg',
  checkerboard: '/assets/icon-bingo.svg',
  user: '/assets/icon-user.svg',
  link: '/assets/icon-link.svg',
  discord: '/assets/icon-discord.svg',
  map: '/assets/icon-map.svg',
  ambulance: '/assets/icon-help.svg',
};

const footerAssets = {
  star: '/assets/footer-star.svg',
  redDot: '/assets/footer-red-dot.svg',
  blueFlower: '/assets/footer-blue-flower.svg',
  logo: '/assets/logo.svg',
};

const navItems = [
  { id: 'home', label: 'Home', icon: 'article' },
  { id: 'schedule', label: 'Schedule', icon: 'calendar', to: '/schedule' },
  { id: 'bingo', label: 'Bingo', icon: 'checkerboard' },
  { id: 'profile', label: 'My Profile', icon: 'user', to: '/profile' },
];

const quickLinks = [
  { id: 'devpost', label: 'Devpost', icon: 'link' },
  { id: 'discord', label: 'Discord', icon: 'discord' },
  { id: 'venue', label: 'Venue Map', icon: 'map' },
  { id: 'help', label: 'Need Help?', icon: 'ambulance' },
];

function NavItem({ item, compact = false }) {
  const className = `nav-item ${compact ? 'compact-item' : ''}`;

  if (item.to) {
    return (
      <NavLink
        to={item.to}
        aria-label={item.label}
        title={item.label}
        className={({ isActive }) => `${className} ${isActive ? 'active' : ''}`}
      >
        <span className="nav-icon-wrapper" aria-hidden="true">
          <img src={navIconAssets[item.icon]} alt="" className="nav-icon-image" />
        </span>
        <span>{item.label}</span>
      </NavLink>
    );
  }

  return (
    <button
      type="button"
      aria-label={item.label}
      title={item.label}
      className={className}
    >
      <span className="nav-icon-wrapper" aria-hidden="true">
        <img src={navIconAssets[item.icon]} alt="" className="nav-icon-image" />
      </span>
      <span>{item.label}</span>
    </button>
  );
}

export default function Navbar() {
  return (
    <aside className="sidebar-panel">
      <div className="sidebar-block">
        <p className="sidebar-heading">Menu</p>
        <nav className="nav-list" aria-label="Main menu">
          {navItems.map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </nav>
      </div>

      <div className="divider" />

      <div className="sidebar-block quick-links-block">
        <p className="sidebar-heading">Quick Links</p>
        <nav className="nav-list compact" aria-label="Quick links">
          {quickLinks.map((item) => (
            <NavItem key={item.id} item={item} compact />
          ))}
        </nav>
      </div>

      <div className="sidebar-footer" aria-hidden="true">
        <img src={footerAssets.star} alt="" className="footer-asset star" />
        <img src={footerAssets.redDot} alt="" className="footer-asset red-dot" />
        <img src={footerAssets.blueFlower} alt="" className="footer-asset blue-flower" />
        <img src={footerAssets.logo} alt="" className="footer-asset logo" />
      </div>
    </aside>
  );
}
