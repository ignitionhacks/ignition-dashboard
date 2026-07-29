import { useMemo, useState } from 'react';
import Navbar from './components/Navbar';
import SchedulePage, { filterEventsByDay } from './components/SchedulePage';
import './main.css';

const logoAsset = 'https://www.figma.com/api/mcp/asset/3ee6ee4c-2be8-43f1-92bd-110f42d8df50';

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
  const [selectedCategory, setSelectedCategory] = useState('Main');

  const eventsByDay = useMemo(() => filterEventsByDay(selectedCategory), [selectedCategory]);

  return (
    <div className="app-shell">
      <TopBar />
      <div className="page-frame">
        <Navbar />
        <main>
          <SchedulePage selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} eventsByDay={eventsByDay} />
        </main>
      </div>
    </div>
  );
}
