import React, { useMemo, useState } from 'react';
import { Folder, File, ChevronRight, Home, Plus, Upload, Sun, Moon } from 'lucide-react';

export default function Dashboard({ library, setLibrary, currentFolderId, setCurrentFolderId, setActiveFile, isDarkMode, setIsDarkMode }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  // Find current folder and its path
  const { currentFolder, path } = useMemo(() => {
    let path = [];
    let currentFolder = null;

    if (!currentFolderId) return { currentFolder: null, path };

    const findFolder = (nodes, currentPath) => {
      for (const node of nodes) {
        if (node.id === currentFolderId) {
          path = [...currentPath, node];
          currentFolder = node;
          return true;
        }
        if (node.type === 'folder' && node.children) {
          if (findFolder(node.children, [...currentPath, node])) return true;
        }
      }
      return false;
    };
    
    findFolder(library || [], []);
    return { currentFolder, path };
  }, [library, currentFolderId]);

  const currentNodes = currentFolder ? currentFolder.children : (library || []);
  const folders = currentNodes.filter(n => n.type === 'folder');
  const files = currentNodes.filter(n => n.type === 'file');

  const addNodeToFolder = (targetId, newNode, currentList) => {
    if (!targetId) return [...currentList, newNode];
    return currentList.map(n => {
      if (n.id === targetId) {
        return { ...n, children: [...(n.children || []), newNode] };
      }
      if (n.type === 'folder') {
        return { ...n, children: addNodeToFolder(targetId, newNode, n.children) };
      }
      return n;
    });
  };

  const handleCreateFolder = () => {
    setNewFolderName('');
    setShowPrompt(true);
  };

  const confirmCreateFolder = (e) => {
    e?.preventDefault();
    if (newFolderName.trim()) {
      const newFolder = { id: Date.now().toString(), type: 'folder', name: newFolderName.trim(), children: [] };
      setLibrary(addNodeToFolder(currentFolderId, newFolder, library));
    }
    setShowPrompt(false);
  };

  const handleAddFiles = async () => {
    const filePaths = await window.api.openFiles();
    if (filePaths && filePaths.length > 0) {
      const newNodes = await Promise.all(filePaths.map(async filePath => ({
        id: Date.now().toString() + Math.random(),
        type: 'file',
        name: await window.api.basename(filePath),
        path: filePath,
        missing: false
      })));
      
      let newLib = library;
      for (const node of newNodes) {
        newLib = addNodeToFolder(currentFolderId, node, newLib);
      }
      setLibrary(newLib);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).map(f => f.path).filter(Boolean);
    if (droppedFiles.length === 0) return;

    const newNodes = droppedFiles.map(filePath => ({
      id: Date.now().toString() + Math.random(),
      type: 'file',
      name: filePath.split(/[/\\]/).pop(),
      path: filePath,
      missing: false
    }));

    let newLib = library;
    for (const node of newNodes) {
      newLib = addNodeToFolder(currentFolderId, node, newLib);
    }
    setLibrary(newLib);
  };

  const breadcrumbs = [
    { name: 'Home', id: null },
    ...path.map(p => ({ name: p.name, id: p.id }))
  ];

  return (
    <div 
      style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '40px 60px' }}
      onDrop={handleDrop} 
      onDragOver={e => e.preventDefault()}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 700, color: 'var(--accent-color)' }}>
          {currentFolder ? currentFolder.name : '3D Viewer'}
        </h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{
              background: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button 
            onClick={handleCreateFolder}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              padding: '10px 20px', borderRadius: '24px', 
              border: '1px solid var(--border-color)', background: 'var(--surface-color)', 
              color: 'var(--accent-color)', fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Plus size={18} /> New Folder
          </button>
          <button 
            onClick={handleAddFiles}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              padding: '10px 20px', borderRadius: '24px', 
              border: 'none', background: 'var(--accent-color)', 
              color: 'var(--accent-text)', fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--shadow-md)'
            }}
          >
            <Upload size={18} /> Add Files
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500 }}>
        {breadcrumbs.map((bc, idx) => (
          <React.Fragment key={idx}>
            <div 
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: idx === breadcrumbs.length - 1 ? 'var(--accent-color)' : 'inherit' }}
              onClick={() => setCurrentFolderId(bc.id)}
            >
              {idx === 0 ? <Home size={16} /> : bc.name}
            </div>
            {idx < breadcrumbs.length - 1 && <ChevronRight size={16} />}
          </React.Fragment>
        ))}
      </div>

      <div style={{ flex: 1 }}>
        {folders.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', color: 'var(--text-main)' }}>Folders</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px' }}>
              {folders.map(folder => (
                <div 
                  key={folder.id} 
                  onClick={() => setCurrentFolderId(folder.id)}
                  style={{
                    background: 'var(--surface-color)',
                    padding: '24px',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    border: '1px solid var(--border-color)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Folder size={32} color="var(--accent-color)" fill="var(--accent-color)" />
                    <span style={{ background: '#F1F5F9', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {folder.children ? folder.children.length : 0} items
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--text-main)', marginTop: '8px' }}>
                    {folder.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {files.length > 0 && (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', color: 'var(--text-main)' }}>Files</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px' }}>
              {files.map(file => (
                <div 
                  key={file.id} 
                  onClick={() => setActiveFile(file)}
                  style={{
                    background: 'var(--surface-color)',
                    padding: '24px',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: file.missing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    border: '1px solid var(--border-color)',
                    opacity: file.missing ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    if (file.missing) return;
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                  onMouseLeave={e => {
                    if (file.missing) return;
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }}
                >
                  <File size={32} color="#3B82F6" strokeWidth={1.5} />
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)', marginTop: '8px', wordBreak: 'break-all' }}>
                    {file.name}
                  </div>
                  {file.missing && <div style={{ color: '#EF4444', fontSize: '12px', fontWeight: 500 }}>File missing</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {folders.length === 0 && files.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)' }}>
            <Folder size={64} style={{ opacity: 0.2, marginBottom: '16px' }} />
            <p style={{ fontSize: '16px', fontWeight: 500 }}>This folder is empty</p>
            <p style={{ fontSize: '14px', opacity: 0.7 }}>Drag and drop files here or click "Add Files"</p>
          </div>
        )}
      </div>

      {showPrompt && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form 
            onSubmit={confirmCreateFolder}
            style={{ background: 'var(--surface-color)', padding: '24px', borderRadius: '12px', width: '320px', boxShadow: 'var(--shadow-lg)' }}
          >
            <h3 style={{ margin: '0 0 16px 0' }}>New Folder</h3>
            <input 
              autoFocus
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Folder name..."
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setShowPrompt(false)} style={{ padding: '6px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, color: 'var(--text-muted)' }}>Cancel</button>
              <button type="submit" style={{ padding: '6px 16px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
