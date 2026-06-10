import React, { useState, useEffect } from 'react';
import Dashboard from './Dashboard';
import ViewerWorkspace from './ViewerWorkspace';
import './index.css';

// No background image imports needed

export default function App() {
  const [library, setLibrary] = useState(null);
  const [currentFolderId, setCurrentFolderId] = useState(null); // null means root
  const [activeFile, setActiveFile] = useState(null); // The file to view in the 3D Viewer
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('isDarkMode') === 'true'); // Global theme state
  const [themeStyle, setThemeStyle] = useState(() => localStorage.getItem('themeStyle') || 'modern');

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
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    }
    if (themeStyle) {
      document.documentElement.classList.add(`theme-${themeStyle}`);
    }
    
    // Persist to local storage
    localStorage.setItem('isDarkMode', isDarkMode);
    localStorage.setItem('themeStyle', themeStyle);
  }, [isDarkMode, themeStyle]);

  const navigateToDashboard = () => {
    setActiveFile(null);
  };

  return (
    <>
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
          />
        )}
      </div>
    </>
  );
}
