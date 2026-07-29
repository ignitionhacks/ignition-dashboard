const navIconAssets = {
  article: 'https://www.figma.com/api/mcp/asset/f690edb2-2f15-4f82-b683-b7bddb4861ef',
  calendar: 'https://www.figma.com/api/mcp/asset/0452bd28-b33a-4573-a6d3-cb6130e80d67',
  checkerboard: 'https://www.figma.com/api/mcp/asset/635b83e5-9b23-4693-8628-4f42872b608f',
  user: 'https://www.figma.com/api/mcp/asset/eaaccaa6-288e-4e72-8ce9-464a7fa239df',
  link: 'https://www.figma.com/api/mcp/asset/f9cd58d6-56d7-4ffa-abbb-eac21b53925d',
  discord: 'https://www.figma.com/api/mcp/asset/86eb924a-32f3-4eb4-a0b4-568903800b90',
  map: 'https://www.figma.com/api/mcp/asset/ca019bb5-9454-4192-bbb1-9095d3784064',
  ambulance: 'https://www.figma.com/api/mcp/asset/e0ad59e4-1123-427a-806a-a27c33b115b7',
};

const footerAssets = {
  star: 'https://www.figma.com/api/mcp/asset/b76e7845-0543-4387-9af8-fe81c5202b2c',
  redDot: 'https://www.figma.com/api/mcp/asset/c2dd4b69-443b-4406-b140-450074574db7',
  blueFlower: 'https://www.figma.com/api/mcp/asset/8bb3fee2-128c-4058-aa38-8c1bf8c7e196',
  purpleFlame: 'https://www.figma.com/api/mcp/asset/d02a5120-c2f0-4a12-962f-6fc99b3d3635',
};

const navItems = [
  { id: 'home', label: 'Home', icon: 'article', active: false },
  { id: 'schedule', label: 'Schedule', icon: 'calendar', active: true },
  { id: 'bingo', label: 'Bingo', icon: 'checkerboard', active: false },
  { id: 'profile', label: 'My Profile', icon: 'user', active: false },
];

const quickLinks = [
  { id: 'devpost', label: 'Devpost', icon: 'link' },
  { id: 'discord', label: 'Discord', icon: 'discord' },
  { id: 'venue', label: 'Venue Map', icon: 'map' },
  { id: 'help', label: 'Need Help?', icon: 'ambulance' },
];

function NavItem({ item, compact = false }) {
  return (
    <button
      type="button"
      aria-label={item.label}
      title={item.label}
      className={`nav-item ${compact ? 'compact-item' : ''} ${item.active ? 'active' : ''}`}
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
        <img src={footerAssets.purpleFlame} alt="" className="footer-asset purple-flame" />
      </div>
    </aside>
  );
}
