import { useRef, useEffect } from 'react';
import { ArrowLeft, File, Sun, Moon } from 'lucide-react';
import Sidebar from './Sidebar';

import ThemeDropdown from './ThemeDropdown';

export default function ViewerWorkspace({ library, setLibrary, activeFile, setActiveFile, onBack, isDarkMode, setIsDarkMode, themeStyle, setThemeStyle, gtaTheme }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    // Inject CSS to hide O3DViewer header/cookie banners
    const handleIframeLoad = () => {
      try {
        const doc = iframeRef.current?.contentDocument;
        const win = iframeRef.current?.contentWindow;
        
        // Wait for Online3DViewer internal initialization to complete!
        // This completely prevents the initial "faint icons" race condition.
        if (!win || !win.OV || !win.OV.app || !win.OV.app.viewer) {
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
          style.id = 'custom_theme_style';
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
            
            /* Floating Toolbar Base */
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
              display: flex !important;
              gap: 4px !important;
              padding: 6px !important;
            }
            .ov_toolbar_button {
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
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
        if (win && win.OV && win.OV.app && win.OV.app.viewer) {
          // Sync theme
          const isDarkTheme = isDarkMode || themeStyle === 'gta' || themeStyle === 'retro';
          win.OV.app.SwitchTheme(isDarkTheme ? 2 : 1, true);
          
          // Set background color of 3D canvas to match our application surface
          const r = isDarkTheme ? 15 : 248; // #0f111a or #f8fafc
          const g = isDarkTheme ? 17 : 250;
          const b = isDarkTheme ? 26 : 252;
          win.OV.app.settings.backgroundColor = { r, g, b, a: 255 };
          win.OV.app.viewer.SetBackgroundColor(win.OV.app.settings.backgroundColor);
        }
        if (doc) {
          const isDarkTheme = isDarkMode || themeStyle === 'gta' || themeStyle === 'retro';
          if (isDarkTheme) doc.body.classList.add('dark-theme');
          else doc.body.classList.remove('dark-theme');
          
          // Inject settings into O3DViewer floating toolbar
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


    // Sync theme whenever isDarkMode or themeStyle changes
    if (iframeRef.current) {
      try {
        const isDarkTheme = isDarkMode || themeStyle === 'gta' || themeStyle === 'retro';
        const win = iframeRef.current.contentWindow;
        if (win && win.OV && win.OV.app && win.OV.app.viewer) {
          win.OV.app.SwitchTheme(isDarkTheme ? 2 : 1, true);
          
          // Set background color of 3D canvas to match our application surface
          const r = isDarkTheme ? 15 : 248; // #0f111a or #f8fafc
          const g = isDarkTheme ? 17 : 250;
          const b = isDarkTheme ? 26 : 252;
          win.OV.app.settings.backgroundColor = { r, g, b, a: 255 };
          win.OV.app.viewer.SetBackgroundColor(win.OV.app.settings.backgroundColor);
        }
        const doc = iframeRef.current.contentDocument;
        if (doc) {
          if (isDarkTheme) doc.body.classList.add('dark-theme');
          else doc.body.classList.remove('dark-theme');
          
          // Inject dynamic theme styles for the toolbar
          let customStyle = doc.getElementById('dynamic_theme_style');
          if (!customStyle) {
            customStyle = doc.createElement('style');
            customStyle.id = 'dynamic_theme_style';
            doc.head.appendChild(customStyle);
          }
          
          const parentStyle = getComputedStyle(document.documentElement);

          const text = parentStyle.getPropertyValue('--text-main').trim() || '#000';
          const border = parentStyle.getPropertyValue('--border-color').trim() || '#ccc';
          const accent = parentStyle.getPropertyValue('--accent-color').trim() || '#3b82f6';
          const bg = parentStyle.getPropertyValue('--bg-color').trim() || '#f0f2f5';

          // Base toolbar styles - shared across all themes
          let toolbarCSS = `
            body { background-color: ${bg} !important; }
            .main_viewer { background-color: transparent !important; }
            .ov_toolbar_separator { background: ${border} !important; }
          `;

          // Theme-specific toolbar styles
          if (themeStyle === 'cartoon') {
            toolbarCSS += `
              .toolbar {
                background: #ffffff !important;
                border: 3px solid #000000 !important;
                border-radius: 20px !important;
                box-shadow: 6px 6px 0px #000000 !important;
              }
              .ov_toolbar_button {
                border-radius: 10px !important;
                fill: #000000 !important;
                color: #000000 !important;
              }
              .ov_toolbar_button:hover, .ov_toolbar_button.selected {
                background: #ff4081 !important;
                fill: #fff !important;
                color: #fff !important;
              }
              .ov_toolbar svg { stroke: #000000 !important; }
              .ov_toolbar_button:hover svg { stroke: #fff !important; }
              .ov_toolbar_separator { background: #000 !important; width: 3px !important; }
            `;
          } else if (themeStyle === 'barbie') {
            toolbarCSS += `
              .toolbar {
                background: rgba(255, 255, 255, 0.9) !important;
                border: 3px solid #e91e63 !important;
                border-radius: 24px !important;
                box-shadow: 4px 4px 0px rgba(0, 176, 255, 0.5) !important;
              }
              .ov_toolbar_button {
                border-radius: 12px !important;
                fill: #c2185b !important;
                color: #c2185b !important;
              }
              .ov_toolbar_button:hover, .ov_toolbar_button.selected {
                background: #00b0ff !important;
                fill: #fff !important;
                color: #fff !important;
              }
              .ov_toolbar svg { stroke: #c2185b !important; }
              .ov_toolbar_button:hover svg { stroke: #fff !important; }
              .ov_toolbar_separator { background: #e91e63 !important; width: 3px !important; }
            `;
          } else if (themeStyle === 'gta') {
            // GTA sub-theme specific toolbars
            if (gtaTheme === 'san_andreas') {
              toolbarCSS += `
                .toolbar {
                  background: rgba(59, 42, 26, 0.92) !important;
                  border: 2px solid #fca311 !important;
                  border-radius: 4px !important;
                  box-shadow: 0 0 15px rgba(252, 163, 17, 0.4), inset 0 0 10px rgba(0,0,0,0.5) !important;
                }
                .ov_toolbar_button {
                  border-radius: 2px !important;
                  fill: #ffffff !important;
                  color: #ffffff !important;
                }
                .ov_toolbar_button:hover, .ov_toolbar_button.selected {
                  background: #fca311 !important;
                  fill: #000 !important;
                  color: #000 !important;
                  box-shadow: 0 0 8px #fca311 !important;
                }
                .ov_toolbar svg { stroke: #ffffff !important; }
                .ov_toolbar_button:hover svg { stroke: #000 !important; }
                .ov_toolbar_separator { background: #fca311 !important; box-shadow: 0 0 4px rgba(252, 163, 17, 0.5) !important; }
              `;
            } else if (gtaTheme === 'gta4') {
              toolbarCSS += `
                .toolbar {
                  background: rgba(26, 26, 26, 0.92) !important;
                  border: 1px solid #8c7355 !important;
                  border-radius: 2px !important;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
                }
                .ov_toolbar_button {
                  border-radius: 2px !important;
                  fill: #c0c0c0 !important;
                  color: #c0c0c0 !important;
                }
                .ov_toolbar_button:hover, .ov_toolbar_button.selected {
                  background: #8c7355 !important;
                  fill: #fff !important;
                  color: #fff !important;
                }
                .ov_toolbar svg { stroke: #c0c0c0 !important; }
                .ov_toolbar_button:hover svg { stroke: #fff !important; }
                .ov_toolbar_separator { background: #5a4a3a !important; }
              `;
            } else if (gtaTheme === 'gta5') {
              toolbarCSS += `
                .toolbar {
                  background: rgba(0, 30, 20, 0.92) !important;
                  border: 2px solid #55a630 !important;
                  border-radius: 4px !important;
                  box-shadow: 0 0 20px rgba(85, 166, 48, 0.4), inset 0 0 10px rgba(0,0,0,0.5) !important;
                }
                .ov_toolbar_button {
                  border-radius: 2px !important;
                  fill: #ffffff !important;
                  color: #ffffff !important;
                }
                .ov_toolbar_button:hover, .ov_toolbar_button.selected {
                  background: #55a630 !important;
                  fill: #fff !important;
                  color: #fff !important;
                  box-shadow: 0 0 8px #55a630 !important;
                }
                .ov_toolbar svg { stroke: #ffffff !important; }
                .ov_toolbar_button:hover svg { stroke: #fff !important; }
                .ov_toolbar_separator { background: #55a630 !important; box-shadow: 0 0 4px rgba(85, 166, 48, 0.5) !important; }
              `;
            } else {
              // Vice City (default)
              toolbarCSS += `
                .toolbar {
                  background: rgba(13, 1, 33, 0.92) !important;
                  border: 2px solid #ff00a0 !important;
                  border-radius: 4px !important;
                  box-shadow: 0 0 20px rgba(255, 0, 160, 0.5), inset 0 0 10px rgba(0,0,0,0.5) !important;
                }
                .ov_toolbar_button {
                  border-radius: 2px !important;
                  fill: #00ffff !important;
                  color: #00ffff !important;
                }
                .ov_toolbar_button:hover, .ov_toolbar_button.selected {
                  background: #ff00a0 !important;
                  fill: #fff !important;
                  color: #fff !important;
                  box-shadow: 0 0 8px #ff00a0 !important;
                }
                .ov_toolbar svg { stroke: #00ffff !important; }
                .ov_toolbar_button:hover svg { stroke: #fff !important; }
                .ov_toolbar_separator { background: #ff00a0 !important; box-shadow: 0 0 4px rgba(255, 0, 160, 0.5) !important; }
              `;
            }
          } else if (themeStyle === 'ghibli') {
            toolbarCSS += `
              .toolbar {
                background: rgba(255, 255, 255, 0.85) !important;
                border: 2px solid ${border} !important;
                border-radius: 24px !important;
                box-shadow: 4px 4px 0px ${border} !important;
              }
              .ov_toolbar_button {
                border-radius: 16px !important;
                fill: ${text} !important;
                color: ${text} !important;
              }
              .ov_toolbar_button:hover, .ov_toolbar_button.selected {
                background: ${accent} !important;
                fill: #fff !important;
                color: #fff !important;
              }
              .ov_toolbar svg { stroke: ${text} !important; }
              .ov_toolbar_button:hover svg { stroke: #fff !important; }
              .ov_toolbar_separator { background: ${border} !important; }
            `;
          } else if (themeStyle === 'retro') {
            toolbarCSS += `
              .toolbar {
                background: rgba(30, 8, 48, 0.9) !important;
                border: 2px solid #ff00ff !important;
                border-radius: 8px !important;
                box-shadow: 0 0 20px rgba(255, 0, 255, 0.6), 0 0 40px rgba(255, 0, 255, 0.3) !important;
              }
              .ov_toolbar_button {
                border-radius: 6px !important;
                fill: #00ffff !important;
                color: #00ffff !important;
              }
              .ov_toolbar_button:hover, .ov_toolbar_button.selected {
                background: #ff00a0 !important;
                fill: #fff !important;
                color: #fff !important;
                box-shadow: 0 0 10px #ff00a0 !important;
              }
              .ov_toolbar svg { stroke: #00ffff !important; }
              .ov_toolbar_button:hover svg { stroke: #fff !important; }
              .ov_toolbar_separator { background: #ff00ff !important; box-shadow: 0 0 4px #ff00ff !important; }
            `;
          } else if (themeStyle === '95') {
            toolbarCSS += `
              .toolbar {
                background: #c0c0c0 !important;
                border: 1px solid #000000 !important;
                border-radius: 0px !important;
                box-shadow: inset 1px 1px 0px #ffffff, inset -1px -1px 0px #000000, inset 2px 2px 0px #dfdfdf, inset -2px -2px 0px #808080 !important;
              }
              .ov_toolbar_button {
                border-radius: 0px !important;
                fill: #000000 !important;
                color: #000000 !important;
              }
              .ov_toolbar_button:hover, .ov_toolbar_button.selected {
                background: #000080 !important;
                fill: #fff !important;
                color: #fff !important;
                box-shadow: inset 1px 1px 0px #000000, inset -1px -1px 0px #ffffff !important;
              }
              .ov_toolbar svg { stroke: #000000 !important; }
              .ov_toolbar_button:hover svg { stroke: #fff !important; }
              .ov_toolbar_separator { background: #808080 !important; }
            `;
          } else if (themeStyle === 'communist') {
            toolbarCSS += `
              .toolbar {
                background: rgba(220, 38, 38, 0.95) !important;
                border: 2px solid #fef08a !important;
                border-radius: 4px !important;
                box-shadow: 0 4px 20px rgba(220, 38, 38, 0.6) !important;
              }
              .ov_toolbar_button {
                border-radius: 2px !important;
                fill: #fef08a !important;
                color: #fef08a !important;
              }
              .ov_toolbar_button:hover, .ov_toolbar_button.selected {
                background: #fef08a !important;
                fill: #dc2626 !important;
                color: #dc2626 !important;
              }
              .ov_toolbar svg { stroke: #fef08a !important; }
              .ov_toolbar_button:hover svg { stroke: #dc2626 !important; }
              .ov_toolbar_separator { background: #fef08a !important; box-shadow: 0 0 4px rgba(254, 240, 138, 0.5) !important; }
            `;
          } else {
            // Modern / default
            const isDk = isDarkMode;
            toolbarCSS += `
              .toolbar {
                background: ${isDk ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)'} !important;
                border: 1px solid ${isDk ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'} !important;
                border-radius: 16px !important;
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15) !important;
              }
              .ov_toolbar_button {
                border-radius: 10px !important;
                fill: ${text} !important;
                color: ${text} !important;
              }
              .ov_toolbar_button:hover, .ov_toolbar_button.selected {
                background: ${accent} !important;
                fill: #fff !important;
                color: #fff !important;
              }
              .ov_toolbar svg { stroke: ${text} !important; }
              .ov_toolbar_button:hover svg { stroke: #fff !important; }
            `;
          }

          customStyle.innerHTML = toolbarCSS;
        }
      } catch (e) {
        console.error('Theme sync error:', e);
      }
    }
  }, [isDarkMode, themeStyle, activeFile, gtaTheme]);

  // Use the file path as the hash URL for the viewer
  const iframeSrc = activeFile && activeFile.path
    ? `../../build/package/website/index.html#model=file://${activeFile.path}` 
    : `../../build/package/website/index.html`;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Header */}
      <div className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', height: '64px', position: 'relative', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={onBack}
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '20px' }}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', background: 'var(--accent-bg-glow)', padding: '4px 12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <File size={16} color="var(--accent-color)" />
            <span>{activeFile ? activeFile.name : 'No file selected'}</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {themeStyle === 'barbie' && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface-color)', padding: '4px 10px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              Barbie Girl
            </div>
          )}
          {themeStyle === 'gta' && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface-color)', padding: '4px 10px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              GTA Theme
            </div>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--surface-color)', padding: '3px 8px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
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
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg-color)' }}>
        <Sidebar library={library} setLibrary={setLibrary} activeFile={activeFile} setActiveFile={setActiveFile} themeStyle={themeStyle} />
        
        <div style={{ flex: 1, position: 'relative', background: 'var(--bg-color)' }}>
          <iframe
            key={activeFile ? activeFile.id : 'none'}
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
