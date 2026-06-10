import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, Copy, Trash2, ArrowRight } from 'lucide-react';

export default function DuplicateManager({ duplicates, onComplete, onCancel }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolutions, setResolutions] = useState({});
  const iframeRef = useRef(null);

  const [appPath, setAppPath] = useState('');

  useEffect(() => {
    window.api.getAppPath().then(setAppPath);
  }, []);

  const currentDup = duplicates[currentIndex];

  const handleAction = (action) => {
    setResolutions(prev => ({
      ...prev,
      [currentDup.path]: action
    }));
    
    if (currentIndex < duplicates.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Last one, auto complete
      finishResolution({
        ...resolutions,
        [currentDup.path]: action
      });
    }
  };

  const finishResolution = (finalResolutions) => {
    const results = duplicates.map(dup => ({
      ...dup,
      action: finalResolutions[dup.path] || 'skip'
    }));
    onComplete(results);
  };

  const currentAction = resolutions[currentDup.path];

  // Load the existing file in the viewer
  const iframeSrc = currentDup.existingPath 
    ? `../../build/package/website/index.html#model=file://${currentDup.existingPath}` 
    : `../../build/package/website/index.html`;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-color)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Header */}
      <div style={{ height: '60px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between', background: 'var(--surface-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button 
            onClick={onCancel}
            style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-main)', padding: 0 }}
          >
            <ArrowLeft size={20} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Cancel Import</span>
          </button>
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>
            Duplicate Resolution ({currentIndex + 1} of {duplicates.length})
          </div>
        </div>
        
        {currentIndex === duplicates.length - 1 && currentAction && (
          <button
            onClick={() => finishResolution(resolutions)}
            style={{
              background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '8px 16px', cursor: 'pointer', fontWeight: 500, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            Apply & Finish <ArrowRight size={16} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* Left Sidebar - Information and Controls */}
        <div style={{ width: '380px', borderRight: '1px solid var(--border-color)', background: 'var(--surface-color)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
          
          <div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'var(--text-main)' }}>Identical Geometry Detected</h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              The file you are trying to upload has the exact same geometry (3D data) as an existing file in your library.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'var(--bg-color)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={14} color="var(--accent-color)" /> Existing File
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-main)', wordBreak: 'break-all' }}>
                {currentDup.existing.replace(/^\d{13}_/, '')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', wordBreak: 'break-all', opacity: 0.7 }}>
                {currentDup.existingPath}
              </div>
            </div>

            <div style={{ background: 'var(--bg-color)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Copy size={14} color="#f59e0b" /> New File
              </div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-main)', wordBreak: 'break-all' }}>
                {currentDup.original}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', wordBreak: 'break-all', opacity: 0.7 }}>
                {currentDup.path}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>Choose Action:</div>
            
            <button
              onClick={() => handleAction('skip')}
              style={{
                padding: '14px', borderRadius: '10px', border: currentAction === 'skip' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                background: currentAction === 'skip' ? 'var(--accent-color-transparent)' : 'var(--bg-color)',
                color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>Skip (Keep Existing)</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Do not import the new file.</span>
              </div>
              {currentAction === 'skip' && <Check size={18} color="var(--accent-color)" />}
            </button>

            <button
              onClick={() => handleAction('replace')}
              style={{
                padding: '14px', borderRadius: '10px', border: currentAction === 'replace' ? '2px solid #ef4444' : '1px solid var(--border-color)',
                background: currentAction === 'replace' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-color)',
                color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: currentAction === 'replace' ? '#ef4444' : 'var(--text-main)' }}>Replace Existing</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Delete old file and use the new one.</span>
              </div>
              {currentAction === 'replace' && <Trash2 size={18} color="#ef4444" />}
            </button>

            <button
              onClick={() => handleAction('keep_both')}
              style={{
                padding: '14px', borderRadius: '10px', border: currentAction === 'keep_both' ? '2px solid #10b981' : '1px solid var(--border-color)',
                background: currentAction === 'keep_both' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-color)',
                color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: currentAction === 'keep_both' ? '#10b981' : 'var(--text-main)' }}>Keep Both</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Import new file alongside the old one.</span>
              </div>
              {currentAction === 'keep_both' && <Check size={18} color="#10b981" />}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
             <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(currentIndex - 1)}
                style={{
                  background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 16px',
                  color: currentIndex === 0 ? 'var(--text-secondary)' : 'var(--text-main)', cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                  opacity: currentIndex === 0 ? 0.5 : 1
                }}
             >
               Previous
             </button>
             <button
                disabled={currentIndex === duplicates.length - 1}
                onClick={() => setCurrentIndex(currentIndex + 1)}
                style={{
                  background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 16px',
                  color: currentIndex === duplicates.length - 1 ? 'var(--text-secondary)' : 'var(--text-main)', cursor: currentIndex === duplicates.length - 1 ? 'not-allowed' : 'pointer',
                  opacity: currentIndex === duplicates.length - 1 ? 0.5 : 1
                }}
             >
               Next
             </button>
          </div>
        </div>

        {/* Right Side - 3D Viewer */}
        <div style={{ flex: 1, position: 'relative' }}>
          <iframe
            key={currentDup.existingPath}
            ref={iframeRef}
            src={iframeSrc}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="3D Viewer"
          />
        </div>
      </div>
    </div>
  );
}
