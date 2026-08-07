import React, { useRef, useState } from 'react';
import {
  AlertCircle, Briefcase, Calendar, CheckCircle2, CircleDollarSign,
  Gift, History, LayoutDashboard, Lock, LogOut, Mail, MapPin,
  Phone, Star, User, UserRound
} from 'lucide-react';
import logoImg from './assets/logo-3.png';
import rewardOne from './assets/dashboard/assets/001-2_129.png';
import rewardTwo from './assets/dashboard/assets/002-2_138.png';
import rewardThree from './assets/dashboard/assets/003-2_147.png';
import promoBg from './assets/dashboard/assets/004-2_31.png';
import avatar from './assets/dashboard/assets/005-2_45.png';
import milestone1 from './assets/dashboard/assets/1.webp';
import milestone2 from './assets/dashboard/assets/2.jpg';
import milestone3 from './assets/dashboard/assets/3.webp';
import milestone4 from './assets/dashboard/assets/4.jpg';
import milestone5 from './assets/dashboard/assets/5.webp';
import milestone6 from './assets/dashboard/assets/6.jpg';
import milestone7 from './assets/dashboard/assets/7.jpg';
import milestone8 from './assets/dashboard/assets/8.png';
import milestone9 from './assets/dashboard/assets/9.jpg';
import milestone10 from './assets/dashboard/assets/10.webp';
import milestone11 from './assets/dashboard/assets/11.webp';
import milestone12 from './assets/dashboard/assets/12.webp';
import milestone13 from './assets/dashboard/assets/13.webp';

const heroBg = `${process.env.PUBLIC_URL}/imageeeee.png`;

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

const earningRules = [
  ['Hotels, Holidays & Visa Bookings', '₹1', '1 GAC Point'],
  ['Flight Bookings', '₹5', '1 GAC Point'],
];

const milestones = [
  ['50,000', 'Travel & Plantation Experience', 'Complimentary travel pillow, travel kit, or spice plantation with lunch for 2 people.'],
  ['100,000', 'Domestic Flight Comfort', 'Complimentary pre-booked meal and seat on your next domestic flight booking.'],
  ['200,000', 'Goa Experience for Two', 'Watersports for 2 people or dinner cruise on the Mandovi River for 2 people.'],
  ['300,000', 'Five-Star Brunch', 'Complimentary 5-star brunch for 2 people.'],
  ['500,000', 'Travel Suitcase', 'American Tourister travel suitcase.'],
  ['1,000,000', 'Premium Air Fryer', 'A premium air fryer selected by GAC Holidays.'],
  ['1,500,000', 'Goa Hotel Stay', 'Complimentary 1-night stay for 2 people at a selected 4/5-star hotel in Goa.'],
  ['2,000,000', 'India Stay or Smartphone', 'A 1-night hotel stay for 2 anywhere in India or a premium Android smartphone.'],
  ['5,000,000', 'Premium Smart Television', 'A premium smart television selected at redemption.'],
  ['7,000,000', 'Domestic Tour or Refrigerator', 'A complimentary domestic tour or premium refrigerator.'],
  ['10,000,000', 'International Tour or AC', 'A complimentary international tour or premium air conditioner.'],
  ['15,000,000', 'Apple iPhone 17', 'An Apple iPhone 17, subject to model and availability.'],
  ['20,000,000', '5 Gram Gold Coin', 'A complimentary 5 gram gold coin.'],
];

const milestoneImages = [milestone1, milestone2, milestone3, milestone4, milestone5, milestone6, milestone7, milestone8, milestone9, milestone10, milestone11, milestone12, milestone13];

