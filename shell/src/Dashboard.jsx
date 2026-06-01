import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Folder, File, ChevronRight, Home, Plus, Upload, Sun, Moon, Cat, Brush, Search, Box, Image, Code, FileBox, Type, Edit2, Trash2, ListFilter } from 'lucide-react';
import Fuse from 'fuse.js';
import MusicPlayer from './MusicPlayer';
import ThemeDropdown from './ThemeDropdown';

export default function Dashboard({ library, setLibrary, currentFolderId, setCurrentFolderId, setActiveFile, isDarkMode, setIsDarkMode, themeStyle, setThemeStyle, gtaTheme, setGtaTheme }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [nodeToDelete, setNodeToDelete] = useState(null);
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc'
  const [isSortOpen, setIsSortOpen] = useState(false);
  const hasFetchedSizes = useRef(false);

  useEffect(() => {
    if (!library || hasFetchedSizes.current) return;
    let changed = false;
    const fetchSizes = async (nodes) => {
      return Promise.all(nodes.map(async node => {
        if (node.type === 'file' && typeof node.size === 'undefined') {
          const stats = await window.api.getFileSize(node.path);
          changed = true;
          return { ...node, size: stats ? stats.size : 0 };
        }
        if (node.type === 'folder' && node.children) {
          const newChildren = await fetchSizes(node.children);
          return { ...node, children: newChildren };
        }
        return node;
      }));
    };
    fetchSizes(library).then(newLib => {
      if (changed) setLibrary(newLib);
      hasFetchedSizes.current = true;
    });
  }, [library, setLibrary]);
  
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
  
  const sortNodes = (nodes) => {
    return [...nodes].sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'size-desc') return (b.size || 0) - (a.size || 0);
      if (sortBy === 'size-asc') return (a.size || 0) - (b.size || 0);
      if (sortBy === 'oldest') return (parseFloat(a.id) || 0) - (parseFloat(b.id) || 0);
      return (parseFloat(b.id) || 0) - (parseFloat(a.id) || 0); // newest by default
    });
  };

  const folders = sortNodes(currentNodes.filter(n => n.type === 'folder'));
  const files = sortNodes(currentNodes.filter(n => n.type === 'file'));

  // Search Logic
  const allFiles = useMemo(() => {
    const flatFiles = [];
    const traverse = (nodes) => {
      for (const node of nodes) {
        if (node.type === 'file') flatFiles.push(node);
        else if (node.type === 'folder' && node.children) traverse(node.children);
      }
    };
    traverse(library || []);
    return flatFiles;
  }, [library]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const fuse = new Fuse(allFiles, { keys: ['name'], threshold: 0.3 });
    return fuse.search(searchQuery).map(res => res.item);
  }, [searchQuery, allFiles]);

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

  const renameNodeInFolder = (nodeId, newName, currentList) => {
    return currentList.map(n => {
      if (n.id === nodeId) {
        return { ...n, name: newName };
      }
      if (n.type === 'folder') {
        return { ...n, children: renameNodeInFolder(nodeId, newName, n.children) };
      }
      return n;
    });
  };

  const handleRenameSubmit = (e, nodeId) => {
    e.stopPropagation();
    e.preventDefault();
    if (editingName.trim()) {
      setLibrary(renameNodeInFolder(nodeId, editingName.trim(), library));
    }
    setEditingNodeId(null);
  };

  const deleteNodeFromFolder = (nodeId, currentList) => {
    return currentList
      .filter(n => n.id !== nodeId)
      .map(n => {
        if (n.type === 'folder' && n.children) {
          return { ...n, children: deleteNodeFromFolder(nodeId, n.children) };
        }
        return n;
      });
  };

  const handleDelete = (e, nodeId) => {
    e.stopPropagation();
    setNodeToDelete(nodeId);
  };

  const confirmDeleteNode = () => {
    if (nodeToDelete) {
      setLibrary(deleteNodeFromFolder(nodeToDelete, library));
      setNodeToDelete(null);
    }
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
      const newNodes = await Promise.all(filePaths.map(async filePath => {
        const stats = await window.api.getFileSize(filePath);
        return {
          id: Date.now().toString() + Math.random(),
          type: 'file',
          name: await window.api.basename(filePath),
          path: filePath,
          missing: false,
          size: stats ? stats.size : 0
        };
      }));
      
      let newLib = library;
      for (const node of newNodes) {
        newLib = addNodeToFolder(currentFolderId, node, newLib);
      }
      setLibrary(newLib);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).map(f => f.path).filter(Boolean);
    if (droppedFiles.length === 0) return;

    const newNodes = await Promise.all(droppedFiles.map(async filePath => {
      const stats = await window.api.getFileSize(filePath);
      return {
        id: Date.now().toString() + Math.random(),
        type: 'file',
        name: filePath.split(/[/\\]/).pop(),
        path: filePath,
        missing: false,
        size: stats ? stats.size : 0
      };
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

  const getFileIconInfo = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
      case 'stl': return { Icon: Box, color: '#10B981' };
      case 'obj': return { Icon: FileBox, color: '#F59E0B' };
      case '3dm': return { Icon: Box, color: '#3B82F6' };
      case 'fbx': return { Icon: Image, color: '#8B5CF6' };
      case 'gltf':
      case 'glb': return { Icon: Code, color: '#EC4899' };
      default: return { Icon: File, color: '#3B82F6' };
    }
  };

  return (
    <div 
      style={{ 
        flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', padding: '40px 60px',
        position: 'relative'
      }}
      onDrop={handleDrop} 
      onDragOver={e => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={e => {
        e.preventDefault();
        setIsDragging(false);
      }}
    >
      {isDragging && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(59, 130, 246, 0.2)',
          backdropFilter: 'blur(2px)',
          border: '4px dashed var(--accent-color)',
          zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none'
        }}>
          <h2 style={{ fontSize: '32px', color: 'var(--accent-color)', fontWeight: 'bold' }}>Drop Files to Upload</h2>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '36px', 
          fontWeight: 700, 
          color: 'var(--accent-color)', 
          textShadow: themeStyle === 'cartoon' ? '3px 3px 0px var(--border-color)' : undefined,
          WebkitTextStroke: themeStyle === 'cartoon' ? '1.5px var(--border-color)' : undefined,
          fontFamily: themeStyle === 'cartoon' ? "'Fredoka', cursive" : "inherit"
        }}>
          {currentFolder ? currentFolder.name : '3D Viewer'}
        </h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {themeStyle === 'barbie' && (
            <div style={{ fontSize: '12px', color: 'var(--text-main)', background: 'var(--surface-color)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              Credit: <a href="https://www.youtube.com/watch?v=ZyhrYis509A" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>Aqua - Barbie Girl</a>
            </div>
          )}
          {themeStyle === 'gta' && (
            <div style={{ fontSize: '12px', color: 'var(--text-main)', background: 'var(--surface-color)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              Credit: {gtaTheme === 'vice_city' && <a href="https://www.youtube.com/watch?v=F2_pg8xd1To" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>GTA Vice City Theme</a>}
              {gtaTheme === 'san_andreas' && <a href="https://www.youtube.com/watch?v=W4VTq0sa9yg" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>GTA San Andreas Theme</a>}
              {gtaTheme === 'gta4' && <a href="https://www.youtube.com/watch?v=pWO718iy5mY" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>GTA IV Theme</a>}
              {gtaTheme === 'gta5' && <a href="https://www.youtube.com/watch?v=KzKvPrIPVbE" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>GTA V Theme</a>}
            </div>
          )}
          {themeStyle === 'ghibli' && (
            <div style={{ fontSize: '12px', color: 'var(--text-main)', background: 'var(--surface-color)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              Credit: {!isDarkMode ? (
                <a href="https://www.youtube.com/watch?v=MZgBjQFMPvk" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>Path of the Wind</a>
              ) : (
                <a href="https://www.youtube.com/watch?v=5e65bwX5uOM" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>Meguru Kisetsu</a>
              )}
            </div>
          )}
          {themeStyle === 'retro' && (
            <div style={{ fontSize: '12px', color: 'var(--text-main)', background: 'var(--surface-color)', padding: '4px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              Credit: <a href="https://www.youtube.com/watch?v=RP0_8J7uxhs" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>Laura Branigan - Self Control</a>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface-color)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
            <ThemeDropdown themeStyle={themeStyle} setThemeStyle={setThemeStyle} />
            
            {themeStyle === 'gta' ? (
              <div style={{ display: 'flex', gap: '4px', marginLeft: '4px', borderLeft: '1px solid var(--border-color)', paddingLeft: '8px' }}>
                {['vice_city', 'san_andreas', 'gta4', 'gta5'].map(theme => (
                  <button
                    key={theme}
                    onClick={() => setGtaTheme(theme)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      background: gtaTheme === theme ? 'var(--accent-color)' : 'transparent',
                      color: gtaTheme === theme ? '#fff' : 'var(--text-muted)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {theme === 'vice_city' ? 'VC' : theme === 'san_andreas' ? 'SA' : theme === 'gta4' ? 'IV' : 'V'}
                  </button>
                ))}
              </div>
            ) : (
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
                {themeStyle === 'ghibli' ? (
                  isDarkMode ? <Brush size={20} /> : <Cat size={20} />
                ) : (
                  isDarkMode ? <Sun size={20} /> : <Moon size={20} />
                )}
              </button>
            )}
          </div>
          <MusicPlayer themeStyle={themeStyle} isDarkMode={isDarkMode} gtaTheme={gtaTheme} />
          
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-color)', padding: '4px 12px', borderRadius: '24px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
            <Search size={18} color="var(--text-muted)" style={{ marginRight: '8px' }} />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-main)',
                width: '150px',
                fontFamily: 'inherit',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <div 
              onClick={() => setIsSortOpen(!isSortOpen)}
              style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-color)', padding: '6px 16px', borderRadius: '24px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
            >
              <ListFilter size={18} color="var(--text-muted)" />
              <span style={{ color: 'var(--text-main)', fontSize: '14px', fontWeight: 500 }}>
                {sortBy === 'newest' && 'Newest'}
                {sortBy === 'oldest' && 'Oldest'}
                {sortBy === 'name-asc' && 'Name (A-Z)'}
                {sortBy === 'name-desc' && 'Name (Z-A)'}
                {sortBy === 'size-desc' && 'Size (Large)'}
                {sortBy === 'size-asc' && 'Size (Small)'}
              </span>
            </div>
            
            {isSortOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                background: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-lg)',
                padding: '8px',
                minWidth: '160px',
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                {[
                  { id: 'newest', label: 'Newest First' },
                  { id: 'oldest', label: 'Oldest First' },
                  { id: 'name-asc', label: 'Name (A-Z)' },
                  { id: 'name-desc', label: 'Name (Z-A)' },
                  { id: 'size-desc', label: 'Size (Largest First)' },
                  { id: 'size-asc', label: 'Size (Smallest First)' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => { setSortBy(opt.id); setIsSortOpen(false); }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: sortBy === opt.id ? 'var(--accent-color)' : 'transparent',
                      color: sortBy === opt.id ? '#fff' : 'var(--text-main)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '14px',
                      transition: 'all 0.2s',
                      fontWeight: sortBy === opt.id ? 600 : 400
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

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

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px', color: 'var(--text-muted)', fontSize: '15px', fontWeight: 600 }}>
        {breadcrumbs.map((bc, idx) => (
          <React.Fragment key={idx}>
            <div 
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: idx === breadcrumbs.length - 1 ? 'var(--accent-color)' : 'inherit' }}
              onClick={() => setCurrentFolderId(bc.id)}
            >
              {idx === 0 ? <Home size={22} strokeWidth={2.5} /> : bc.name}
            </div>
            {idx < breadcrumbs.length - 1 && <ChevronRight size={18} strokeWidth={2.5} />}
          </React.Fragment>
        ))}
      </div>

      <div style={{ flex: 1 }}>
        {searchQuery.trim() ? (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', color: 'var(--text-main)' }}>Search Results</h2>
            {searchResults.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No files match your search.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
                {searchResults.map(file => {
                  const { Icon, color } = getFileIconInfo(file.name);
                  return (
                  <div 
                    key={file.id} 
                    onClick={() => setActiveFile(file.path)}
                    style={{
                      background: 'var(--surface-color)',
                      padding: '20px',
                      borderRadius: '16px',
                      boxShadow: 'var(--shadow-md)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      border: '1px solid var(--border-color)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                    }}
                  >
                    <Icon size={32} color={color} strokeWidth={1.5} />
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)', marginTop: '8px', paddingTop: '12px', borderTop: '2px dashed var(--border-color)', wordBreak: 'break-all', width: '100%', textAlign: 'center' }}>
                      {file.name}
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>
        ) : (
          <>
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
                    boxShadow: 'var(--shadow-md)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    border: '1px solid var(--border-color)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {themeStyle === 'cartoon' ? (
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--accent-color)" stroke="var(--border-color)" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        <circle cx="9" cy="13" r="1.5" fill="#000"></circle>
                        <circle cx="15" cy="13" r="1.5" fill="#000"></circle>
                        <path d="M10 16c1.5 1.5 2.5 1.5 4 0" stroke="#000" strokeWidth="1.5" strokeLinecap="round"></path>
                      </svg>
                    ) : (
                      <Folder size={32} color="var(--accent-color)" fill="var(--accent-color)" />
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#F1F5F9', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                        {folder.children ? folder.children.length : 0} items
                      </span>
                      <div 
                        onClick={e => handleDelete(e, folder.id)}
                        style={{ cursor: 'pointer', padding: '4px', color: '#EF4444', opacity: 0.7 }}
                        title="Delete folder"
                      >
                        <Trash2 size={16} />
                      </div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--text-main)', marginTop: '8px', paddingTop: '12px', borderTop: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {editingNodeId === folder.id ? (
                      <form onSubmit={e => handleRenameSubmit(e, folder.id)} style={{ display: 'flex', width: '100%', gap: '4px' }}>
                        <input 
                          autoFocus
                          value={editingName} 
                          onChange={e => setEditingName(e.target.value)} 
                          onClick={e => e.stopPropagation()}
                          style={{ width: '100%', padding: '2px 4px', fontSize: '14px', borderRadius: '4px', border: '1px solid var(--accent-color)', outline: 'none' }}
                        />
                      </form>
                    ) : (
                      <>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                        <div 
                          onClick={e => { e.stopPropagation(); setEditingNodeId(folder.id); setEditingName(folder.name); }}
                          style={{ cursor: 'pointer', opacity: 0.5, padding: '4px' }}
                        >
                          <Edit2 size={14} />
                        </div>
                      </>
                    )}
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
              {files.map(file => {
                const { Icon, color } = getFileIconInfo(file.name);
                return (
                <div 
                  key={file.id} 
                  onClick={() => setActiveFile(file)}
                  style={{
                    background: 'var(--surface-color)',
                    padding: '24px',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-md)',
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
                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                  }}
                  onMouseLeave={e => {
                    if (file.missing) return;
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                >
                  {themeStyle === 'cartoon' ? (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="#ffffff" stroke="var(--border-color)" strokeWidth="2">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                      <polyline points="13 2 13 9 20 9"></polyline>
                      <circle cx="9" cy="14" r="1.5" fill="#000"></circle>
                      <circle cx="15" cy="14" r="1.5" fill="#000"></circle>
                      <path d="M10 17c1.5 1.5 2.5 1.5 4 0" stroke="#000" strokeWidth="1.5" strokeLinecap="round"></path>
                    </svg>
                  ) : (
                    <Icon size={32} color={color} strokeWidth={1.5} />
                  )}
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)', marginTop: '8px', paddingTop: '12px', borderTop: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {editingNodeId === file.id ? (
                      <form onSubmit={e => handleRenameSubmit(e, file.id)} style={{ display: 'flex', width: '100%', gap: '4px' }}>
                        <input 
                          autoFocus
                          value={editingName} 
                          onChange={e => setEditingName(e.target.value)} 
                          onClick={e => e.stopPropagation()}
                          style={{ width: '100%', padding: '2px 4px', fontSize: '14px', borderRadius: '4px', border: '1px solid var(--accent-color)', outline: 'none' }}
                        />
                      </form>
                    ) : (
                      <>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div 
                            onClick={e => { e.stopPropagation(); setEditingNodeId(file.id); setEditingName(file.name); }}
                            style={{ cursor: 'pointer', opacity: 0.5, padding: '4px' }}
                            title="Rename"
                          >
                            <Edit2 size={14} />
                          </div>
                          <div 
                            onClick={e => handleDelete(e, file.id)}
                            style={{ cursor: 'pointer', opacity: 0.7, padding: '4px', color: '#EF4444' }}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {file.missing && <div style={{ color: '#EF4444', fontSize: '12px', fontWeight: 500 }}>File missing</div>}
                </div>
              )})}
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
          </>
        )}
      </div>

      {showPrompt && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form 
            onSubmit={confirmCreateFolder}
            style={{ background: 'var(--surface-color)', padding: '24px', borderRadius: '12px', width: '320px', boxShadow: 'var(--shadow-lg)' }}
          >
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-main)' }}>New Folder</h3>
            <input 
              autoFocus
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Folder name..."
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', boxSizing: 'border-box', background: 'transparent', color: 'var(--text-main)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setShowPrompt(false)} style={{ padding: '6px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, color: 'var(--text-muted)' }}>Cancel</button>
              <button type="submit" style={{ padding: '6px 16px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Create</button>
            </div>
          </form>
        </div>
      )}

      {nodeToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface-color)', padding: '24px', borderRadius: '12px', width: '320px', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-main)' }}>Delete Item?</h3>
            <p style={{ margin: '0 0 24px 0', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.5 }}>
              Are you sure you want to remove this item from the library? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setNodeToDelete(null)} style={{ padding: '6px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={confirmDeleteNode} style={{ padding: '6px 16px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* GitHub Credit Footer */}
      <div style={{ position: 'absolute', bottom: '16px', right: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Powered by</span>
        <a 
          href="https://github.com/kovacsv/Online3DViewer" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px',
            color: 'var(--text-main)', 
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 600,
            background: 'var(--surface-color)',
            padding: '4px 8px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
          </svg>
          Online3DViewer
        </a>
      </div>
    </div>
  );
}
