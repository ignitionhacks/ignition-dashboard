import logoImg from '../assets/logo.svg'

export default function TopBar() {
  return (
    <header className="hk-landing-top">
      <img src={logoImg} alt="" className="hk-landing-logo" />
      <h1 className="hk-landing-brand">IGNITION HACKS V7</h1>
    </header>
  )
}
