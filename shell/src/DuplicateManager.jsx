import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, Copy, Trash2, ArrowRight } from 'lucide-react';

export default function DuplicateManager({ duplicates, isDarkMode, themeStyle, isLibraryScan, onComplete, onCancel }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolutions, setResolutions] = useState({});
  const iframeRef = useRef(null);
  const leftIframeRef = useRef(null);
  const rightIframeRef = useRef(null);
  
  const [applyToAll, setApplyToAll] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [syncCameras, setSyncCameras] = useState(true);

  useEffect(() => {
    const handleIframeLoad = (ref) => {
      try {
        const doc = ref.current?.contentDocument;
        const win = ref.current?.contentWindow;
        
        if (!win || !win.OV || !win.OV.app || !win.OV.app.viewer) {
          setTimeout(() => handleIframeLoad(ref), 50);
          return;
        }

        if (doc && !doc.getElementById('custom_theme_style')) {
          const style = doc.createElement('style');
          style.id = 'custom_theme_style';
          style.innerHTML = `
            /* Hide unnecessary default UI elements */
            .title { display: none !important; }
            .ov_bottom_floating_panel { display: none !important; }
            .main_left_container { display: none !important; }
            .main_right_container { display: none !important; }
            .intro { display: none !important; }
            .header { display: none !important; }
            
            /* Full stretch viewer canvas */
            html, body, .main, .main_viewer {
              height: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background-color: transparent !important;
            }
            body { background-color: transparent !important; }
            .main { top: 0 !important; }
            
            div.main_viewer canvas {
              margin: 0 !important;
              border: none !important;
              width: 100% !important;
              height: 100% !important;
            }
          `;
          doc.head.appendChild(style);
        }
        
        if (win && win.OV && win.OV.app && win.OV.app.viewer) {
          const isDarkTheme = isDarkMode || themeStyle === 'gta' || themeStyle === 'retro';
          win.OV.app.SwitchTheme(isDarkTheme ? 2 : 1, true);
          
          // Set background color of 3D canvas to match our application surface
          const r = isDarkTheme ? 15 : 248; // #0f111a or #f8fafc
          const g = isDarkTheme ? 17 : 250;
          const b = isDarkTheme ? 26 : 252;
          win.OV.app.settings.backgroundColor = { r, g, b, a: 255 };
          win.OV.app.viewer.SetBackgroundColor(win.OV.app.settings.backgroundColor);
        }
      } catch (e) {
        console.error('Frame style injection failed:', e);
      }
    };

    const injectStyles = () => {
      if (!isComparing) {
        handleIframeLoad(iframeRef);
      } else {
        handleIframeLoad(leftIframeRef);
        handleIframeLoad(rightIframeRef);
      }
    };

    injectStyles();
    
    // Also attach to onload
    if (!isComparing && iframeRef.current) {
      iframeRef.current.onload = () => handleIframeLoad(iframeRef);
    } else if (isComparing) {
      if (leftIframeRef.current) leftIframeRef.current.onload = () => handleIframeLoad(leftIframeRef);
      if (rightIframeRef.current) rightIframeRef.current.onload = () => handleIframeLoad(rightIframeRef);
    }
  }, [currentIndex, isDarkMode, themeStyle, isComparing]);

  // Sync Cameras Effect
  useEffect(() => {
    if (!isComparing || !syncCameras) return;
    
    let animationFrameId;
    const syncLoop = () => {
      try {
        const leftWin = leftIframeRef.current?.contentWindow;
        const rightWin = rightIframeRef.current?.contentWindow;
        if (leftWin?.OV?.app?.viewer && rightWin?.OV?.app?.viewer) {
          const leftCamera = leftWin.OV.app.viewer.navigation.GetCamera();
          const rightNav = rightWin.OV.app.viewer.navigation;
          const currentRightCam = rightNav.GetCamera();
          
          if (
            leftCamera.eye.x !== currentRightCam.eye.x || 
            leftCamera.eye.y !== currentRightCam.eye.y || 
            leftCamera.eye.z !== currentRightCam.eye.z ||
            leftCamera.center.x !== currentRightCam.center.x ||
            leftCamera.up.x !== currentRightCam.up.x ||
            leftCamera.up.y !== currentRightCam.up.y ||
            leftCamera.up.z !== currentRightCam.up.z
          ) {
             rightWin.OV.app.viewer.SetCamera(leftCamera.Clone());
          }
        }
      } catch {
        // ignore camera sync errors
      }
      animationFrameId = requestAnimationFrame(syncLoop);
    };
    syncLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isComparing, syncCameras, currentIndex]);

  const currentDup = duplicates[currentIndex];

  const handleAction = (action) => {
    if (applyToAll) {
      // Apply this action to all remaining unresolved duplicates
      const newResolutions = { ...resolutions };
      for (let i = currentIndex; i < duplicates.length; i++) {
        newResolutions[duplicates[i].path] = action;
      }
      setResolutions(newResolutions);
      finishResolution(newResolutions);
    } else {
      setResolutions(prev => ({
        ...prev,
        [currentDup.path]: action
      }));
      
      if (currentIndex < duplicates.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setIsComparing(false); // reset view
      } else {
        // Last one, auto complete
        finishResolution({
          ...resolutions,
          [currentDup.path]: action
        });
      }
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
        <div style={{ 
          width: '340px', 
          height: 'calc(100% - 24px)',
          margin: '12px 12px 12px 16px',
          background: 'var(--surface-color)', 
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-md)',
          padding: '20px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '20px', 
          overflowY: 'auto',
          flexShrink: 0
        }}>
          
          <div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'var(--text-main)' }}>Duplicate Design Found</h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              The 3D model you are importing is exactly the same as one already in your library.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ background: 'var(--bg-color)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={12} color="var(--accent-color)" /> Original (In Library)
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-main)', wordBreak: 'break-all' }}>
                {currentDup.existing.replace(/^\d{13}_/, '')}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', wordBreak: 'break-all', opacity: 0.7 }}>
                {currentDup.existingPath}
              </div>
            </div>

            <div style={{ background: 'var(--bg-color)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Copy size={12} color="#f59e0b" /> Duplicate (Importing)
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-main)', wordBreak: 'break-all' }}>
                {currentDup.original}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', wordBreak: 'break-all', opacity: 0.7 }}>
                {currentDup.path}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>Choose Action:</div>
            
            <button
              onClick={() => handleAction('skip')}
              style={{
                padding: '10px 14px', borderRadius: '8px', border: currentAction === 'skip' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                background: currentAction === 'skip' ? 'var(--accent-color-transparent)' : 'var(--bg-color)',
                color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{isLibraryScan ? 'Delete Duplicate' : "Don't Add (Keep Original)"}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{isLibraryScan ? 'Delete this duplicate file.' : 'Skip importing the new file.'}</span>
              </div>
              {currentAction === 'skip' && <Check size={16} color="var(--accent-color)" />}
            </button>

            {!isLibraryScan && (
              <button
                onClick={() => handleAction('replace')}
                style={{
                  padding: '10px 14px', borderRadius: '8px', border: currentAction === 'replace' ? '2px solid #ef4444' : '1px solid var(--border-color)',
                  background: currentAction === 'replace' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-color)',
                  color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: currentAction === 'replace' ? '#ef4444' : 'var(--text-main)' }}>Replace Original</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Delete the original file and import the new one instead.</span>
                </div>
                {currentAction === 'replace' && <Trash2 size={16} color="#ef4444" />}
              </button>
            )}

            <button
              onClick={() => handleAction('keep_both')}
              style={{
                padding: '10px 14px', borderRadius: '8px', border: currentAction === 'keep_both' ? '2px solid #10b981' : '1px solid var(--border-color)',
                background: currentAction === 'keep_both' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-color)',
                color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: currentAction === 'keep_both' ? '#10b981' : 'var(--text-main)' }}>Keep Both Files</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{isLibraryScan ? 'Keep both files in library.' : 'Import the new file alongside the original.'}</span>
              </div>
              {currentAction === 'keep_both' && <Check size={16} color="#10b981" />}
            </button>


          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', alignItems: 'center' }}>
             <button
                disabled={currentIndex === 0}
                onClick={() => { setCurrentIndex(currentIndex - 1); setIsComparing(false); }}
                style={{
                  background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 16px',
                  color: currentIndex === 0 ? 'var(--text-secondary)' : 'var(--text-main)', cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                  opacity: currentIndex === 0 ? 0.5 : 1
                }}
             >
               Previous
             </button>
             <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-main)' }}>
               <input type="checkbox" checked={applyToAll} onChange={e => setApplyToAll(e.target.checked)} />
               Apply to all remaining
             </label>
             <button
                disabled={currentIndex === duplicates.length - 1}
                onClick={() => { setCurrentIndex(currentIndex + 1); setIsComparing(false); }}
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

        {/* Right Side - 3D Viewer Area */}
        <div style={{ flex: 1, position: 'relative', background: 'var(--bg-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {!isComparing ? (
            <div style={{ 
              flex: 1, 
              position: 'relative',
              height: 'calc(100% - 24px)',
              margin: '12px 16px 12px 12px',
              background: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-md)',
              overflow: 'hidden'
            }}>
              <iframe
                key={currentDup.existingPath + '_single'}
                ref={iframeRef}
                src={iframeSrc}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="3D Viewer"
              />
              <div style={{ position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
                <button
                  onClick={() => setIsComparing(true)}
                  style={{
                    background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '24px',
                    padding: '12px 24px', color: 'var(--text-main)', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                    boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                >
                  <Copy size={16} /> View and Compare Both
                </button>
              </div>
            </div>
          ) : (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column',
              height: 'calc(100% - 24px)',
              margin: '12px 16px 12px 12px',
              background: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-md)',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '12px 24px', background: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '14px' }}>Side-by-Side Comparison</span>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-main)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={syncCameras} onChange={e => setSyncCameras(e.target.checked)} />
                    Sync Cameras
                  </label>
                  <button
                    onClick={() => setIsComparing(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                  >
                    Exit Compare
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex' }}>
                {/* Left side: Existing */}
                <div style={{ flex: 1, borderRight: '1px solid var(--border-color)', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', zIndex: 10, backdropFilter: 'blur(4px)' }}>
                    Existing File
                  </div>
                  <iframe
                    key={currentDup.existingPath + '_left'}
                    ref={leftIframeRef}
                    src={iframeSrc}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="3D Viewer Left"
                  />
                </div>
                {/* Right side: New */}
                <div style={{ flex: 1, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', zIndex: 10, backdropFilter: 'blur(4px)' }}>
                    New File
                  </div>
                  <iframe
                    key={currentDup.path + '_right'}
                    ref={rightIframeRef}
                    src={`../../build/package/website/index.html#model=file://${currentDup.path}`}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="3D Viewer Right"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