function Dashboard({ customer, onLogout }) {
  const [view, setView] = useState('dashboard');
  const nav = [
    [LayoutDashboard, 'Dashboard', 'dashboard'], [History, 'Purchase History', 'history'],
    [Gift, 'Rewards', 'rewards'], [UserRound, 'Profile', 'profile'], [LogOut, 'Logout', 'logout'],
  ];
  const firstName = customer.name.trim().split(/\s+/)[0] || 'Customer';
  return <div className="dashboard-shell">
    <aside className="dashboard-sidebar">
      <div className="dashboard-logo"><b>GAC</b><span>Holidays</span><small>POINTS SYSTEM</small></div>
      <nav>{nav.map(([Icon, label, target]) => <button key={label} className={view === target ? 'active' : ''} onClick={target === 'logout' ? onLogout : () => setView(target)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="dashboard-promo" style={{backgroundImage: `url(${promoBg})`}} role="img" aria-label="Explore more. Earn more. More journeys, more memories, more points." />
    </aside>
    <main className="dashboard-main">
      <header><div><h1>{view === 'dashboard' ? `Welcome Back, ${firstName}!` : {history:'Purchase History',rewards:'Reward Milestones',profile:'My Profile'}[view]}</h1><p>{view === 'dashboard' ? 'Track your points, explore rewards and continue your journey with GAC Holidays.' : 'GAC Journey Rewards customer account'}</p></div><button className="dashboard-user" onClick={() => setView('profile')}><b>Hello, {firstName}</b><img src={avatar} alt={`${firstName} profile`}/></button></header>
      {view === 'dashboard' && <>
      <section className="summary-grid">
        <article className="points-card"><div><small>TOTAL POINTS</small><Star size={20}/></div><h2>650 <span>PTS</span></h2><dl><div><dt>Available Points</dt><dd>650 PTS</dd></div><div><dt>Total Earned</dt><dd>1,250 PTS</dd></div><div><dt>Total Redeemed</dt><dd>600 PTS</dd></div></dl></article>
        <Stat icon={Briefcase} label="TOTAL BOOKINGS" value="6" detail="View all bookings →" link/>
        <Stat icon={CircleDollarSign} label="POINTS EARNED" value="1,250" detail="All time"/>
        <Stat icon={Gift} label="POINTS REDEEMED" value="600" detail="All time"/>
      </section>
      <section className="dashboard-panels">
        <PurchaseHistory onViewAll={() => setView('history')}/>
        <article className="panel rewards-panel"><PanelTitle title="Available Rewards"/><div>{rewards.map(([img, title, desc, points]) => <div className="reward-row" key={title}><img src={img} alt=""/><div><b>{title}</b><p>{desc}</p></div><strong>{points}</strong><span>›</span></div>)}</div><div className="rewards-note"><Gift size={14}/> More rewards. More journeys. More memories.</div></article>
      </section>
      <RewardsContent includeEarning/>
      </>}
      {view === 'history' && <section className="focused-view"><PurchaseHistory/></section>}
      {view === 'rewards' && <section className="focused-view"><RewardsContent/></section>}
      {view === 'profile' && <Profile customer={customer}/>} 
    </main>
  </div>;
}

function PurchaseHistory({ onViewAll }) {
  return <article className="panel history-panel"><div className="panel-title"><h2>Recent Purchase History</h2>{onViewAll && <button onClick={onViewAll}>View All</button>}</div><div className="purchase-table"><div className="purchase-head"><span>DATE</span><span>DESCRIPTION</span><span>AMOUNT</span><span>PTS EARNED</span></div>{purchases.map(row => <div className="purchase-row" key={row[0]}>{row.map((cell, i) => <span key={cell} data-label={['Date','Description','Amount','Points'][i]}>{cell}</span>)}</div>)}</div><div className="panel-note"><AlertCircle size={14}/> Points are credited after the completion of the trip.</div></article>;
}

function RewardsContent({ includeEarning = false }) {
  return <section className="journey-rewards">
        {includeEarning && <>
        <div className="rewards-heading"><div><span>GAC JOURNEY REWARDS</span><h2>Book. Earn. Experience.</h2><p>Every eligible booking takes you closer to your next reward.</p></div><Gift size={32}/></div>
        <div className="earning-section"><div className="section-heading"><small>HOW IT WORKS</small><h2>Points Earning</h2></div><div className="earning-rules">{earningRules.map(([name, spend, points]) => <article key={name}><i><CircleDollarSign size={22}/></i><div><h3>{name}</h3><p><b>{spend}</b> spent earns <strong>{points}</strong></p></div></article>)}</div></div>
        </>}
        <div className="milestones-section"><div className="section-heading"><small>REDEEM YOUR POINTS</small><h2>Reward Milestones</h2><p>Unlock more memorable rewards as your points balance grows.</p></div><div className="milestone-grid">{milestones.map(([points, title, description], index) => <article className="milestone-card" key={points}><div className="reward-placeholder"><img src={milestoneImages[index]} alt={title}/></div><div className="milestone-copy"><span className="milestone-number">{points} PTS</span><h3>{title}</h3><p>{description}</p></div><b className="milestone-index">{String(index + 1).padStart(2, '0')}</b></article>)}</div></div>
        <div className="rewards-terms"><AlertCircle size={18}/><p><b>Reward terms:</b> Rewards are subject to availability and applicable terms. Flight benefits, hotel stays and travel experiences depend on partner availability. The brand, model, specifications and colour of merchandise will be decided by GAC Holidays at the time of redemption.</p></div>
      </section>;
}

function Profile({ customer }) {
  return <section className="profile-view"><div className="profile-hero"><img src={avatar} alt="Customer profile"/><div><small>GAC JOURNEY REWARDS MEMBER</small><h2>{customer.name}</h2><p>Manage your customer details and review your booking activity.</p></div></div><div className="profile-grid"><article><i><User size={20}/></i><small>FULL NAME</small><strong>{customer.name}</strong></article><article><i><Mail size={20}/></i><small>EMAIL ADDRESS</small><strong>{customer.email}</strong></article><article><i><Phone size={20}/></i><small>MOBILE NUMBER</small><strong>+91 {customer.phone}</strong></article><article><i><Briefcase size={20}/></i><small>TOTAL BOOKINGS</small><strong>6 bookings</strong></article></div><div className="profile-bookings"><PanelTitle title="Booking Summary"/><div className="profile-booking-stats"><div><b>6</b><span>Total bookings</span></div><div><b>4</b><span>Completed trips</span></div><div><b>2</b><span>Upcoming trips</span></div><div><b>1,250</b><span>Points earned</span></div></div></div></section>;
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
  const [customer, setCustomer] = useState({ name: 'Numa', email: 'numa@example.com', phone: '9876543210' });

  if (mode === 'dashboard') return <Dashboard customer={customer} onLogout={() => { setMode('login'); setOtpSent(false); setOtp(['','','','']); }} />;

  const notify = (message, type = 'success') => { setToast(message); setToastType(type); };
  const validPhone = value => /^[6-9]\d{9}$/.test(value);
  const switchMode = next => { setMode(next); setOtpSent(false); setOtp(['','','','']); setToast(''); };
  const register = (e) => { e.preventDefault(); if (regName.trim().length < 2) return notify('Please enter your full name.', 'error'); if (!validPhone(regPhone)) return notify('Enter a valid 10-digit mobile number.', 'error'); if (!regDob) return notify('Please select your date of birth.', 'error'); const emailName = regName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, ''); setCustomer({name: regName.trim(), email: `${emailName}@example.com`, phone: regPhone}); setLoginPhone(regPhone); setMode('login'); setToast('Registration successful! You can now login.'); setToastType('success'); };
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
