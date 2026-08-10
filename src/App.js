import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle, Award, Briefcase, Calendar, CheckCircle2, ChevronDown, Download,
  ChevronRight, CircleDollarSign, Eye, EyeOff, Gift, History,
  LayoutDashboard, Lock, LogOut, Mail, MapPin, Menu, Minus, Phone, Plus,
  Search, ShieldCheck, Star, Trash2, User, UserRound, Users, WalletCards, X
} from 'lucide-react';
import logoImg from './assets/logo-3.png';
import './Admin.css';
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

const calculateRewardPoints = (bookingType, purchasedAmount) => {
  const amount = Math.max(0, Number(purchasedAmount) || 0);
  return bookingType === 'Flights' ? Math.floor(amount / 5) : Math.floor(amount);
};

const purchases = [
  ['12 Jan 2026', 'Goa Family Holiday Package', '₹45,000', '450'],
  ['25 Feb 2026', 'Hampi Group Tour', '₹12,500', '125'],
  ['10 Mar 2026', 'Kerala Backwaters', '₹32,000', '320'],
  ['05 Apr 2026', 'Rajasthan Heritage Tour', '₹28,000', '280'],
];

const rewards = [
  [milestone7, 'Beach Resort Voucher', '₹500 off on select beach resorts', '500 PTS'],
  [milestone1, 'Free Travel Accessories Kit', 'Premium luggage and travel accessories', '750 PTS'],
  [milestone3, '₹1000 off on International Packages', 'Exciting adventure sports experience', '1000 PTS'],
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const nav = [
    [LayoutDashboard, 'Dashboard', 'dashboard'], [Gift, 'Rewards', 'rewards'],
    [History, 'Purchase History', 'history'], [UserRound, 'Profile', 'profile'],
  ];
  const firstName = customer.name.trim().split(/\s+/)[0] || 'Customer';
  const viewTitles = {
    history: ['Purchase History', 'Review points earned across your completed GAC Holidays journeys.'],
    rewards: ['Reward Milestones', 'Unlock more memorable rewards as your points balance grows.'],
    profile: ['My Profile', 'Manage your GAC Journey Rewards customer account.'],
  };
  return <div className="dashboard-shell">
    <div className="mobile-topbar">
      <img className="mobile-brand-logo" src={logoImg} alt="GAC Holidays"/>
      <div>
        <button className="mobile-profile-button" onClick={() => setView('profile')} aria-label="Open profile"><User size={17}/></button>
        <button className="mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation" aria-expanded={sidebarOpen}><Menu size={22}/></button>
      </div>
    </div>
    <button className={`dashboard-backdrop ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} aria-label="Close navigation" tabIndex={sidebarOpen ? 0 : -1}/>
    <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
      <button className="mobile-menu-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={21}/></button>
      <div className="dashboard-logo"><b>GAC</b><span>Holidays</span><small>POINTS SYSTEM</small></div>
      <nav aria-label="Customer account">{nav.map(([Icon, label, target]) => <button key={label} className={view === target ? 'active' : ''} aria-current={view === target ? 'page' : undefined} onClick={() => { setView(target); setSidebarOpen(false); }}><Icon size={17}/><span>{label}</span></button>)}</nav>
      <button className="dashboard-logout" onClick={onLogout}><LogOut size={17}/><span>Logout</span></button>
    </aside>
    <main className="dashboard-main">
      <header><div><h1>{view === 'dashboard' ? <>Welcome back, {firstName.toLowerCase()}! <span className="welcome-wave">👋</span></> : viewTitles[view][0]}</h1><p>{view === 'dashboard' ? <>Track your points, explore rewards and continue your journey with <b>GAC Holidays.</b></> : viewTitles[view][1]}</p>{view === 'rewards' && <small className="rewards-action-label">REDEEM YOUR POINTS.</small>}</div>{view !== 'profile' && <button className="dashboard-user" onClick={() => setView('profile')} aria-label="Open profile"><i><User size={14}/></i><b>{firstName.toLowerCase()}</b></button>}</header>
      {view === 'dashboard' && <>
      <section className="summary-grid">
        <article className="points-card"><div><small>TOTAL POINTS</small><i><Star size={17}/></i></div><h2>650 <span>PTS</span></h2><p>Available to redeem</p></article>
        <Stat icon={Calendar} label="TOTAL BOOKINGS" value="6" detail="All time"/>
        <Stat icon={WalletCards} label="POINTS EARNED" value="1,250" suffix="PTS" detail="All time"/>
        <Stat icon={Gift} label="POINTS REDEEMED" value="600" detail="All time"/>
      </section>
      <section className="dashboard-rewards">
        <div className="dashboard-rewards-title"><h2>Available Rewards</h2><button onClick={() => setView('rewards')}>View All Rewards <span>→</span></button></div>
        <div className="reward-card-grid">{rewards.map(reward => <RewardCard key={reward[1]} reward={reward}/>)}</div>
      </section>
      </>}
      {view === 'history' && <section className="focused-view"><PurchaseHistory/></section>}
      {view === 'rewards' && <section className="focused-view"><RewardsContent/></section>}
      {view === 'profile' && <Profile customer={customer}/>}
    </main>
  </div>;
}

function PurchaseHistory() {
  return <article className="panel history-panel"><div className="purchase-table"><div className="purchase-head"><span>DATE</span><span>DESCRIPTION</span><span>AMOUNT</span><span>PTS EARNED</span></div>{purchases.map(row => <div className="purchase-row" key={row[0]}>{row.map((cell, i) => <span key={cell} data-label={['Date','Description','Amount','Points'][i]}>{cell}</span>)}</div>)}</div><div className="panel-note"><AlertCircle size={14}/> Points are credited after the completion of the trip.</div></article>;
}

function RewardsContent({ includeEarning = false }) {
  return <section className="journey-rewards">
        {includeEarning && <>
        <div className="rewards-heading"><div><span>GAC JOURNEY REWARDS</span><h2>Book. Earn. Experience.</h2><p>Every eligible booking takes you closer to your next reward.</p></div><Gift size={32}/></div>
        <div className="earning-section"><div className="section-heading"><small>HOW IT WORKS</small><h2>Points Earning</h2></div><div className="earning-rules">{earningRules.map(([name, spend, points]) => <article key={name}><i><CircleDollarSign size={22}/></i><div><h3>{name}</h3><p><b>{spend}</b> spent earns <strong>{points}</strong></p></div></article>)}</div></div>
        </>}
        <div className="milestones-section"><div className="milestone-grid">{milestones.map(([points, title, description], index) => <article className="milestone-card" key={points}><div className="reward-placeholder"><img src={milestoneImages[index]} alt={title}/></div><div className="milestone-copy"><span className="milestone-number">{points} PTS</span><h3>{title}</h3><p>{description}</p></div></article>)}</div></div>
        <div className="rewards-terms"><AlertCircle size={18}/><p><b>Reward terms:</b> Rewards are subject to availability and applicable terms. Flight benefits, hotel stays and travel experiences depend on partner availability. The brand, model, specifications and colour of merchandise will be decided by GAC Holidays at the time of redemption.</p></div>
      </section>;
}

function RewardCard({ reward: [image, title, description, points] }) {
  return <article className="reward-card"><div className="reward-card-image"><img src={image} alt=""/><strong>{points}</strong></div><div className="reward-card-copy"><h3>{title}</h3><p>{description}</p><small><Calendar size={13}/> Valid till 31 Dec 2026</small><button>Redeem Now <span>→</span></button></div></article>;
}

function Profile({ customer }) {
  return <section className="profile-view"><div className="profile-hero"><i className="profile-avatar-icon" aria-hidden="true"><User size={38}/></i><div><small>GAC JOURNEY REWARDS MEMBER</small><h2>{customer.name}</h2><p>Manage your customer details and review your booking activity.</p></div></div><div className="profile-grid"><article><i><User size={20}/></i><small>FULL NAME</small><strong>{customer.name}</strong></article><article><i><Mail size={20}/></i><small>EMAIL ADDRESS</small><strong>{customer.email}</strong></article><article><i><Phone size={20}/></i><small>MOBILE NUMBER</small><strong>+91 {customer.phone}</strong></article><article><i><Briefcase size={20}/></i><small>TOTAL BOOKINGS</small><strong>6 bookings</strong></article></div><div className="profile-bookings"><PanelTitle title="Booking Summary"/><div className="profile-booking-stats"><div><b>6</b><span>Total bookings</span></div><div><b>4</b><span>Completed trips</span></div><div><b>2</b><span>Upcoming trips</span></div><div><b>1,250</b><span>Points earned</span></div></div></div></section>;
}

function Stat({ icon: Icon, label, value, suffix, detail }) {
  return <article className="stat-card"><div><small>{label}</small><i><Icon size={16}/></i></div><h3>{value} {suffix && <span>{suffix}</span>}</h3><p>{detail}</p></article>;
}

function PanelTitle({ title }) { return <div className="panel-title"><h2>{title}</h2><button>View All</button></div>; }

function CustomerApp() {
  const [mode, setMode] = useState('register');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
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

  useEffect(() => {
    if (toast !== 'Dummy OTP sent. Enter any 4 digits.') return undefined;
    const dismissTimer = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(dismissTimer);
  }, [toast]);

  if (mode === 'dashboard') return <Dashboard customer={customer} onLogout={() => { setMode('login'); setOtpSent(false); setOtp(['','','','']); }} />;

  const notify = (message, type = 'success') => { setToast(message); setToastType(type); };
  const validPhone = value => /^[6-9]\d{9}$/.test(value);
  const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
  const switchMode = next => { setMode(next); setOtpSent(false); setOtp(['','','','']); setToast(''); };
  const register = (e) => { e.preventDefault(); if (regName.trim().length < 2) return notify('Please enter your full name.', 'error'); if (!validEmail(regEmail)) return notify('Enter a valid email address.', 'error'); if (!validPhone(regPhone)) return notify('Enter a valid 10-digit mobile number.', 'error'); if (!regDob) return notify('Please select your date of birth.', 'error'); setCustomer({name: regName.trim(), email: regEmail.trim().toLowerCase(), phone: regPhone}); setLoginPhone(regPhone); setMode('login'); setToast('Registration successful! You can now login.'); setToastType('success'); };
  const sendOtp = (e) => { e.preventDefault(); if (!validPhone(loginPhone)) return notify('Enter a valid 10-digit mobile number.', 'error'); notify('Dummy OTP sent. Enter any 4 digits.'); setOtpSent(true); };
  const verify = (e) => { e.preventDefault(); if (otp.join('').length !== 4) return notify('Enter the complete 4-digit OTP.', 'error'); setMode('dashboard'); };
  const changeOtp = (index, value) => { const digit = value.replace(/\D/g, '').slice(-1); const next = [...otp]; next[index] = digit; setOtp(next); if (digit && index < 3) otpRefs.current[index + 1]?.focus(); };
  const phoneChange = setter => e => setter(e.target.value.replace(/\D/g, '').slice(0, 10));

  return <div className="app-container">
    {toast && <div className={`toast-notification ${toastType}`}>{toastType === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}<span>{toast}</span></div>}
    <section className="hero-panel" style={{backgroundImage: `url(${heroBg})`}}><div className="hero-overlay"/><div className="hero-content-top"><div className="brand-header"><img src={logoImg} alt="GAC Holidays" className="brand-logo"/><span className="brand-subtitle">POINTS SYSTEM</span></div></div><div className="hero-content-middle"><div className="hero-copy"><h1 className="hero-title hero-title-playfair">Your Points,<br/>Endless <span className="highlight-yellow">Journeys</span></h1><p className="hero-description hero-description-playfair">Login to access your rewards, track points and unlock exciting travel experiences.</p></div></div><div className="hero-content-bottom"><div className="features-grid"><Feature icon={Star} title="Earn Points" text="Every booking earns you more."/><Feature icon={Gift} title="Get Rewards" text="Redeem points for amazing benefits."/><Feature icon={MapPin} title="Explore More" text="More destinations, more memories."/></div></div></section>
    <section className="form-panel">{mode === 'register' ? <div className="card-wrapper"><div className="register-card"><div className="card-header light"><h2 className="card-title light">Create Your Account</h2><p className="card-subtitle light">Join GAC Holidays Rewards and start earning!</p></div><form onSubmit={register} noValidate><div className="form-group"><label className="form-label light" htmlFor="reg-name">Full Name</label><div className="input-wrapper name-field"><User className="input-icon" size={18}/><input id="reg-name" className="form-input name-input" autoComplete="name" placeholder="Enter your full name" value={regName} onChange={e => setRegName(e.target.value)}/></div></div><div className="form-group"><label className="form-label light" htmlFor="reg-email">Email Address</label><div className="input-wrapper name-field email-field"><Mail className="input-icon" size={18}/><input id="reg-email" className="form-input name-input email-input" type="email" inputMode="email" autoComplete="email" placeholder="Enter your email address" value={regEmail} onChange={e => setRegEmail(e.target.value)}/></div></div><div className="form-group"><label className="form-label light" htmlFor="reg-phone">Mobile Number</label><FixedPhoneInput id="reg-phone" value={regPhone} onChange={phoneChange(setRegPhone)}/></div><div className="form-group"><label className="form-label light" htmlFor="reg-dob">Date of Birth</label><div className="input-wrapper date-field"><button type="button" className="date-picker-btn" onClick={() => dateRef.current?.showPicker?.()}><Calendar className="input-icon date-icon" size={18}/></button><span className="input-divider date-divider"/><input ref={dateRef} id="reg-dob" type="date" className="form-input date-input" value={regDob} onChange={e => setRegDob(e.target.value)}/></div></div><button type="submit" className="btn-primary auth-submit">Register</button><div className="divider light"><div className="divider-line light"/><span className="divider-text light">OR</span><div className="divider-line light"/></div><p className="toggle-auth-link light">Already have an account? <button type="button" className="link-button-blue" onClick={() => switchMode('login')}>Login</button></p></form></div><div className="security-footer"><Lock size={14}/><span>Your information is secure with us.</span></div></div> : <div className="card-wrapper"><div className="login-card"><div className="card-header"><h2 className="card-title">Welcome <span className="highlight-yellow">Back!</span></h2><p className="card-subtitle">Login to continue to your account</p></div>{!otpSent ? <form onSubmit={sendOtp} noValidate><div className="form-group"><label className="form-label" htmlFor="login-phone">Mobile Number</label><FixedPhoneInput id="login-phone" value={loginPhone} onChange={phoneChange(setLoginPhone)}/></div><button className="btn-primary auth-submit" type="submit">Send OTP</button><div className="divider"><div className="divider-line"/><span className="divider-text">OR</span><div className="divider-line"/></div><p className="toggle-auth-link">New user? <button type="button" className="link-button-yellow" onClick={() => switchMode('register')}>Register</button></p></form> : <form onSubmit={verify}><div className="otp-sent-banner">OTP sent to +91 {loginPhone}</div><div className="form-group"><label className="form-label">Enter 4-Digit OTP</label><div className="otp-inputs">{otp.map((digit, i) => <input className="form-input otp-box" key={i} ref={el => otpRefs.current[i] = el} value={digit} onChange={e => changeOtp(i, e.target.value)} inputMode="numeric" maxLength="1" aria-label={`OTP digit ${i+1}`}/>)}</div></div><button className="btn-primary auth-submit" type="submit">Verify &amp; Proceed</button><div className="otp-actions"><button className="otp-action-link dim" type="button" onClick={() => setOtpSent(false)}>Change Number</button><button className="otp-action-link yellow" type="button" onClick={sendOtp}>Resend OTP</button></div></form>}</div><div className="security-footer"><Lock size={14}/><span>Secure login powered by GAC Holidays</span></div></div>}</section>
  </div>;
}

const adminCustomers = [
  { name: 'Rahul Sharma', phone: '9876543210', email: 'rahul.sharma@example.com', bookings: 5, points: 5450 },
  { name: 'Priya Singh', phone: '9823456781', email: 'priya.singh@example.com', bookings: 3, points: 3125 },
  { name: 'Amit Verma', phone: '9123456780', email: 'amit.verma@example.com', bookings: 4, points: 4320 },
  { name: 'Neha Shah', phone: '9988776655', email: 'neha.shah@example.com', bookings: 2, points: 2280 },
  { name: 'Karan Mehta', phone: '9870012345', email: 'karan.mehta@example.com', bookings: 6, points: 6600 },
  { name: 'Ananya Rao', phone: '9845012387', email: 'ananya.rao@example.com', bookings: 2, points: 1940 },
  { name: 'Vikram Nair', phone: '9900184521', email: 'vikram.nair@example.com', bookings: 7, points: 7820 },
  { name: 'Meera Iyer', phone: '9741122086', email: 'meera.iyer@example.com', bookings: 1, points: 980 },
].map((customer, customerIndex) => ({
  ...customer,
  bookingItems: Array.from({ length: customer.bookings }, (_, bookingIndex) => ({
    id: `GAC-${customer.phone.slice(-4)}-${String(bookingIndex + 1).padStart(2, '0')}`,
    type: ['Holidays', 'Hotels', 'Flights'][(customerIndex + bookingIndex) % 3],
    amount: 12000 + (bookingIndex * 4500),
    date: `2026-${String(((customerIndex + bookingIndex) % 8) + 1).padStart(2, '0')}-${String((bookingIndex % 20) + 5).padStart(2, '0')}`,
    rewardPoints: 0,
  })),
}));

function AdminPortal() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const login = async event => {
    event.preventDefault();
    const normalizeCredential = value => value.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    const enteredUsername = normalizeCredential(username).toLowerCase();
    const enteredPassword = normalizeCredential(password);
    const configuredUsername = normalizeCredential(process.env.REACT_APP_ADMIN_USERNAME || '').toLowerCase();
    const configuredPasswordHash = normalizeCredential(process.env.REACT_APP_ADMIN_PASSWORD_HASH || '').toLowerCase();
    if (!configuredUsername || !configuredPasswordHash) {
      setError('Admin login is not configured.');
      return;
    }
    const passwordBytes = new TextEncoder().encode(enteredPassword);
    const passwordDigest = await window.crypto.subtle.digest('SHA-256', passwordBytes);
    const enteredPasswordHash = Array.from(new Uint8Array(passwordDigest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (enteredUsername === configuredUsername && enteredPasswordHash === configuredPasswordHash) {
      setAuthenticated(true);
      setError('');
    } else setError('Incorrect username or password.');
  };
  if (!authenticated) return <main className="admin-login" style={{backgroundImage: `url(${heroBg})`}}>
    <div className="admin-login-shade"/>
    <header className="admin-login-brand"><img src={logoImg} alt="GAC Holidays"/><span>ADMIN PORTAL</span></header>
    <section className="admin-login-card" aria-labelledby="admin-login-title">
      <div className="admin-login-icon"><ShieldCheck size={28}/></div><h1 id="admin-login-title">Admin Login</h1><p>Sign in to manage customers and rewards.</p>
      <form onSubmit={login}><label htmlFor="admin-username">Username</label><div className="admin-login-field"><User size={18}/><input id="admin-username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={event => { setUsername(event.target.value); setError(''); }} placeholder="Enter admin username"/></div><label htmlFor="admin-password">Password</label><div className="admin-login-field"><Lock size={18}/><input id="admin-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" autoCapitalize="none" spellCheck={false} value={password} onChange={event => { setPassword(event.target.value); setError(''); }} placeholder="Enter admin password"/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>{error && <div className="admin-login-error" role="alert"><AlertCircle size={15}/>{error}</div>}<button className="admin-login-submit" type="submit">Login to Dashboard</button></form>
      <small><Lock size={13}/> Restricted access for authorized administrators.</small>
    </section>
  </main>;
  return <AdminDashboard onLogout={() => { setAuthenticated(false); setPassword(''); }}/>;
}

function AdminDashboard({ onLogout }) {
  const [section, setSection] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [customers, setCustomers] = useState(adminCustomers);
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const selectedCustomer = customers.find(customer => customer.phone === selectedCustomerPhone) || null;
  const sectionCopy = {
    dashboard: ['Dashboard', 'Welcome back, Admin!'],
    register: ['Register Customer', 'Create a customer profile and add their first booking.'],
    customers: ['Manage Customers', 'Search, review and manage every customer.'],
    reports: ['Generate Report', 'Filter booking data and prepare a summary.'],
  };
  const navItems = [
    ['dashboard', LayoutDashboard, 'Dashboard'],
    ['register', UserRound, 'Register Customer'],
    ['customers', Users, 'Manage Customers'],
    ['reports', Briefcase, 'Generate Report'],
  ];
  const metrics = [
    [User, 'TOTAL CUSTOMERS', customers.length.toLocaleString('en-IN'), 'blue'],
    [Calendar, 'TOTAL BOOKINGS', customers.reduce((sum, customer) => sum + customer.bookings, 0).toLocaleString('en-IN'), 'green'],
    [Award, 'TOTAL POINTS EARNED', customers.reduce((sum, customer) => sum + customer.points, 0).toLocaleString('en-IN'), 'gold'],
    [Gift, 'TOTAL POINTS REDEEMED', '18,750', 'purple'],
  ];
  const goTo = nextSection => {
    setSection(nextSection);
    setSidebarOpen(false);
    setProfileOpen(false);
  };
  const latestCustomers = customers.slice(-5).reverse();
  const updateCustomer = updatedCustomer => setCustomers(current => current.map(customer => customer.phone === updatedCustomer.phone ? updatedCustomer : customer));
  const manageExistingCustomer = customer => {
    goTo('customers');
    setSelectedCustomerPhone(customer.phone);
  };

  return <div className="admin-shell">
    <header className="admin-mobile-bar"><img src={logoImg} alt="GAC Holidays"/><button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open admin menu"><Menu size={27}/></button></header>
    <button className={`admin-sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`} type="button" onClick={() => setSidebarOpen(false)} aria-label="Close admin menu"/>
    <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="admin-sidebar-brand"><div><b><span>GAC</span>Holidays</b><small>POINTS SYSTEM</small></div><button type="button" onClick={() => setSidebarOpen(false)} aria-label="Close admin menu"><X size={22}/></button></div>
      <nav aria-label="Admin navigation">{navItems.map(([key, Icon, label]) => <button type="button" key={key} className={section === key ? 'active' : ''} onClick={() => goTo(key)}><Icon size={19}/><span>{label}</span></button>)}</nav>
      <button type="button" className="admin-sidebar-logout" onClick={onLogout}><LogOut size={19}/><span>Logout</span></button>
    </aside>
    <main className="admin-main">
      <header className="admin-workspace-header"><div><h1>{sectionCopy[section][0]}</h1><p>{sectionCopy[section][1]}</p></div><div className="admin-profile-wrap"><button className="admin-profile" onClick={() => setProfileOpen(value => !value)} aria-expanded={profileOpen}><i><User size={18}/></i><span><b>Admin</b><small>ADMINISTRATOR</small></span><ChevronDown size={16}/></button>{profileOpen && <div className="admin-profile-menu"><button onClick={onLogout}><LogOut size={15}/>Log out</button></div>}</div></header>
      {section === 'dashboard' && <>
        <section className="admin-kpis" aria-label="Summary metrics">{metrics.map(([Icon, label, value, tone]) => <article className="admin-kpi" key={label}><i className={tone}><Icon size={21}/></i><div><small>{label}</small><strong>{value}</strong></div></article>)}</section>
        <AdminCustomersPanel customers={latestCustomers} latest onViewAll={() => goTo('customers')} onSelect={customer => setSelectedCustomerPhone(customer.phone)}/>
      </>}
      {section === 'register' && <AdminRegisterPanel customers={customers} onExistingCustomer={manageExistingCustomer} onRegister={customer => setCustomers(current => current.some(item => item.phone === customer.phone) ? current : [...current, customer])}/>}
      {section === 'customers' && <AdminCustomersPanel customers={customers} searchable onSelect={customer => setSelectedCustomerPhone(customer.phone)}/>}
      {section === 'reports' && <AdminReportPanel customers={customers}/>}
      <aside className="admin-info"><b>i</b><span>Reward points are calculated automatically based on the company's criteria and updated in the system.</span></aside>
    </main>
    {selectedCustomer && <AdminCustomerManager customer={selectedCustomer} onChange={updateCustomer} onClose={() => setSelectedCustomerPhone(null)}/>}
  </div>;
}

function AdminCustomerManager({ customer, onChange, onClose }) {
  const [activeTab, setActiveTab] = useState('bookings');
  const [bookingForm, setBookingForm] = useState({ type: 'Holidays', amount: '', date: new Date().toISOString().slice(0, 10) });
  const [rewardAmount, setRewardAmount] = useState('');
  const [feedback, setFeedback] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const updateBookingForm = event => setBookingForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const addBooking = event => {
    event.preventDefault();
    const amount = Math.max(0, Number(bookingForm.amount) || 0);
    if (!amount || !bookingForm.date) {
      setFeedback('Enter a purchased amount and booking date.');
      return;
    }
    const rewardPoints = calculateRewardPoints(bookingForm.type, amount);
    const booking = {
      id: `GAC-${customer.phone.slice(-4)}-${Date.now().toString().slice(-6)}`,
      type: bookingForm.type,
      amount,
      date: bookingForm.date,
      rewardPoints,
    };
    const bookingItems = [...customer.bookingItems, booking];
    onChange({ ...customer, bookingItems, bookings: bookingItems.length, points: customer.points + rewardPoints });
    setBookingForm(current => ({ ...current, amount: '' }));
    setFeedback(`Booking added and ${rewardPoints.toLocaleString('en-IN')} reward points credited.`);
  };
  const deleteBooking = booking => {
    const bookingItems = customer.bookingItems.filter(item => item.id !== booking.id);
    onChange({ ...customer, bookingItems, bookings: bookingItems.length, points: Math.max(0, customer.points - booking.rewardPoints) });
    setConfirmDeleteId(null);
    setFeedback(booking.rewardPoints ? `Booking deleted and ${booking.rewardPoints.toLocaleString('en-IN')} linked points removed.` : 'Booking deleted successfully.');
  };
  const adjustPoints = direction => {
    const amount = Math.floor(Math.max(0, Number(rewardAmount) || 0));
    if (!amount) {
      setFeedback('Enter a valid reward-points value.');
      return;
    }
    if (direction === 'remove' && amount > customer.points) {
      setFeedback('Points to remove cannot exceed the available balance.');
      return;
    }
    const points = direction === 'add' ? customer.points + amount : customer.points - amount;
    onChange({ ...customer, points });
    setRewardAmount('');
    setFeedback(`${amount.toLocaleString('en-IN')} points ${direction === 'add' ? 'added' : 'removed'} successfully.`);
  };

  return <div className="admin-modal-backdrop" onClick={onClose}><section className="admin-customer-modal admin-customer-manager" onClick={event => event.stopPropagation()} aria-modal="true" role="dialog" aria-labelledby="customer-detail-title">
    <button className="admin-modal-close" onClick={onClose} aria-label="Close customer management"><X size={19}/></button>
    <header className="admin-customer-manager-header"><i><User size={24}/></i><div><h2 id="customer-detail-title">{customer.name}</h2><p>{customer.email}</p><span>+91 {customer.phone}</span></div></header>
    <div className="admin-customer-stats"><div><small>TOTAL BOOKINGS</small><strong>{customer.bookings}</strong></div><div><small>AVAILABLE POINTS</small><strong>{customer.points.toLocaleString('en-IN')} <em>PTS</em></strong></div></div>
    <nav className="admin-manager-tabs" aria-label="Customer management"><button type="button" className={activeTab === 'bookings' ? 'active' : ''} onClick={() => { setActiveTab('bookings'); setFeedback(''); }}><Calendar size={17}/>Bookings</button><button type="button" className={activeTab === 'rewards' ? 'active' : ''} onClick={() => { setActiveTab('rewards'); setFeedback(''); }}><Award size={17}/>Reward Points</button></nav>
    {activeTab === 'bookings' ? <div className="admin-manager-panel"><form className="admin-add-booking" onSubmit={addBooking}><label>Booking Type<select name="type" value={bookingForm.type} onChange={updateBookingForm}><option>Flights</option><option>Hotels</option><option>Holidays</option></select></label><label>Booking Date<input name="date" type="date" value={bookingForm.date} onChange={updateBookingForm}/></label><label>Purchased Amount (₹)<input name="amount" type="number" min="1" value={bookingForm.amount} onChange={updateBookingForm} placeholder="Enter amount"/></label><button type="submit"><Plus size={17}/>Add Booking</button></form><div className="admin-booking-list"><div className="admin-booking-list-title"><h3>Existing Bookings</h3><span>{customer.bookings} total</span></div>{customer.bookingItems.length ? customer.bookingItems.map(booking => <article className="admin-booking-item" key={booking.id}><div><strong>{booking.type}</strong><small>{booking.id} · {booking.date}</small></div><div className="admin-booking-values"><strong>₹{booking.amount.toLocaleString('en-IN')}</strong>{booking.rewardPoints > 0 && <small>+{booking.rewardPoints.toLocaleString('en-IN')} PTS</small>}</div>{confirmDeleteId === booking.id ? <div className="admin-delete-confirm"><button type="button" onClick={() => deleteBooking(booking)}>Confirm</button><button type="button" onClick={() => setConfirmDeleteId(null)}>Cancel</button></div> : <button type="button" className="admin-delete-booking" onClick={() => setConfirmDeleteId(booking.id)} aria-label={`Delete ${booking.id}`}><Trash2 size={16}/></button>}</article>) : <div className="admin-no-bookings"><Calendar size={22}/><span>No bookings for this customer.</span></div>}</div></div> : <div className="admin-manager-panel admin-reward-manager"><div className="admin-reward-balance"><i><Award size={23}/></i><div><small>AVAILABLE REWARD POINTS</small><strong>{customer.points.toLocaleString('en-IN')} <em>PTS</em></strong></div></div><label>Points to adjust<input type="number" min="1" value={rewardAmount} onChange={event => setRewardAmount(event.target.value)} placeholder="Enter points"/></label><div className="admin-reward-actions"><button type="button" className="add" onClick={() => adjustPoints('add')}><Plus size={17}/>Add Points</button><button type="button" className="remove" onClick={() => adjustPoints('remove')}><Minus size={17}/>Remove Points</button></div><p>Every adjustment updates this customer’s available balance immediately.</p></div>}
    {feedback && <div className="admin-manager-feedback" role="status">{feedback}</div>}
  </section></div>;
}

function AdminCustomersPanel({ customers, latest = false, searchable = false, onViewAll, onSelect }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCustomers = customers.filter(customer => [customer.name, customer.phone, customer.email].some(value => value.toLowerCase().includes(normalizedQuery)));
  return <section className={`admin-customers-card ${latest ? 'latest' : 'all-customers'}`}>
    <header><i><Users size={20}/></i><div><h2>{latest ? 'Latest Customers' : 'Manage Customers'}</h2><p>{latest ? 'The five most recently registered customers.' : 'Search and view customer details.'}</p></div></header>
    {searchable && <label className="admin-search"><Search size={19}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name, email or phone..." aria-label="Search customers"/></label>}
    <div className="admin-table" role="table" aria-label="Customers"><div className="admin-table-head" role="row"><span>Customer Name</span><span>Phone Number</span><span>Bookings</span><span/></div>{visibleCustomers.map(customer => <button className="admin-table-row" role="row" key={customer.phone} onClick={() => onSelect(customer)}><span>{customer.name}</span><span>{customer.phone}</span><span>{customer.bookings}</span><ChevronRight size={18}/></button>)}{!visibleCustomers.length && <div className="admin-empty"><Search size={22}/><span>No customers match “{query}”.</span></div>}</div>
    {latest && <div className="admin-view-all"><button onClick={onViewAll}>View All Customers</button></div>}
  </section>;
}

function AdminRegisterPanel({ customers, onRegister, onExistingCustomer }) {
  const emptyForm = { name: '', email: '', phone: '', type: 'Holidays', amount: '' };
  const [form, setForm] = useState(emptyForm);
  const [points, setPoints] = useState(0);
  const [message, setMessage] = useState('');
  const [existingCustomer, setExistingCustomer] = useState(null);
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const calculate = () => {
    const amount = Math.max(0, Number(form.amount) || 0);
    const earned = calculateRewardPoints(form.type, amount);
    setPoints(earned);
    setMessage(`This booking earns ${earned.toLocaleString('en-IN')} points.`);
    return earned;
  };
  const submit = event => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !/^\d{10}$/.test(form.phone)) {
      setExistingCustomer(null);
      setMessage('Enter a name, email address and valid 10-digit phone number.');
      return;
    }
    const duplicateCustomer = customers.find(customer => customer.phone === form.phone);
    if (duplicateCustomer) {
      setExistingCustomer(duplicateCustomer);
      setMessage('This mobile number is already registered.');
      return;
    }
    const earned = calculate();
    const firstBooking = { id: `GAC-${form.phone.slice(-4)}-${Date.now().toString().slice(-6)}`, type: form.type, amount: Number(form.amount) || 0, date: new Date().toISOString().slice(0, 10), rewardPoints: earned };
    onRegister({ name: form.name.trim(), email: form.email.trim(), phone: form.phone, bookings: 1, points: earned, bookingItems: [firstBooking] });
    setForm(emptyForm);
    setPoints(0);
    setExistingCustomer(null);
    setMessage(`${form.name.trim()} was registered successfully.`);
  };
  return <section className="admin-form-card admin-register-card"><header><i><UserRound size={21}/></i><div><h2>Register a Customer</h2><p>Enter customer and booking details.</p></div></header><form onSubmit={submit}>
    <div className="admin-form-grid"><label>Customer Name<input name="name" value={form.name} onChange={update} placeholder="Enter full name"/></label><label>Email Address<input name="email" type="email" value={form.email} onChange={update} placeholder="Enter email address"/></label><label>Mobile Number<input name="phone" inputMode="numeric" maxLength="10" value={form.phone} onChange={event => { setExistingCustomer(null); setForm(current => ({ ...current, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })); }} placeholder="Enter unique mobile number"/></label><label>Booking Type<select name="type" value={form.type} onChange={update}><option>Flights</option><option>Hotels</option><option>Holidays</option></select></label><label>Purchased Amount (₹)<input name="amount" type="number" min="0" value={form.amount} onChange={update} placeholder="Enter amount"/></label></div>
    <div className="admin-form-actions"><button type="button" className="admin-secondary-action" onClick={calculate}><CircleDollarSign size={18}/>Calculate Reward Points</button><button type="submit" className="admin-primary-action"><UserRound size={18}/>Register Customer</button></div>
    {(message || points > 0) && (existingCustomer ? <div className="admin-existing-customer" role="alert"><AlertCircle size={19}/><div><strong>User already exists</strong><span>{message} Manage the existing customer instead.</span></div><button type="button" onClick={() => onExistingCustomer(existingCustomer)}>Manage Customer<ChevronRight size={16}/></button></div> : <p className="admin-form-message" role="status">{message}</p>)}
  </form></section>;
}

function AdminReportPanel({ customers }) {
  const [form, setForm] = useState({ type: 'All bookings', start: '', end: '' });
  const [report, setReport] = useState(null);
  const update = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const generate = event => {
    event.preventDefault();
    setReport({
      customers: customers.length,
      bookings: customers.reduce((sum, customer) => sum + customer.bookings, 0),
      type: form.type,
      range: form.start && form.end ? `${form.start} to ${form.end}` : 'All dates',
      generatedAt: new Date().toLocaleString('en-IN'),
      rows: customers,
    });
  };
  const downloadExcel = () => {
    if (!report) return;
    const escapeCell = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const customerRows = report.rows.map(customer => `<tr><td>${escapeCell(customer.name)}</td><td>${escapeCell(customer.email)}</td><td>${escapeCell(customer.phone)}</td><td>${customer.bookings}</td><td>${escapeCell(customer.points)}</td></tr>`).join('');
    const workbook = `<!doctype html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif}h1{color:#001735}table{border-collapse:collapse;width:100%}th{background:#001735;color:#fff}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}.meta td:first-child{font-weight:bold;background:#f8fafc}</style></head><body><h1>GAC Holidays Customer Report</h1><table class="meta"><tr><td>Booking type</td><td>${escapeCell(report.type)}</td></tr><tr><td>Date range</td><td>${escapeCell(report.range)}</td></tr><tr><td>Generated</td><td>${escapeCell(report.generatedAt)}</td></tr><tr><td>Total customers</td><td>${report.customers}</td></tr><tr><td>Total bookings</td><td>${report.bookings}</td></tr></table><br><table><thead><tr><th>Customer Name</th><th>Email Address</th><th>Phone Number</th><th>Bookings</th><th>Points Balance</th></tr></thead><tbody>${customerRows}</tbody></table></body></html>`;
    const blob = new Blob(['\ufeff', workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gac-customer-report-${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  return <section className="admin-form-card admin-report-card"><header><i><Briefcase size={21}/></i><div><h2>Generate Report</h2><p>Choose filters to prepare a booking summary.</p></div></header><form onSubmit={generate}>
    <div className="admin-form-grid admin-report-filters"><label>Booking Type<select name="type" value={form.type} onChange={update}><option>All bookings</option><option>Flights</option><option>Hotels</option><option>Holidays</option></select></label><label>Start Date<input name="start" type="date" value={form.start} onChange={update}/></label><label>End Date<input name="end" type="date" value={form.end} onChange={update}/></label></div>
    <div className="admin-form-actions"><button type="submit" className="admin-primary-action"><Briefcase size={18}/>Generate Report</button></div>
  </form>{report && <section className="admin-report-preview" aria-label="Report preview"><header><div><h3>Report Preview</h3><p>Generated {report.generatedAt}</p></div><button type="button" onClick={downloadExcel}><Download size={17}/>Download Excel</button></header><div className="admin-report-result"><div><small>CUSTOMERS</small><strong>{report.customers}</strong></div><div><small>BOOKINGS</small><strong>{report.bookings}</strong></div><div><small>TYPE</small><strong>{report.type}</strong></div><div><small>DATE RANGE</small><strong>{report.range}</strong></div></div><div className="admin-report-table-wrap"><table className="admin-report-table"><thead><tr><th>Customer</th><th>Phone</th><th>Bookings</th><th>Points</th></tr></thead><tbody>{report.rows.map(customer => <tr key={customer.phone}><td><strong>{customer.name}</strong><small>{customer.email}</small></td><td>{customer.phone}</td><td>{customer.bookings}</td><td>{customer.points}</td></tr>)}</tbody></table></div></section>}</section>;
}

function FixedPhoneInput({ id, value, onChange }) { return <div className="fixed-phone"><span>+91</span><input id={id} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="Enter your mobile number" value={value} onChange={onChange}/></div>; }

function Feature({ icon: Icon, title, text }) { return <div className="feature-item"><div className="feature-icon-badge"><Icon size={16}/></div><h3 className="feature-title">{title}</h3><p className="feature-desc">{text}</p></div>; }

function App() {
  return window.location.pathname.replace(/\/+$/, '') === '/admin' ? <AdminPortal/> : <CustomerApp/>;
}

export default App;
