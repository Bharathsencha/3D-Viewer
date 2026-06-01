import React, { useRef, useEffect } from 'react';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import Sidebar from './Sidebar';
import MusicPlayer from './MusicPlayer';
import ThemeDropdown from './ThemeDropdown';

export default function ViewerWorkspace({ library, activeFile, setActiveFile, onBack, isDarkMode, setIsDarkMode, themeStyle, setThemeStyle }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    // Inject CSS to hide O3DViewer header/cookie banners
    const handleIframeLoad = () => {
      try {
        const doc = iframeRef.current?.contentDocument;
        const win = iframeRef.current?.contentWindow;
        
        // Wait for Online3DViewer internal initialization to complete!
        // This completely prevents the initial "faint icons" race condition.
        if (!win || !win.OV || !win.OV.app) {
          setTimeout(handleIframeLoad, 50);
          return;
        }

        if (doc && !doc.getElementById('custom_theme_style')) {
          // Listen for theme changes from Online3DViewer
          const script = doc.createElement('script');
          script.innerHTML = `
            if (window.OV) {
              const oldHandler = window.OV.SetWebsiteEventHandler;
              if (oldHandler) {
                window.OV.SetWebsiteEventHandler = function(handler) {
                  const newHandler = (eventName, eventLabel, eventParams) => {
                    handler(eventName, eventLabel, eventParams);
                    if (eventName === 'theme_changed') {
                      window.parent.postMessage({ type: 'theme_changed', theme: eventLabel }, '*');
                    }
                  };
                  oldHandler.call(window.OV, newHandler);
                };
              }
            }
          `;
          doc.body.appendChild(script);

          const style = doc.createElement('style');
          style.innerHTML = `
            /* Hide unnecessary default UI elements */
            .title { display: none !important; }
            .ov_bottom_floating_panel { display: none !important; }
            .main_left_container { display: none !important; }
            .intro { display: none !important; }
            
            /* Full stretch viewer canvas to fix bottom black bar */
            html, body, .main, .main_viewer {
              height: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .main { top: 0 !important; }
            
            div.main_viewer canvas {
              margin: 0 !important;
              border: none !important;
              width: 100% !important;
              height: 100% !important;
            }
            
            /* Modern Toolbar Redesign */
            .header {
              background: transparent !important;
              box-shadow: none !important;
              position: absolute !important;
              top: 16px !important;
              left: 50% !important;
              transform: translateX(-50%) !important;
              width: max-content !important;
              height: auto !important;
              z-index: 10 !important;
              border-bottom: none !important;
            }
            .toolbar {
              background: rgba(255, 255, 255, 0.95) !important;
              border: 1px solid rgba(0, 0, 0, 0.1) !important;
              border-radius: 16px !important;
              padding: 6px !important;
              box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15) !important;
              display: flex !important;
              gap: 4px !important;
            }
            body.dark-theme .toolbar {
              background: rgba(30, 30, 30, 0.95) !important;
              border: 1px solid rgba(255, 255, 255, 0.1) !important;
            }
            .ov_toolbar_button {
              border-radius: 10px !important;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
              color: var(--ov_foreground_color) !important;
            }
            .ov_toolbar_button:hover, .ov_toolbar_button.selected {
              background: rgba(150, 150, 150, 0.2) !important;
            }
            .ov_toolbar_separator {
              background: var(--ov_border_color) !important;
            }
            
            /* Modern Right Panel (Details) Redesign - Overlay settings */
            .main_right_container {
              display: var(--show-settings, none) !important;
              position: absolute !important;
              right: 0 !important;
              top: 0 !important;
              height: 100% !important;
              z-index: 100 !important;
              box-shadow: -8px 0 32px rgba(0,0,0,0.3) !important;
              background: var(--ov_background_color) !important;
              border-left: 1px solid var(--ov_border_color) !important;
            }
            .ov_panel_set_right_container { background: transparent !important; }
            .ov_panel { color: var(--ov_foreground_color) !important; font-family: 'Inter', system-ui, sans-serif !important; }
            .ov_panel_title { font-family: inherit !important; font-weight: 600 !important; color: var(--ov_foreground_color) !important; border-bottom: 1px solid var(--ov_border_color) !important; padding: 16px !important; }
            
            /* Modern Spinner Overlay */
            .ov_progress {
              background: var(--ov_background_color) !important;
              border: 1px solid var(--ov_border_color) !important;
              border-radius: 12px !important;
              box-shadow: 0 8px 32px rgba(0,0,0,0.2) !important;
              padding: 32px 48px !important;
            }
            .ov_progress_text {
              color: var(--ov_foreground_color) !important;
              font-family: 'Inter', system-ui, sans-serif !important;
              font-weight: 500 !important;
              font-size: 16px !important;
              margin-top: 16px !important;
            }
            .modern-spinner {
              border: 4px solid rgba(150, 150, 150, 0.2);
              border-left-color: var(--ov_hover_color, #3b82f6);
              border-radius: 50%;
              width: 48px;
              height: 48px;
              animation: spin 1s linear infinite;
              margin: 0 auto;
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `;
          doc.head.appendChild(style);
        }
        if (win && win.OV && win.OV.app) {
          // Sync theme
          win.OV.app.SwitchTheme(isDarkMode ? 2 : 1, true);
        }
        if (doc) {
          if (isDarkMode) doc.body.classList.add('dark-theme');
          else doc.body.classList.remove('dark-theme');
        }
        
        // Inject settings into O3DViewer floating toolbar
        if (doc) {
          const toolbar = doc.getElementById('toolbar');
          if (toolbar && !doc.getElementById('custom_settings_added')) {
            const sep1 = doc.createElement('div');
            sep1.className = 'ov_toolbar_separator';
            toolbar.appendChild(sep1);

            // Toggle Edges
            const edgeBtn = doc.createElement('div');
            edgeBtn.id = 'custom_settings_added';
            edgeBtn.className = 'ov_toolbar_button';
            edgeBtn.title = 'Toggle Edges';
            edgeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="var(--ov_icon_color)" stroke-width="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`;
            edgeBtn.style.padding = '8px';
            edgeBtn.style.display = 'flex';
            edgeBtn.style.alignItems = 'center';
            edgeBtn.style.cursor = 'pointer';
            
            edgeBtn.onclick = () => {
              if (win.OV && win.OV.app) {
                 win.OV.app.settings.edgeSettings.showEdges = !win.OV.app.settings.edgeSettings.showEdges;
                 win.OV.app.viewer.SetEdgeSettings(win.OV.app.settings.edgeSettings);
                 win.OV.app.settings.SaveToCookies();
                 if (win.OV.app.settings.edgeSettings.showEdges) edgeBtn.classList.add('selected');
                 else edgeBtn.classList.remove('selected');
              }
            };
            toolbar.appendChild(edgeBtn);
            
            // Background Color Picker
            const bgBtn = doc.createElement('div');
            bgBtn.className = 'ov_toolbar_button';
            bgBtn.title = 'Background Color';
            bgBtn.style.padding = '4px 6px';
            bgBtn.style.display = 'flex';
            bgBtn.style.alignItems = 'center';
            bgBtn.innerHTML = `<input type="color" id="bg_color_picker" style="width: 20px; height: 20px; border: none; padding: 0; background: transparent; cursor: pointer; border-radius: 4px;">`;
            toolbar.appendChild(bgBtn);
            
            const picker = bgBtn.querySelector('#bg_color_picker');
            if (win.OV && win.OV.app) {
               const c = win.OV.app.settings.backgroundColor;
               if (c && c.r !== undefined) {
                 const toHex = (n) => n.toString(16).padStart(2, '0');
                 picker.value = `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
               }
            }
            picker.oninput = (e) => {
               const hex = e.target.value;
               const r = parseInt(hex.slice(1,3), 16);
               const g = parseInt(hex.slice(3,5), 16);
               const b = parseInt(hex.slice(5,7), 16);
               if (win.OV && win.OV.app) {
                  win.OV.app.settings.backgroundColor = { r, g, b, a: 255 };
                  win.OV.app.viewer.SetBackgroundColor(win.OV.app.settings.backgroundColor);
                  win.OV.app.settings.SaveToCookies();
               }
            };
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    if (iframeRef.current) {
      iframeRef.current.onload = handleIframeLoad;
      // if already loaded
      if (iframeRef.current.contentDocument?.readyState === 'complete') {
        handleIframeLoad();
      }
    }


    // Sync theme whenever isDarkMode changes
    if (iframeRef.current) {
      try {
        const win = iframeRef.current.contentWindow;
        if (win && win.OV && win.OV.app) {
          win.OV.app.SwitchTheme(isDarkMode ? 2 : 1, true);
        }
        const doc = iframeRef.current.contentDocument;
        if (doc) {
          if (isDarkMode) doc.body.classList.add('dark-theme');
          else doc.body.classList.remove('dark-theme');
        }
      } catch (err) {}
    }
  }, [iframeRef, isDarkMode]);

  // Use the file path as the hash URL for the viewer
  const iframeSrc = activeFile 
    ? `../../build/package/website/index.html#model=file://${activeFile.path}` 
    : `../../build/package/website/index.html`;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Header */}
      <div style={{ height: '60px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between', background: 'var(--surface-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button 
            onClick={onBack}
            style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-main)', padding: 0 }}
          >
            <ArrowLeft size={20} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Back to Dashboard</span>
          </button>
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
            {activeFile ? activeFile.name : 'No file selected'}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {themeStyle === 'barbie' && (
            <div style={{ fontSize: '12px', color: 'var(--text-main)', background: 'var(--bg-color)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              Credit: <a href="https://www.youtube.com/watch?v=ZyhrYis509A" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>Aqua - Barbie Girl</a>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-color)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
            <ThemeDropdown themeStyle={themeStyle} setThemeStyle={setThemeStyle} />
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px'
              }}
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
          <MusicPlayer themeStyle={themeStyle} />
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg-color)' }}>
        <Sidebar library={library} activeFile={activeFile} setActiveFile={setActiveFile} themeStyle={themeStyle} />
        
        <div style={{ flex: 1, position: 'relative', background: 'var(--bg-color)' }}>
          <iframe
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
