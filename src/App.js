import React, { useRef, useState } from 'react';
import {
  AlertCircle, ArrowRight, Briefcase, Calendar, CheckCircle2, CircleDollarSign,
  Clock3, Gift, History, LayoutDashboard, Lock, LogOut, MapPin,
  PlusCircle, Star, User, UserRound
} from 'lucide-react';
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
  const [mode, setMode] = useState('register');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDob, setRegDob] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('success');
  const otpRefs = useRef([]);
  const dateRef = useRef(null);

  if (mode === 'dashboard') return <Dashboard onLogout={() => { setMode('login'); setOtpSent(false); setOtp(['','','','']); }} />;

  const notify = (message, type = 'success') => { setToast(message); setToastType(type); };
  const validPhone = value => /^[6-9]\d{9}$/.test(value);
  const switchMode = next => { setMode(next); setOtpSent(false); setOtp(['','','','']); setToast(''); };
  const register = (e) => { e.preventDefault(); if (regName.trim().length < 2) return notify('Please enter your full name.', 'error'); if (!validPhone(regPhone)) return notify('Enter a valid 10-digit mobile number.', 'error'); if (!regDob) return notify('Please select your date of birth.', 'error'); notify('Registration successful! You can now login.'); switchMode('login'); };
  const sendOtp = (e) => { e.preventDefault(); if (!validPhone(loginPhone)) return notify('Enter a valid 10-digit mobile number.', 'error'); notify('Dummy OTP sent. Enter any 4 digits.'); setOtpSent(true); };
  const verify = (e) => { e.preventDefault(); if (otp.join('').length !== 4) return notify('Enter the complete 4-digit OTP.', 'error'); setMode('dashboard'); };
  const changeOtp = (index, value) => { const digit = value.replace(/\D/g, '').slice(-1); const next = [...otp]; next[index] = digit; setOtp(next); if (digit && index < 3) otpRefs.current[index + 1]?.focus(); };
  const phoneChange = setter => e => setter(e.target.value.replace(/\D/g, '').slice(0, 10));

  return <div className="app-container">
    {toast && <div className={`toast-notification ${toastType}`}>{toastType === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}<span>{toast}</span></div>}
    <section className="hero-panel" style={{backgroundImage: `url(${heroBg})`}}><div className="hero-overlay"/><div className="hero-content-top"><div className="brand-header"><img src={logoImg} alt="GAC Holidays" className="brand-logo"/><span className="brand-subtitle">POINTS SYSTEM</span></div></div><div className="hero-content-middle"><div className="hero-copy"><h1 className="hero-title hero-title-playfair">Your Points,<br/>Endless <span className="highlight-yellow">Journeys</span></h1><p className="hero-description hero-description-playfair">Login to access your rewards, track points and unlock exciting travel experiences.</p></div></div><div className="hero-content-bottom"><div className="features-grid"><Feature icon={Star} title="Earn Points" text="Every booking earns you more."/><Feature icon={Gift} title="Get Rewards" text="Redeem points for amazing benefits."/><Feature icon={MapPin} title="Explore More" text="More destinations, more memories."/></div></div></section>
    <section className="form-panel">{mode === 'register' ? <div className="card-wrapper"><div className="register-card"><div className="card-header light"><h2 className="card-title light">Create Your Account</h2><p className="card-subtitle light">Join GAC Holidays Rewards and start earning!</p></div><form onSubmit={register} noValidate><div className="form-group"><label className="form-label light" htmlFor="reg-name">Full Name</label><div className="input-wrapper name-field"><User className="input-icon" size={18}/><input id="reg-name" className="form-input name-input" placeholder="Enter your full name" value={regName} onChange={e => setRegName(e.target.value)}/></div></div><div className="form-group"><label className="form-label light" htmlFor="reg-phone">Mobile Number</label><FixedPhoneInput id="reg-phone" value={regPhone} onChange={phoneChange(setRegPhone)}/></div><div className="form-group"><label className="form-label light" htmlFor="reg-dob">Date of Birth</label><div className="input-wrapper date-field"><button type="button" className="date-picker-btn" onClick={() => dateRef.current?.showPicker?.()}><Calendar className="input-icon date-icon" size={18}/></button><span className="input-divider date-divider"/><input ref={dateRef} id="reg-dob" type="date" className="form-input date-input" value={regDob} onChange={e => setRegDob(e.target.value)}/></div></div><button type="submit" className="btn-primary auth-submit">Register</button><div className="divider light"><div className="divider-line light"/><span className="divider-text light">OR</span><div className="divider-line light"/></div><p className="toggle-auth-link light">Already have an account? <button type="button" className="link-button-blue" onClick={() => switchMode('login')}>Login</button></p></form></div><div className="security-footer"><Lock size={14}/><span>Your information is secure with us.</span></div></div> : <div className="card-wrapper"><div className="login-card"><div className="card-header"><h2 className="card-title">Welcome <span className="highlight-yellow">Back!</span></h2><p className="card-subtitle">Login to continue to your account</p></div>{!otpSent ? <form onSubmit={sendOtp} noValidate><div className="form-group"><label className="form-label" htmlFor="login-phone">Mobile Number</label><FixedPhoneInput id="login-phone" value={loginPhone} onChange={phoneChange(setLoginPhone)}/></div><button className="btn-primary auth-submit" type="submit">Send OTP</button><div className="divider"><div className="divider-line"/><span className="divider-text">OR</span><div className="divider-line"/></div><p className="toggle-auth-link">New user? <button type="button" className="link-button-yellow" onClick={() => switchMode('register')}>Register</button></p></form> : <form onSubmit={verify}><div className="otp-sent-banner">OTP sent to +91 {loginPhone}</div><div className="form-group"><label className="form-label">Enter 4-Digit OTP</label><div className="otp-inputs">{otp.map((digit, i) => <input className="form-input otp-box" key={i} ref={el => otpRefs.current[i] = el} value={digit} onChange={e => changeOtp(i, e.target.value)} inputMode="numeric" maxLength="1" aria-label={`OTP digit ${i+1}`}/>)}</div></div><button className="btn-primary auth-submit" type="submit">Verify &amp; Proceed</button><div className="otp-actions"><button className="otp-action-link dim" type="button" onClick={() => setOtpSent(false)}>Change Number</button><button className="otp-action-link yellow" type="button" onClick={sendOtp}>Resend OTP</button></div></form>}</div><div className="security-footer"><Lock size={14}/><span>Secure login powered by GAC Holidays</span></div></div>}</section>
  </div>;
}

function FixedPhoneInput({ id, value, onChange }) { return <div className="fixed-phone"><span>+91</span><input id={id} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="Enter your mobile number" value={value} onChange={onChange}/></div>; }

function Feature({ icon: Icon, title, text }) { return <div className="feature-item"><div className="feature-icon-badge"><Icon size={16}/></div><h3 className="feature-title">{title}</h3><p className="feature-desc">{text}</p></div>; }

export default App;
