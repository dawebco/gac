import React, { useState, useRef } from 'react';
import { User, Calendar, Lock, Star, Gift, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import CountryCodeSelector from './CountryCodeSelector';
import heroBg from './assets/image.png';
import logoImg from './assets/logo-3.png';

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
                    <CountryCodeSelector />
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
                      <CountryCodeSelector />
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
