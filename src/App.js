import React, { useRef, useState } from 'react';
import {
  AlertCircle, ArrowRight, Briefcase, CheckCircle2, CircleDollarSign,
  Clock3, Gift, History, LayoutDashboard, Lock, LogOut, MapPin,
  PlusCircle, Star, UserRound
} from 'lucide-react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import heroBg from './assets/image.png';
import logoImg from './assets/logo-3.png';
import rewardOne from './assets/dashboard/assets/001-2_129.png';
import rewardTwo from './assets/dashboard/assets/002-2_138.png';
import rewardThree from './assets/dashboard/assets/003-2_147.png';
import promoBg from './assets/dashboard/assets/004-2_31.png';
import avatar from './assets/dashboard/assets/005-2_45.png';

const purchases = [
  ['12 Jan 2026', 'Goa Family Holiday Package', '₹45,000', '450'],
  ['25 Feb 2026', 'Hampi Group Tour', '₹12,500', '125'],
  ['10 Mar 2026', 'Kerala Backwaters', '₹32,000', '320'],
  ['05 Apr 2026', 'Rajasthan Heritage Tour', '₹28,000', '280'],
];

const rewards = [
  [rewardOne, 'Beach Resort Voucher', '₹500 off on select beach resorts', '500 PTS'],
  [rewardTwo, 'Free Travel Accessories Kit', 'Premium luggage and travel accessories', '750 PTS'],
  [rewardThree, '₹1000 off on International Packages', 'Exciting adventure sports experience', '1000 PTS'],
];

