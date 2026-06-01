import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function ThemeDropdown({ themeStyle, setThemeStyle }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options = [
    { value: 'modern', label: 'Modern' },
    { value: 'cartoon', label: 'Cartoonish' },
    { value: 'barbie', label: 'Barbie' },
    { value: 'gta', label: 'GTA' },
    { value: 'ghibli', label: 'Ghibli' },
    { value: 'retro', label: 'Retro' },
    { value: '95', label: 'Windows 95' }
  ];

  const selectedOption = options.find(o => o.value === themeStyle) || options[0];

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-main)',
          padding: '4px 8px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        {selectedOption.label} <ChevronDown size={14} />
      </button>
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: '0',
          marginTop: '8px',
          background: 'var(--surface-color)',
          border: '2px solid var(--border-color)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-md)',
          width: '140px',
          zIndex: 1000,
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          {options.map(opt => (
            <div 
              key={opt.value}
              onClick={() => {
                setThemeStyle(opt.value);
                setIsOpen(false);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: themeStyle === opt.value ? 'var(--accent-color)' : 'transparent',
                color: themeStyle === opt.value ? '#fff' : 'var(--text-main)',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
