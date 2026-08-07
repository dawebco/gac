import React, { useState, useRef } from 'react';
import { User, Calendar, Lock, Star, Gift, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import heroBg from './assets/image.png';
import logoImg from './assets/logo-3.png';


// Landing Page Component
function LandingPage() {
  return (
    <div className="gac-holidays">
      <div className="sidebar">
        <div className="logo-group">
          <div className="logo-main">
            <div className="text-wrapper">GAC</div>
            <div className="div">Holidays</div>
          </div>
          <div className="text-wrapper-2">POINTS SYSTEM</div>
        </div>
        <div className="nav-list">
          <div className="nav-item-dashboard">
            <div className="vector-wrapper">
              <img className="vector" src="img/vector-7.svg" alt="" />
            </div>
            <div className="text-wrapper-3">Dashboard</div>
          </div>
          <div className="div-2">
            <div className="vector-wrapper">
              <img className="vector" src="img/vector-17.svg" alt="" />
            </div>
            <div className="text-wrapper-4">Purchase History</div>
          </div>
          <div className="div-2">
            <div className="vector-wrapper">
              <img className="img" src="img/vector-5.svg" alt="" />
            </div>
            <div className="text-wrapper-4">Rewards</div>
          </div>
          <div className="div-2">
            <div className="vector-wrapper">
              <img className="vector-2" src="img/vector-4.svg" alt="" />
            </div>
            <div className="text-wrapper-4">Earn Points</div>
          </div>
          <div className="div-2">
            <div className="vector-wrapper">
              <img className="vector-3" src="img/vector-12.svg" alt="" />
            </div>
            <div className="text-wrapper-4">Profile</div>
          </div>
          <div className="div-2">
            <div className="vector-wrapper">
              <img className="vector" src="img/vector-8.svg" alt="" />
            </div>
            <div className="text-wrapper-4">Logout</div>
          </div>
        </div>
        <div className="spacer" />
        <div className="sidebar-promo">
          <div className="promo-content">
            <div className="explore-more-earn">Explore More.<br/>Earn More.</div>
            <p className="p">More journeys, more memories, more points.</p>
          </div>
          <div className="promo-button-row">
            <div className="circular-arrow">
              <div className="img-wrapper">
                <img className="vector-4" src="img/vector-9.svg" alt="" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="main-content">
        <div className="div-3">
          <div className="welcome-text-group">
            <div className="text-wrapper-5">Welcome Back, Numa!</div>
            <p className="text-wrapper-6">Track your points, explore rewards and continue your journey with GAC Holidays.</p>
          </div>
          <div className="div-4">
            <div className="text-wrapper-7">Hello, Numa</div>
            <img className="user-avatar" src="img/user-avatar.png" alt="User Avatar" />
          </div>
        </div>
        <div className="points-summary-row">
          <div className="featured-points-card">
            <div className="div-3">
              <div className="total-points">TOTAL POINTS</div>
              <div className="vector-wrapper">
                <img className="vector-2" src="img/vector-2.svg" alt="" />
              </div>
            </div>
            <div className="big-pts">
              <div className="text-wrapper-8">650</div>
              <div className="text-wrapper-9">PTS</div>
            </div>
            <div className="featured-sub-details">
              <div className="frame">
                <div className="text-wrapper-10">Available Points</div>
                <div className="text-wrapper-11">650 PTS</div>
              </div>
              <div className="frame">
                <div className="text-wrapper-10">Total Earned</div>
                <div className="text-wrapper-11">1,250 PTS</div>
              </div>
              <div className="frame">
                <div className="text-wrapper-10">Total Redeemed</div>
                <div className="text-wrapper-11">600 PTS</div>
              </div>
            </div>
          </div>
          <div className="small-cards-grid">
            <div className="div-5">
              <div className="div-3">
                <div className="text-wrapper-12">TOTAL BOOKINGS</div>
                <div className="icon-container">
                  <div className="vector-wrapper-2">
                    <img className="vector-5" src="img/vector-13.svg" alt="" />
                  </div>
                </div>
              </div>
              <div className="text-wrapper-13">6</div>
              <div className="view-all-link">
                <div className="text-wrapper-14">View all bookings</div>
                <div className="arrow-right">
                  <img className="vector-6" src="img/vector-3.svg" alt="" />
                </div>
              </div>
            </div>
            <div className="div-5">
              <div className="div-3">
                <div className="text-wrapper-12">POINTS EARNED</div>
                <div className="icon-container">
                  <div className="vector-wrapper-2">
                    <img className="vector-7" src="img/vector-10.svg" alt="" />
                  </div>
                </div>
              </div>
              <div className="text-wrapper-13">1,250</div>
              <div className="text-wrapper-15">All time</div>
            </div>
            <div className="div-5">
              <div className="div-3">
                <div className="text-wrapper-12">POINTS REDEEMED</div>
                <div className="icon-container">
                  <div className="vector-wrapper-2">
                    <img className="vector-8" src="img/vector-6.svg" alt="" />
                  </div>
                </div>
              </div>
              <div className="text-wrapper-13">600</div>
              <div className="text-wrapper-15">All time</div>
            </div>
            <div className="div-5">
              <div className="div-3">
                <div className="text-wrapper-12">POINTS EXPIRING</div>
                <div className="icon-container">
                  <div className="clock" />
                </div>
              </div>
              <div className="text-wrapper-13">120</div>
              <div className="text-wrapper-15">On 31 Dec 2026</div>
            </div>
          </div>
        </div>
        <div className="bottom-split-row">
          <div className="purchase-history">
            <div className="div-3">
              <div className="text-wrapper-16">Recent Purchase History</div>
              <div className="text-wrapper-17">View All</div>
            </div>
            <div className="div-6">
              <div className="table-head">
                <div className="date">DATE</div>
                <div className="description">DESCRIPTION</div>
                <div className="text-wrapper-18">AMOUNT</div>
                <div className="text-wrapper-18">PTS EARNED</div>
              </div>
              <div className="row">
                <div className="text-wrapper-19">12 Jan 2026</div>
                <div className="text-wrapper-20">Goa Family Holiday Package</div>
                <div className="text-wrapper-21">₹45,000</div>
                <div className="text-wrapper-22">450</div>
              </div>
              <div className="row">
                <div className="text-wrapper-19">25 Feb 2026</div>
                <div className="text-wrapper-20">Hampi Group Tour</div>
                <div className="text-wrapper-21">�₹12,500</div>
                <div className="text-wrapper-22">125</div>
              </div>
              <div className="row">
                <div className="text-wrapper-19">10 Mar 2026</div>
                <div className="text-wrapper-20">Kerala Backwaters</div>
                <div className="text-wrapper-21">�₹32,000</div>
                <div className="text-wrapper-22">320</div>
              </div>
              <div className="row-2">
                <div className="text-wrapper-23">05 Apr 2026</div>
                <div className="text-wrapper-24">Rajasthan Heritage Tour</div>
                <div className="text-wrapper-25">�₹28,000</div>
                <div className="text-wrapper-26">280</div>
              </div>
            </div>
            <div className="table-footer-note">
              <div className="info" />
              <p className="text-wrapper-27">Points are credited after the completion of the trip.</p>
            </div>
          </div>
          <div className="available-rewards">
            <div className="div-3">
              <div className="text-wrapper-16">Available Rewards</div>
              <div className="text-wrapper-17">View All</div>
            </div>
            <div className="div-6">
              <div className="reward-row-item">
                <img className="reward-thumb" src="img/reward-thumb-2.png" alt="Reward Thumb" />
                <div className="reward-details">
                  <div className="text-wrapper-28">Beach Resort Voucher</div>
                  <p className="text-wrapper-29">�₹500 off on select beach resorts</p>
                </div>
                <div className="div-4">
                  <div className="points-button">
                    <div className="text-wrapper-30">500 PTS</div>
                  </div>
                </div>
                <div className="img-wrapper">
                  <img className="vector-9" src="img/vector-11.svg" alt="" />
                </div>
              </div>
              <div className="reward-row-item">
                <img className="reward-thumb" src="img/image.png" alt="Reward Thumb" />
                <div className="reward-details">
                  <div className="text-wrapper-28">Free Travel Accessories Kit</div>
                  <p className="text-wrapper-29">Premium luggage and travel accessories</p>
                </div>
                <div className="div-4">
                  <div className="points-button">
                    <div className="text-wrapper-30">750 PTS</div>
                  </div>
                </div>
                <div className="img-wrapper">
                  <img className="vector-9" src="img/image.svg" alt="" />
                </div>
              </div>
              <div className="reward-row-item-2">
                <img className="reward-thumb" src="img/reward-thumb.png" alt="Reward Thumb" />
                <div className="reward-details">
                  <p className="text-wrapper-28">�₹1000 off on International Packages</p>
                  <div className="text-wrapper-29">Exciting adventure sports experience</div>
                </div>
                <div className="div-4">
                  <div className="points-button">
                    <div className="text-wrapper-30">1000 PTS</div>
                  </div>
                </div>
                <div className="img-wrapper">
                  <img className="vector-9" src="img/vector-14.svg" alt="" />
                </div>
              </div>
            </div>
            <div className="rewards-footer">
              <div className="img-wrapper">
                <img className="vector-10" src="img/vector.svg" alt="" />
              </div>
              <p className="text-wrapper-31">More rewards. More journeys. More memories.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [formMode, setFormMode] = useState('register');

  // Registration Form State
  const [regFullName, setRegFullName] = useState('');
  const [regPhone, setRegPhone] = useState('');          // stores full number incl. dial code
  const [regCountryData, setRegCountryData] = useState({}); // metadata from library
  const [regDob, setRegDob] = useState('');
  const dateInputRef = useRef(null);

  // Login Form State
  const [loginPhone, setLoginPhone] = useState('');
  const [loginCountryData, setLoginCountryData] = useState({});
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState(['', '', '', '']);

  // Validation Error States
  const [regMobileError, setRegMobileError] = useState('');
  const [regDobError, setRegDobError] = useState('');
  const [loginMobileError, setLoginMobileError] = useState('');

  // Toast State
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  // Landing page state
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // ──────────────────────────────────────────────
  // Validation helpers
  // ──────────────────────────────────────────────
  const validatePhone = (fullPhone, dialCode, countryMeta) => {
    const code = dialCode || '91';
    if (!fullPhone || fullPhone.trim() === code) {
      return 'Mobile number is required.';
    }
    // Strip dial code to get subscriber number (value may or may not include it)
    let subscriber = fullPhone.replace(/\D/g, '');
    if (subscriber.startsWith(code)) {
      subscriber = subscriber.slice(code.length);
    }

    // India-specific rules
    if (code === '91') {
      if (
        subscriber.length !== 10 ||
        !/^[6-9]/.test(subscriber) ||
        /^(\d)\1{9}$/.test(subscriber) ||
        ['1234567890', '9876543210'].includes(subscriber)
      ) {
        return 'Invalid mobile number format.';
      }
    } else {
      // Generic: 5–15 digits, not all-same
      if (subscriber.length < 5 || /^(\d)\1+$/.test(subscriber)) {
        return 'Invalid mobile number format.';
      }
    }
    return '';
  };

  const validateDob = (dobString) => {
    if (!dobString) return 'Please select your date of birth.';
    const birth = new Date(dobString);
    const now = new Date();
    if (isNaN(birth.getTime())) return 'Invalid date of birth format.';
    if (birth > now) return 'Date of birth cannot be in the future.';

    const diffMonths =
      (now.getFullYear() - birth.getFullYear()) * 12 +
      (now.getMonth() - birth.getMonth()) +
      (now.getDate() - birth.getDate() < 0 ? -0.5 : 0);
    if (diffMonths < 6) return 'Date of birth must be at least 6 months in the past.';

    let age = now.getFullYear() - birth.getFullYear();
    const md = now.getMonth() - birth.getMonth();
    if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age--;
    if (age > 120) return 'Date of birth cannot exceed 120 years.';

    return '';
  };

  // ──────────────────────────────────────────────
  // Submit handlers
  // ──────────────────────────────────────────────
  const handleCalendarClick = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === 'function') {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current.focus();
      }
    }
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setRegMobileError('');
    setRegDobError('');

    if (!regFullName || regFullName.trim().length < 2) {
      showToast('Please enter your full name.', 'error');
      return;
    }

    const mErr = validatePhone(regPhone, regCountryData.dialCode, regCountryData);
    if (mErr) { setRegMobileError(mErr); showToast(mErr, 'error'); return; }

    const dErr = validateDob(regDob);
    if (dErr) { setRegDobError(dErr); showToast(dErr, 'error'); return; }

    showToast('Registration successful! Welcome to GAC Holidays Rewards.', 'success');
  };

  const handleSendOTP = (e) => {
    e.preventDefault();
    setLoginMobileError('');

    const mErr = validatePhone(loginPhone, loginCountryData.dialCode, loginCountryData);
    if (mErr) { setLoginMobileError(mErr); showToast(mErr, 'error'); return; }

    setOtpSent(true);
    const display = `+${loginCountryData.dialCode || '91'}${loginPhone}`;
    showToast(`OTP sent to ${display}`, 'success');
  };

  const handleVerifyOTP = (e) => {
    e.preventDefault();
    if (otpCode.join('').length < 4) {
      showToast('Please enter the complete 4-digit OTP.', 'error');
      return;
    }
    showToast('OTP verified! Welcome back.', 'success');
    // Set logged in state to show landing page
    setIsLoggedIn(true);
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) value = value.slice(-1);
    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);
    if (value && index < 3) {
      const next = document.getElementById(`otp-input-${index + 1}`);
      if (next) next.focus();
    }
  };

  const switchMode = (mode) => {
    setFormMode(mode);
    setOtpSent(false);
    setOtpCode(['', '', '', '']);
    setRegMobileError('');
    setRegDobError('');
    setLoginMobileError('');
  };

  return (
    <div className="app-container">
      {/* Toast */}
      {toastMessage && (
        <div className={`toast-notification ${toastType}`}>
          {toastType === 'error'
            ? <AlertCircle size={18} color="#EF4444" />
            : <CheckCircle2 size={18} color="#F4E04D" />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Left Hero Panel ── */}
      <div className="hero-panel" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="hero-overlay" />

        <div className="hero-content-top">
          <div className="brand-header">
            <img src={logoImg} alt="GAC Holidays" className="brand-logo" />
            <span className="brand-subtitle">POINTS SYSTEM</span>
          </div>
        </div>

        <div className="hero-content-middle">
          <div className="hero-copy">
            <h1 className="hero-title hero-title-playfair">
              Your Points,<br />
              Endless <span className="highlight-yellow">Journeys</span>
            </h1>
            <p className="hero-description hero-description-playfair">
              Login to access your rewards, track points and unlock exciting travel experiences.
            </p>
          </div>
        </div>

        <div className="hero-content-bottom">
          <div className="features-grid">
            <div className="feature-item">
              <div className="feature-icon-badge"><Star size={16} strokeWidth={2.2} color="#F4E04D" /></div>
              <h3 className="feature-title">Earn Points</h3>
              <p className="feature-desc">Every booking earns you more.</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon-badge"><Gift size={16} strokeWidth={2.2} color="#F4E04D" /></div>
              <h3 className="feature-title">Get Rewards</h3>
              <p className="feature-desc">Redeem points for amazing benefits.</p>
            </div>
            <div className="feature-item">
              <div className="feature-icon-badge"><MapPin size={16} strokeWidth={2.2} color="#F4E04D" /></div>
              <h3 className="feature-title">Explore More</h3>
              <p className="feature-desc">More destinations, more memories.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Auth Panel ── */}
      <div className="form-panel">

        {formMode === 'register' ? (
          /* ════════════ REGISTER FORM ════════════ */
          <div className="card-wrapper">
            <div className="register-card">

              {/* Header */}
              <div className="card-header light">
                <h2 className="card-title light">Create Your Account</h2>
                <p className="card-subtitle light">Join GAC Holidays Rewards and start earning!</p>
              </div>

              <form onSubmit={handleRegisterSubmit} noValidate>

                {/* ── Full Name ── */}
                <div className="form-group">
                  <label className="form-label light" htmlFor="reg-fullname">Full Name</label>
                  <div className="input-wrapper name-field">
                    <User className="input-icon" size={18} />
                    <input
                      id="reg-fullname"
                      type="text"
                      className="form-input name-input"
                      placeholder="Enter your full name"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                    />
                  </div>
                </div>

                {/* ── Mobile Number (react-phone-input-2, Dark theme) ── */}
                <div className="form-group">
                  <label className="form-label light" htmlFor="reg-phone">Mobile Number</label>
<div className="rpi-prefix-wrapper">
                    <span className="rpi-static-prefix">+91</span>
                    <span className="rpi-prefix-divider"></span>
                    <PhoneInput
                      country="in"
                      value={regPhone}
                      onChange={(phone, data) => {
                        setRegPhone(phone);
                        setRegCountryData(data);
                        setRegMobileError('');
                      }}
                      inputProps={{ id: 'reg-phone', name: 'reg-phone', required: true }}
                      containerClass={`rpi-container dark${regMobileError ? ' rpi-error' : ''}`}
                      inputClass="rpi-input"
                      buttonClass="rpi-btn"
                      onlyCountries={['in']}
                      disableDropdown
                      disableCountryGuess
                      disableCountryCode
                      placeholder="Enter mobile number"
                    />
                  </div>
                  {regMobileError && (
                    <div className="field-error-text light">{regMobileError}</div>
                  )}
                </div>

                {/* ── Date of Birth ── */}
                <div className="form-group">
                  <label className="form-label light" htmlFor="reg-dob">Date of Birth</label>

                  <div className={`input-wrapper date-field ${regDobError ? 'input-error' : ''}`}>
                    <button
                      type="button"
                      className="date-picker-btn"
                      onClick={handleCalendarClick}
                      aria-label="Open date picker"
                    >
                      <Calendar className="input-icon date-icon" size={18} />
                    </button>
                    <span className="input-divider date-divider"></span>
                    <input
                      ref={dateInputRef}
                      id="reg-dob"
                      type="date"
                      className={`form-input date-input ${regDobError ? 'has-error' : ''}`}
                      value={regDob}
                      onChange={(e) => { setRegDob(e.target.value); setRegDobError(''); }}
                    />
                  </div>

                  {regDobError && (
                    <div className="field-error-text light" style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
                      {regDobError}
                    </div>
                  )}
                </div>

                {/* ── Register CTA ── */}
                <button type="submit" className="btn-primary" style={{ marginTop: '1.25rem' }}>
                  Register
                </button>

                {/* ── Divider ── */}
                <div className="divider light">
                  <div className="divider-line light" />
                  <span className="divider-text light">OR</span>
                  <div className="divider-line light" />
                </div>

                {/* ── Toggle to Login ── */}
                <p className="toggle-auth-link light">
                  Already have an account?{' '}
                  <button type="button" className="link-button-blue" onClick={() => switchMode('login')}>
                    Login
                  </button>
                </p>
              </form>
            </div>

            {/* Footer */}
            <div className="security-footer">
              <Lock size={14} className="security-icon" />
              <span>Your information is secure with us.</span>
            </div>
          </div>

        ) : (
          /* ════════════ LOGIN FORM (OTP) ════════════ */
          <div className="card-wrapper">
            <div className="login-card">

              <div className="card-header">
                <h2 className="card-title">
                  Welcome <span className="highlight-yellow">Back!</span>
                </h2>
                <p className="card-subtitle">Login to continue to your account</p>
              </div>

              {!otpSent ? (
                <form onSubmit={handleSendOTP} noValidate>
                  {/* ── Mobile Number (react-phone-input-2, Dark theme) ── */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="login-phone">Mobile Number</label>
<div className="rpi-prefix-wrapper">
                      <span className="rpi-static-prefix">+91</span>
                      <span className="rpi-prefix-divider"></span>
                      <PhoneInput
                        country="in"
                        value={loginPhone}
                        onChange={(phone, data) => {
                          setLoginPhone(phone);
                          setLoginCountryData(data);
                          setLoginMobileError('');
                        }}
                        inputProps={{ id: 'login-phone', name: 'login-phone', required: true }}
                        containerClass={`rpi-container dark${loginMobileError ? ' rpi-error' : ''}`}
                        inputClass="rpi-input"
                        buttonClass="rpi-btn"
                        onlyCountries={['in']}
                        disableDropdown
                        disableCountryGuess
                        disableCountryCode
                        placeholder="Enter mobile number"
                      />
                    </div>
                    {loginMobileError && (
                      <div className="field-error-text">{loginMobileError}</div>
                    )}
                  </div>

                  <button type="submit" className="btn-primary" style={{ marginTop: '1.25rem' }}>
                    Send OTP
                  </button>

                  <div className="divider">
                    <div className="divider-line" />
                    <span className="divider-text">OR</span>
                    <div className="divider-line" />
                  </div>

                  <p className="toggle-auth-link">
                    Don't have an account?{' '}
                    <button type="button" className="link-button-yellow" onClick={() => switchMode('register')}>
                      Register
                    </button>
                  </p>
                </form>

              ) : (
                /* OTP Verification */
                <form onSubmit={handleVerifyOTP}>
                  <div className="otp-sent-banner">
                    OTP sent to +{loginCountryData.dialCode || '91'}{loginPhone}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Enter 4-Digit OTP</label>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '10px' }}>
                      {otpCode.map((digit, idx) => (
                        <input
                          key={idx}
                          id={`otp-input-${idx}`}
                          type="text"
                          maxLength="1"
                          className="form-input otp-box"
                          value={digit}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                        />
                      ))}
                    </div>
                  </div>
                  <button type="submit" className="btn-primary" style={{ marginTop: '1.5rem' }}>
                    Verify & Proceed
                  </button>
                  <div className="otp-actions">
                    <button type="button" className="otp-action-link dim" onClick={() => setOtpSent(false)}>
                      Change Number
                    </button>
                    <button type="button" className="otp-action-link yellow" onClick={handleSendOTP}>
                      Resend OTP
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="security-footer">
              <Lock size={14} className="security-icon" />
              <span>Secure login powered by GAC Holidays</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
