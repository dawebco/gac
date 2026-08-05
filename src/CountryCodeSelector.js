import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export const COUNTRIES = [
  { code: '+91',  flag: '🇮🇳', name: 'India',              iso: 'IN' },
  { code: '+1',   flag: '🇺🇸', name: 'United States',      iso: 'US' },
  { code: '+44',  flag: '🇬🇧', name: 'United Kingdom',     iso: 'GB' },
  { code: '+971', flag: '🇦🇪', name: 'United Arab Emirates', iso: 'AE' },
  { code: '+1',   flag: '🇨🇦', name: 'Canada',             iso: 'CA' },
  { code: '+61',  flag: '🇦🇺', name: 'Australia',          iso: 'AU' },
  { code: '+65',  flag: '🇸🇬', name: 'Singapore',          iso: 'SG' },
  { code: '+49',  flag: '🇩🇪', name: 'Germany',            iso: 'DE' },
  { code: '+33',  flag: '🇫🇷', name: 'France',             iso: 'FR' },
  { code: '+81',  flag: '🇯🇵', name: 'Japan',              iso: 'JP' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia',       iso: 'SA' },
  { code: '+974', flag: '🇶🇦', name: 'Qatar',              iso: 'QA' },
  { code: '+968', flag: '🇴🇲', name: 'Oman',               iso: 'OM' },
  { code: '+965', flag: '🇰🇼', name: 'Kuwait',             iso: 'KW' },
  { code: '+973', flag: '🇧🇭', name: 'Bahrain',            iso: 'BH' },
  { code: '+60',  flag: '🇲🇾', name: 'Malaysia',           iso: 'MY' },
  { code: '+64',  flag: '🇳🇿', name: 'New Zealand',        iso: 'NZ' },
  { code: '+27',  flag: '🇿🇦', name: 'South Africa',       iso: 'ZA' },
  { code: '+82',  flag: '🇰🇷', name: 'South Korea',        iso: 'KR' },
  { code: '+39',  flag: '🇮🇹', name: 'Italy',              iso: 'IT' },
  { code: '+34',  flag: '🇪🇸', name: 'Spain',              iso: 'ES' },
  { code: '+55',  flag: '🇧🇷', name: 'Brazil',             iso: 'BR' },
  { code: '+86',  flag: '🇨🇳', name: 'China',              iso: 'CN' },
  { code: '+7',   flag: '🇷🇺', name: 'Russia',             iso: 'RU' },
  { code: '+31',  flag: '🇳🇱', name: 'Netherlands',        iso: 'NL' },
  { code: '+41',  flag: '🇨🇭', name: 'Switzerland',        iso: 'CH' },
  { code: '+46',  flag: '🇸🇪', name: 'Sweden',             iso: 'SE' },
  { code: '+62',  flag: '🇮🇩', name: 'Indonesia',          iso: 'ID' },
  { code: '+63',  flag: '🇵🇭', name: 'Philippines',        iso: 'PH' },
  { code: '+92',  flag: '🇵🇰', name: 'Pakistan',           iso: 'PK' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh',         iso: 'BD' },
  { code: '+94',  flag: '🇱🇰', name: 'Sri Lanka',          iso: 'LK' },
  { code: '+977', flag: '🇳🇵', name: 'Nepal',              iso: 'NP' },
  { code: '+20',  flag: '🇪🇬', name: 'Egypt',              iso: 'EG' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria',            iso: 'NG' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya',              iso: 'KE' },
  { code: '+52',  flag: '🇲🇽', name: 'Mexico',             iso: 'MX' },
  { code: '+54',  flag: '🇦🇷', name: 'Argentina',          iso: 'AR' },
  { code: '+48',  flag: '🇵🇱', name: 'Poland',             iso: 'PL' },
  { code: '+32',  flag: '🇧🇪', name: 'Belgium',            iso: 'BE' },
];

function CountryCodeSelector({ value, onChange, theme = 'dark' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  const selectedCountry = COUNTRIES.find(
    (c) => c.code === value.code && c.iso === value.iso
  ) || COUNTRIES[0];

  const filtered = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.includes(search)
  );

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search when opened
  useEffect(() => {
    if (isOpen && searchRef.current) {
      setTimeout(() => searchRef.current.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (country) => {
    onChange(country);
    setIsOpen(false);
    setSearch('');
  };

  const isLight = theme === 'light';

  return (
    <div className="country-selector-root" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className={`country-trigger ${isLight ? 'light' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="country-flag">{selectedCountry.flag}</span>
        <span className="country-code-text">{selectedCountry.code}</span>
        <ChevronDown
          size={13}
          className={`country-chevron ${isOpen ? 'open' : ''}`}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className={`country-dropdown ${isLight ? 'light' : ''}`} role="listbox">
          {/* Search */}
          <div className={`country-search-wrapper ${isLight ? 'light' : ''}`}>
            <Search size={14} className="country-search-icon" />
            <input
              ref={searchRef}
              type="text"
              className={`country-search-input ${isLight ? 'light' : ''}`}
              placeholder="Search country..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Country List */}
          <ul className="country-list">
            {filtered.length > 0 ? filtered.map((country, idx) => (
              <li
                key={`${country.iso}-${idx}`}
                className={`country-option ${
                  country.iso === selectedCountry.iso && country.code === selectedCountry.code
                    ? 'selected'
                    : ''
                } ${isLight ? 'light' : ''}`}
                onClick={() => handleSelect(country)}
                role="option"
                aria-selected={country.iso === selectedCountry.iso}
              >
                <span className="opt-flag">{country.flag}</span>
                <span className="opt-name">{country.name}</span>
                <span className="opt-code">{country.code}</span>
              </li>
            )) : (
              <li className="country-option-empty">No results found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default CountryCodeSelector;
