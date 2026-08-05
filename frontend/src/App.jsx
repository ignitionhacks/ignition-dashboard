import { Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProfilePage from './components/ProfilePage';
import SchedulePage from './components/SchedulePage';
import './main.css';

const logoAsset = '/assets/logo.svg';

function TopBar() {
  return (
    <div className="top-bar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <img src={logoAsset} alt="" className="brand-mark-image" />
        </div>
        <h1>IGNITION HACKS V7</h1>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <TopBar />
      <div className="page-frame">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/schedule" replace />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/schedule" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
