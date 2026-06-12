import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function FilterDropdown({ filterExt, setFilterExt }) {
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
    { value: 'all', label: 'All Types' },
    { value: 'stl', label: '.STL' },
    { value: 'obj', label: '.OBJ' },
    { value: '3dm', label: '.3DM' }
  ];

  const selectedOption = options.find(o => o.value === filterExt) || options[0];

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          background: 'var(--surface-color)',
          color: 'var(--text-main)',
          cursor: 'pointer',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          userSelect: 'none'
        }}
      >
        {selectedOption.label} <ChevronDown size={14} />
      </div>
      
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
                setFilterExt(opt.value);
                setIsOpen(false);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: filterExt === opt.value ? 'var(--accent-color)' : 'transparent',
                color: filterExt === opt.value ? 'var(--bg-color)' : 'var(--text-main)',
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
