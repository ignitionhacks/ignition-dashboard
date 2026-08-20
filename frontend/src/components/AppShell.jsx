import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppShell({ activeKey, children }) {
  return (
    <div className="hk-landing">
      <TopBar />
      <div className="hk-landing-body">
        <Sidebar activeKey={activeKey} />
        <main className="hk-landing-main hk-landing-main--plain">{children}</main>
      </div>
    </div>
  )
}
