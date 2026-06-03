import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import ViewerWorkspace from './ViewerWorkspace';
import './index.css';

import maoBg1 from '../../assets/images/Mao_jedong.jpg';
import maoBg2 from '../../assets/images/mao_zedong2.jpg';
import spiderBg1 from '../../assets/images/spiderman.jpg';
import spiderBg2 from '../../assets/images/miles_morales.jpg';
import sovietBg1 from '../../assets/images/soviet1.jpg';
import sovietBg2 from '../../assets/images/soviet2.jpg';

export default function App() {
  const [library, setLibrary] = useState(null);
  const [currentFolderId, setCurrentFolderId] = useState(null); // null means root
  const [activeFile, setActiveFile] = useState(null); // The file to view in the 3D Viewer
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('isDarkMode') === 'true'); // Global theme state
  const [themeStyle, setThemeStyle] = useState(() => localStorage.getItem('themeStyle') || 'modern');
  const [gtaTheme, setGtaTheme] = useState(() => localStorage.getItem('gtaTheme') || 'vice_city');
  const [isCommunistSpedUp, setIsCommunistSpedUp] = useState(false);
  const [isMilesMorales, setIsMilesMorales] = useState(false);
  const [isUssrTheme, setIsUssrTheme] = useState(false);
  const [isUssrAlt, setIsUssrAlt] = useState(false);

  // Load library on start
  useEffect(() => {
    const initLibrary = async () => {
      const data = await window.api.loadLibrary();
      // Check for missing files
      const verifyFiles = async (nodes) => {
        const result = [];
        for (const node of nodes) {
          if (node.type === 'file') {
            const exists = await window.api.checkExists(node.path);
            result.push({ ...node, missing: !exists });
          } else if (node.type === 'folder' && node.children) {
            result.push({ ...node, children: await verifyFiles(node.children) });
          } else {
            result.push(node);
          }
        }
        return result;
      };
      
      const verifiedData = await verifyFiles(data || []);
      setLibrary(verifiedData);
    };
    initLibrary();
  }, []);

  // Save library when it changes
  useEffect(() => {
    if (library !== null) {
      window.api.saveLibrary(library);
    }
  }, [library]);

  // Apply global dark mode class to HTML element
  useEffect(() => {
    document.documentElement.className = '';
    if (isDarkMode && themeStyle !== 'barbie') {
      document.documentElement.classList.add('dark');
    }
    if (themeStyle) {
      document.documentElement.classList.add(`theme-${themeStyle}`);
      if (themeStyle === 'gta') {
        document.documentElement.classList.add(`gta-${gtaTheme}`);
      }
      if (themeStyle === 'spiderman' && isMilesMorales) {
        document.documentElement.classList.add('miles-morales');
      }
    }
    
    // Persist to local storage
    localStorage.setItem('isDarkMode', isDarkMode);
    localStorage.setItem('themeStyle', themeStyle);
    localStorage.setItem('gtaTheme', gtaTheme);
  }, [isDarkMode, themeStyle, gtaTheme, isMilesMorales]);

  const navigateToDashboard = () => {
    setActiveFile(null);
  };

  return (
    <>
      {themeStyle === 'communist' && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: `url(${isUssrTheme ? (isUssrAlt ? sovietBg2 : sovietBg1) : (isCommunistSpedUp ? maoBg2 : maoBg1)})`,
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: -1,
          transition: 'background-image 0.3s ease-in-out'
        }} />
      )}
      {themeStyle === 'spiderman' && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: `url(${isMilesMorales ? spiderBg2 : spiderBg1})`,
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: -1,
          transition: 'background-image 0.3s ease-in-out'
        }} />
      )}
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {activeFile ? (
          <ViewerWorkspace 
            library={library}
            setLibrary={setLibrary}
            activeFile={activeFile} 
            setActiveFile={setActiveFile}
            onBack={navigateToDashboard}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            themeStyle={themeStyle}
            setThemeStyle={setThemeStyle}
            gtaTheme={gtaTheme}
            setGtaTheme={setGtaTheme}
            isCommunistSpedUp={isCommunistSpedUp}
            setIsCommunistSpedUp={setIsCommunistSpedUp}
            isMilesMorales={isMilesMorales}
            setIsMilesMorales={setIsMilesMorales}
            isUssrTheme={isUssrTheme}
            setIsUssrTheme={setIsUssrTheme}
            isUssrAlt={isUssrAlt}
            setIsUssrAlt={setIsUssrAlt}
          />
        ) : (
          <Dashboard 
            library={library} 
            setLibrary={setLibrary}
            currentFolderId={currentFolderId}
            setCurrentFolderId={setCurrentFolderId}
            setActiveFile={setActiveFile}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            themeStyle={themeStyle}
            setThemeStyle={setThemeStyle}
            gtaTheme={gtaTheme}
            setGtaTheme={setGtaTheme}
            isCommunistSpedUp={isCommunistSpedUp}
            setIsCommunistSpedUp={setIsCommunistSpedUp}
            isMilesMorales={isMilesMorales}
            setIsMilesMorales={setIsMilesMorales}
            isUssrTheme={isUssrTheme}
            setIsUssrTheme={setIsUssrTheme}
            isUssrAlt={isUssrAlt}
            setIsUssrAlt={setIsUssrAlt}
          />
        )}
      </div>
    </>
  );
}