function Dashboard({ onLogout }) {
  const nav = [
    [LayoutDashboard, 'Dashboard'], [History, 'Purchase History'], [Gift, 'Rewards'],
    [PlusCircle, 'Earn Points'], [UserRound, 'Profile'], [LogOut, 'Logout'],
  ];
  return <div className="dashboard-shell">
    <aside className="dashboard-sidebar">
      <div className="dashboard-logo"><b>GAC</b><span>Holidays</span><small>POINTS SYSTEM</small></div>
      <nav>{nav.map(([Icon, label], i) => <button key={label} className={i === 0 ? 'active' : ''} onClick={label === 'Logout' ? onLogout : undefined}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="dashboard-promo" style={{backgroundImage: `url(${promoBg})`}}><b>Explore More.<br/>Earn More.</b><p>More journeys, more memories, more points.</p><i><ArrowRight size={18}/></i></div>
    </aside>
    <main className="dashboard-main">
      <header><div><h1>Welcome Back, Numa!</h1><p>Track your points, explore rewards and continue your journey with GAC Holidays.</p></div><div className="dashboard-user"><b>Hello, Numa</b><img src={avatar} alt="Numa"/></div></header>
      <section className="summary-grid">
        <article className="points-card"><div><small>TOTAL POINTS</small><Star size={20}/></div><h2>650 <span>PTS</span></h2><dl><div><dt>Available Points</dt><dd>650 PTS</dd></div><div><dt>Total Earned</dt><dd>1,250 PTS</dd></div><div><dt>Total Redeemed</dt><dd>600 PTS</dd></div></dl></article>
        <Stat icon={Briefcase} label="TOTAL BOOKINGS" value="6" detail="View all bookings →" link/>
        <Stat icon={CircleDollarSign} label="POINTS EARNED" value="1,250" detail="All time"/>
        <Stat icon={Gift} label="POINTS REDEEMED" value="600" detail="All time"/>
        <Stat icon={Clock3} label="POINTS EXPIRING" value="120" detail="On 31 Dec 2026"/>
      </section>
      <section className="dashboard-panels">
        <article className="panel history-panel"><PanelTitle title="Recent Purchase History"/><div className="purchase-table"><div className="purchase-head"><span>DATE</span><span>DESCRIPTION</span><span>AMOUNT</span><span>PTS EARNED</span></div>{purchases.map(row => <div className="purchase-row" key={row[0]}>{row.map((cell, i) => <span key={cell} data-label={['Date','Description','Amount','Points'][i]}>{cell}</span>)}</div>)}</div><div className="panel-note"><AlertCircle size={14}/> Points are credited after the completion of the trip.</div></article>
        <article className="panel rewards-panel"><PanelTitle title="Available Rewards"/><div>{rewards.map(([img, title, desc, points]) => <div className="reward-row" key={title}><img src={img} alt=""/><div><b>{title}</b><p>{desc}</p></div><strong>{points}</strong><span>›</span></div>)}</div><div className="rewards-note"><Gift size={14}/> More rewards. More journeys. More memories.</div></article>
      </section>
    </main>
  </div>;
}

function Stat({ icon: Icon, label, value, detail, link }) {
  return <article className="stat-card"><div><small>{label}</small><i><Icon size={17}/></i></div><h3>{value}</h3><p className={link ? 'stat-link' : ''}>{detail}</p></article>;
}

function PanelTitle({ title }) { return <div className="panel-title"><h2>{title}</h2><button>View All</button></div>; }

function App() {
  const [mode, setMode] = useState('login');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [toast, setToast] = useState('');
  const otpRefs = useRef([]);

  if (mode === 'dashboard') return <Dashboard onLogout={() => { setMode('login'); setOtpSent(false); setOtp(['','','','']); }} />;

  const sendOtp = (e) => { e.preventDefault(); if (phone.replace(/\D/g, '').length < 10) return setToast('Enter a valid mobile number.'); setToast('Dummy OTP sent. Enter any 4 digits.'); setOtpSent(true); };
  const verify = (e) => { e.preventDefault(); if (otp.join('').length !== 4) return setToast('Enter the complete 4-digit OTP.'); setMode('dashboard'); };
  const changeOtp = (index, value) => { const digit = value.replace(/\D/g, '').slice(-1); const next = [...otp]; next[index] = digit; setOtp(next); if (digit && index < 3) otpRefs.current[index + 1]?.focus(); };

  return <div className="app-container">
    {toast && <div className="toast-notification success"><CheckCircle2 size={18}/><span>{toast}</span></div>}
    <section className="hero-panel" style={{backgroundImage: `url(${heroBg})`}}><div className="hero-overlay"/><div className="hero-content-top"><div className="brand-header"><img src={logoImg} alt="GAC Holidays" className="brand-logo"/><span className="brand-subtitle">POINTS SYSTEM</span></div></div><div className="hero-content-middle"><div className="hero-copy"><h1 className="hero-title hero-title-playfair">Your Points,<br/>Endless <span className="highlight-yellow">Journeys</span></h1><p className="hero-description hero-description-playfair">Login to access your rewards, track points and unlock exciting travel experiences.</p></div></div><div className="hero-content-bottom"><div className="features-grid"><Feature icon={Star} title="Earn Points" text="Every booking earns you more."/><Feature icon={Gift} title="Get Rewards" text="Redeem points for amazing benefits."/><Feature icon={MapPin} title="Explore More" text="More destinations, more memories."/></div></div></section>
    <section className="form-panel"><div className="card-wrapper"><div className="login-card"><div className="card-header"><h2 className="card-title">Welcome Back</h2><p className="card-subtitle">Login to your GAC Holidays Rewards account</p></div>{!otpSent ? <form onSubmit={sendOtp}><div className="form-group"><label className="form-label" htmlFor="login-phone">Mobile Number</label><PhoneInput country="in" value={phone} onChange={setPhone} inputProps={{id:'login-phone'}} containerClass="phone-container" inputClass="phone-field"/></div><button className="btn-primary" type="submit">Send OTP</button></form> : <form onSubmit={verify}><p className="otp-copy">Enter the 4-digit dummy OTP sent to your mobile number.</p><div className="otp-inputs">{otp.map((digit, i) => <input key={i} ref={el => otpRefs.current[i] = el} value={digit} onChange={e => changeOtp(i, e.target.value)} inputMode="numeric" maxLength="1" aria-label={`OTP digit ${i+1}`}/>)}</div><button className="btn-primary" type="submit">Verify &amp; Proceed</button><button className="otp-action-link" type="button" onClick={() => setOtpSent(false)}>Change Number</button></form>}</div><div className="security-footer"><Lock size={14}/><span>Secure login powered by GAC Holidays</span></div></div></section>
  </div>;
}

function Feature({ icon: Icon, title, text }) { return <div className="feature-item"><div className="feature-icon-badge"><Icon size={16}/></div><h3 className="feature-title">{title}</h3><p className="feature-desc">{text}</p></div>; }

export default App;
