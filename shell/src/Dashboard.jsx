import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Folder, File, ChevronRight, Home, Plus, Upload, Sun, Moon, Cat, Brush, Search, Box, Image, Code, FileBox, Type, Edit2, Trash2, ListFilter, Check, Star, LayoutGrid, List } from 'lucide-react';
import Fuse from 'fuse.js';

import ThemeDropdown from './ThemeDropdown';
import DuplicateManager from './DuplicateManager';
import VirtualFileList from './VirtualFileList';
import VirtualFileGrid from './VirtualFileGrid';
import FilterDropdown from './FilterDropdown';

export default function Dashboard({ library, setLibrary, currentFolderId, setCurrentFolderId, setActiveFile, isDarkMode, setIsDarkMode, themeStyle, setThemeStyle, gtaTheme, setGtaTheme, isCommunistSpedUp, setIsCommunistSpedUp, isMilesMorales, setIsMilesMorales, isSpiderVerse, setIsSpiderVerse, isUssrTheme, setIsUssrTheme, isUssrAlt, setIsUssrAlt }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [duplicateData, setDuplicateData] = useState(null);
  const [resolvingDuplicates, setResolvingDuplicates] = useState(null);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [nodeToDelete, setNodeToDelete] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState('folders');
  const [filterExt, setFilterExt] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const hasFetchedSizes = useRef(false);

  useEffect(() => {
    if (window.api.onUploadProgress) {
      return window.api.onUploadProgress(progress => setUploadProgress(progress));
    }
  }, []);

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

  let baseNodes = currentFolder ? currentFolder.children : (library || []);
  
  if (activeSidebarTab === 'favorites') {
    const allFavs = [];
    const findFavs = (nodes) => {
      for (let n of nodes) {
        if (n.type === 'file' && n.isFavorite) allFavs.push(n);
        if (n.children) findFavs(n.children);
      }
    };
    findFavs(library || []);
    baseNodes = allFavs;
  }

  if (filterExt !== 'all') {
    baseNodes = baseNodes.filter(n => n.type === 'folder' || n.name.toLowerCase().endsWith('.' + filterExt));
  }

  const sortNodes = (nodes) => {
    return [...nodes].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      
      const getTimestamp = (id) => {
        const parts = id.toString().split('_');
        return parseInt(parts[1] || '0', 10);
      };

      if (sortBy === 'newest' || sortBy === 'oldest') {
        const aTime = getTimestamp(a.id);
        const bTime = getTimestamp(b.id);
        return sortBy === 'oldest' ? aTime - bTime : bTime - aTime;
      }
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'size-desc') return (b.size || 0) - (a.size || 0);
      if (sortBy === 'size-asc') return (a.size || 0) - (b.size || 0);
      return 0;
    });
  };

  const folders = sortNodes(baseNodes.filter(n => n.type === 'folder'));
  const files = sortNodes(baseNodes.filter(n => n.type === 'file'));
  const allCurrentItems = [...folders, ...files];

  useEffect(() => {
    setSelectedNodes([]);
    setLastSelectedIndex(null);
  }, [currentFolderId, searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showPrompt || editingNodeId || nodeToDelete) return; // don't trigger if modal/editing
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSelectedNodes(allCurrentItems.map(item => item.id));
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodes.length > 0) {
          e.preventDefault();
          setNodeToDelete('multiple');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allCurrentItems, selectedNodes, showPrompt, editingNodeId, nodeToDelete]);

  const handleNodeClick = (e, node, index) => {
    e.stopPropagation();
    if (isMultiSelectMode) {
      if (e.shiftKey && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        const newSelection = allCurrentItems.slice(start, end + 1).map(n => n.id);
        const uniqueSelection = Array.from(new Set([...selectedNodes, ...newSelection]));
        setSelectedNodes(uniqueSelection);
      } else {
        setSelectedNodes(prev => 
          prev.includes(node.id) ? prev.filter(id => id !== node.id) : [...prev, node.id]
        );
        setLastSelectedIndex(index);
      }
    } else {
      setSelectedNodes([node.id]);
      setLastSelectedIndex(index);
      if (node.type === 'folder') {
        setCurrentFolderId(node.id);
      } else {
        setActiveFile(node);
      }
    }
  };



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
      .filter(n => {
        if (Array.isArray(nodeId)) return !nodeId.includes(n.id);
        return n.id !== nodeId;
      })
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

  const confirmDeleteNode = async () => {
    if (nodeToDelete) {
      if (nodeToDelete === 'multiple') {
        const pathsToDelete = [];
        const findPaths = (nodes, shouldDeleteAll) => {
          for (const node of nodes) {
            const isSelected = shouldDeleteAll || selectedNodes.includes(node.id);
            if (isSelected && node.type === 'file') pathsToDelete.push(node.path);
            if (node.children) findPaths(node.children, isSelected);
          }
        };
        findPaths(library, false);
        if (pathsToDelete.length > 0) await window.api.deleteFile(pathsToDelete);
        setLibrary(deleteNodeFromFolder(selectedNodes, library));
        setSelectedNodes([]);
        setIsMultiSelectMode(false);
      } else {
        const findNode = (nodes, id) => {
          for (const n of nodes) {
            if (n.id === id) return n;
            if (n.children) {
              const found = findNode(n.children, id);
              if (found) return found;
            }
          }
          return null;
        };
        const node = findNode(library, nodeToDelete);
        const pathsToDelete = [];
        const findPathsSingle = (n) => {
          if (n.type === 'file') pathsToDelete.push(n.path);
          if (n.children) n.children.forEach(findPathsSingle);
        };
        if (node) findPathsSingle(node);
        if (pathsToDelete.length > 0) {
          await window.api.deleteFile(pathsToDelete);
        }
        setLibrary(deleteNodeFromFolder(nodeToDelete, library));
      }
      setNodeToDelete(null);
    }
  };

  const toggleFavorite = (e, nodeId) => {
    e.stopPropagation();
    const newLib = JSON.parse(JSON.stringify(library));
    const findAndToggle = (nodes) => {
      for (let n of nodes) {
        if (n.id === nodeId) {
          n.isFavorite = !n.isFavorite;
          return true;
        }
        if (n.children && findAndToggle(n.children)) return true;
      }
      return false;
    };
    findAndToggle(newLib);
    setLibrary(newLib);
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
      setIsProcessingFiles(true);
      try {
        let finalFiles = [];
        let archiveMappings = {};
        for (const filePath of filePaths) {
          const ext = filePath.split('.').pop().toLowerCase();
          if (ext === 'zip' || ext === 'rar') {
            const extracted = await window.api.extractArchive(filePath);
            for (const item of extracted) {
              finalFiles.push(item.absolutePath);
              archiveMappings[item.absolutePath] = item.relativePath;
            }
          } else {
            finalFiles.push(filePath);
          }
        }
        if (finalFiles.length === 0) return setIsProcessingFiles(false);

        const result = await window.api.checkDuplicates(finalFiles);
        
        const libraryPaths = new Set();
        const collectPaths = (nodes) => {
          for (const n of nodes) {
            if (n.type === 'file') libraryPaths.add(n.path);
            if (n.children) collectPaths(n.children);
          }
        };
        collectPaths(library || []);
        
        const realDuplicates = [];
        const orphansToDelete = [];
        for (const dup of result.duplicates) {
           if (libraryPaths.has(dup.existingPath)) {
              realDuplicates.push({ ...dup, relativePath: archiveMappings[dup.path] });
           } else {
              orphansToDelete.push(dup.existingPath);
              result.nonDuplicates.push({
                 original: dup.original,
                 path: dup.path,
                 hash: dup.hash,
                 relativePath: archiveMappings[dup.path]
              });
           }
        }
        
        if (orphansToDelete.length > 0) {
           await window.api.deleteFile(orphansToDelete);
        }
        
        const nonDupsWithPaths = result.nonDuplicates.map(nd => ({ ...nd, relativePath: archiveMappings[nd.path] }));

        if (realDuplicates.length > 0) {
          setDuplicateData({ duplicates: realDuplicates, nonDuplicates: nonDupsWithPaths });
        } else {
          await commitAndAddNodes(nonDupsWithPaths, false);
        }
      } catch (err) {
        console.error('Failed to process files:', err);
      } finally {
        setIsProcessingFiles(false);
        setUploadProgress(null);
      }
    }
  };

  const commitAndAddNodes = async (files, forceKeep) => {
    try {
      const copiedPaths = await window.api.commitImport(files, forceKeep);
      let newLib = library || [];

      for (let idx = 0; idx < copiedPaths.length; idx++) {
        const newPath = copiedPaths[idx];
        const fileObj = files[idx];
        const relativePath = fileObj.relativePath;
        
        const newNodeName = newPath.split(/[/\\]/).pop().replace(/^\d{13}_/, '');
        const originalName = fileObj.original || newNodeName;
        
        let suffix = '';
        if (newNodeName !== originalName && originalName.includes('.')) {
            const lastDot = originalName.lastIndexOf('.');
            const base = originalName.substring(0, lastDot);
            const newBase = newNodeName.substring(0, newNodeName.lastIndexOf('.'));
            if (newBase.startsWith(base)) {
                suffix = newBase.substring(base.length); // e.g. "(1D)"
            }
        }
        
        let targetFolderId = currentFolderId;

        if (relativePath && relativePath.includes('/')) {
          const parts = relativePath.split('/');
          parts.pop(); // remove filename
          
          if (suffix && parts.length > 0) {
             parts[0] = parts[0] + suffix;
          }
          
          for (const part of parts) {
            const findFolderInTarget = (nodes, targetId, folderName) => {
              if (!targetId) return nodes.find(n => n.type === 'folder' && n.name === folderName);
              const target = nodes.find(n => n.id === targetId);
              if (target && target.children) {
                 return target.children.find(n => n.type === 'folder' && n.name === folderName);
              }
              for (const n of nodes) {
                if (n.type === 'folder' && n.children) {
                   const found = findFolderInTarget(n.children, targetId, folderName);
                   if (found) return found;
                }
              }
              return null;
            };

            let existingFolder = findFolderInTarget(newLib, targetFolderId, part);
            
            if (existingFolder) {
              targetFolderId = existingFolder.id;
            } else {
              const newFolderId = 'folder_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
              const newFolder = { id: newFolderId, type: 'folder', name: part, children: [] };
              newLib = addNodeToFolder(targetFolderId, newFolder, newLib);
              targetFolderId = newFolderId;
            }
          }
        }

        const newNode = {
          id: 'file_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 5),
          type: 'file',
          name: newNodeName,
          path: newPath,
          missing: false
        };
        newLib = addNodeToFolder(targetFolderId, newNode, newLib);
      }
      
      setLibrary(newLib);
    } catch (err) {
      console.error('Failed to commit import:', err);
      alert('Failed to commit import: ' + err.message);
    }
  };

  const handleDuplicateResolutionComplete = async (results) => {
    const nonDups = duplicateData?.nonDuplicates || [];
    
    const toKeepBoth = results.filter(r => r.action === 'keep_both');
    const toReplace = results.filter(r => r.action === 'replace');
    
    setResolvingDuplicates(null);
    setDuplicateData(null);

    if (toReplace.length > 0) {
      await window.api.replaceFiles(toReplace);
      
      const updateNodeRecursively = (nodes) => {
        return nodes.map(node => {
          if (node.type === 'file') {
            const replaceAction = toReplace.find(r => r.existingPath === node.path);
            if (replaceAction) {
              return { ...node, name: replaceAction.original };
            }
          }
          if (node.type === 'folder' && node.children) {
            return { ...node, children: updateNodeRecursively(node.children) };
          }
          return node;
        });
      };
      
      setLibrary(prev => updateNodeRecursively(prev));
    }
    


    if (toKeepBoth.length > 0) {
      finalList = finalList.concat(toKeepBoth.map(f => ({ ...f, forceKeep: true })));
    }
    
    if (nonDups.length > 0) {
      finalList = finalList.concat(nonDups.map(f => ({ ...f, forceKeep: false })));
    }
    
    if (finalList.length > 0) {
      await commitAndAddNodes(finalList, false);
    }
  };


  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).map(f => window.api.getFilePath(f)).filter(Boolean);
    if (droppedFiles.length === 0) return;

    setIsProcessingFiles(true);
    try {
      let finalFiles = [];
      for (const filePath of droppedFiles) {
        const ext = filePath.split('.').pop().toLowerCase();
        if (ext === 'zip' || ext === 'rar') {
          const extracted = await window.api.extractArchive(filePath);
          finalFiles.push(...extracted);
        } else {
          finalFiles.push(filePath);
        }
      }
      if (finalFiles.length === 0) return setIsProcessingFiles(false);

      const result = await window.api.checkDuplicates(finalFiles);
      if (result.duplicates.length > 0) {
        setDuplicateData(result);
      } else {
        await commitAndAddNodes(result.nonDuplicates, false);
      }
    } catch (err) {
      console.error('Failed to process dropped files:', err);
    } finally {
      setIsProcessingFiles(false);
      setUploadProgress(null);
    }
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
      onClick={() => setSelectedNodes([])}
      onDrop={handleDrop} 
      onDragEnter={e => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      }}
      onDragOver={e => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
      }}
      onDragLeave={e => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
      }}
    >
      {isProcessingFiles && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: '#fff'
        }}>
          <h2 style={{ fontSize: '24px', marginBottom: '24px' }}>
            {uploadProgress ? `Processing files... ${uploadProgress.current}/${uploadProgress.total} done` : 'Files are being uploaded and processed...'}
          </h2>
          <div style={{ width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
      )}

      {resolvingDuplicates && (
        <DuplicateManager
          duplicates={resolvingDuplicates}
          isDarkMode={isDarkMode}
          themeStyle={themeStyle}
          onComplete={handleDuplicateResolutionComplete}
          onCancel={() => {
            setResolvingDuplicates(null);
            const nonDups = duplicateData.nonDuplicates || [];
            setDuplicateData(null);
            if (nonDups.length > 0) commitAndAddNodes(nonDups, false);
          }}
        />
      )}

      {duplicateData && !resolvingDuplicates && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg-color)', padding: '32px', borderRadius: '16px',
            width: '500px', maxWidth: '90%', color: 'var(--text-main)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '20px' }}>These files already exist</h2>
            <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
              We found {duplicateData.duplicates.length} duplicate file(s).
            </p>
            <div style={{
              maxHeight: '150px', overflowY: 'auto', marginBottom: '24px',
              background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px'
            }}>
              {duplicateData.duplicates.map((d, i) => (
                <div key={i} style={{ marginBottom: '8px', fontSize: '14px' }}>
                  <strong>{d.original}</strong>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setResolvingDuplicates(duplicateData.duplicates)}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)',
                  background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 500
                }}
              >
                View them
              </button>
              <button 
                onClick={() => {
                  const nonDups = duplicateData.nonDuplicates;
                  setDuplicateData(null);
                  if (nonDups.length > 0) commitAndAddNodes(nonDups, false);
                }}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)',
                  background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 500
                }}
              >
                Remove them
              </button>
              <button 
                onClick={() => {
                  const allFiles = [
                    ...duplicateData.nonDuplicates.map(f => ({ ...f, forceKeep: false })),
                    ...duplicateData.duplicates.map(f => ({ ...f, forceKeep: true }))
                  ];
                  setDuplicateData(null);
                  commitAndAddNodes(allFiles, false);
                }}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none',
                  background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', fontWeight: 500
                }}
              >
                Keep them
              </button>
            </div>
          </div>
        </div>
      )}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', position: 'relative', zIndex: 50 }}>
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
            {themeStyle === 'communist' && (
              <button
                onClick={() => {
                  if (!isUssrTheme) {
                    setIsUssrTheme(true);
                    setIsUssrAlt(false);
                  } else if (!isUssrAlt) {
                    setIsUssrAlt(true);
                  } else {
                    setIsUssrTheme(false);
                    setIsUssrAlt(false);
                  }
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  padding: '2px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isUssrTheme ? 1 : 0.6,
                  transition: 'opacity 0.2s',
                  marginLeft: '4px'
                }}
                title="Toggle USSR Easter Egg"
              >
                <span style={{ fontSize: '16px' }}>☭</span>
              </button>
            )}
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
                onClick={() => {
                  if (themeStyle === 'communist') {
                    setIsCommunistSpedUp(!isCommunistSpedUp);
                  } else if (themeStyle === 'spiderman') {
                    setIsMilesMorales(!isMilesMorales);
                  } else {
                    setIsDarkMode(!isDarkMode);
                  }
                }}
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
                title={themeStyle === 'communist' ? "Toggle Communist Mode" : "Toggle Theme"}
              >
                {themeStyle === 'communist' ? (
                  <img 
                    key={isCommunistSpedUp ? 'spedup' : 'normal'}
                    src={hammerSickleSvg} 
                    alt="Hammer and Sickle"
                    width="24" height="24"
                    className="spin-once"
                  />
                ) : themeStyle === 'spiderman' ? (
                  <img 
                    key={isMilesMorales ? 'miles' : 'peter'}
                    src={spiderSvg} 
                    alt="Spider"
                    width="24" height="24"
                  />
                ) : themeStyle === 'ghibli' ? (
                  isDarkMode ? <Brush size={20} /> : <Cat size={20} />
                ) : (
                  isDarkMode ? <Sun size={20} /> : <Moon size={20} />
                )}
              </button>
            )}
          </div>

          
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

          <div style={{ display: 'flex', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
            <div 
              onClick={() => { setActiveSidebarTab('folders'); setCurrentFolderId(null); }}
              title="Home"
              style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: activeSidebarTab === 'folders' ? 'var(--accent-color)' : 'transparent', color: activeSidebarTab === 'folders' ? '#fff' : 'var(--text-muted)' }}
            ><Home size={16} /> Home</div>
            <div 
              onClick={() => { setActiveSidebarTab('favorites'); setCurrentFolderId(null); }}
              title="Favorites"
              style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: activeSidebarTab === 'favorites' ? 'var(--accent-color)' : 'transparent', color: activeSidebarTab === 'favorites' ? '#fff' : 'var(--text-muted)' }}
            ><Star size={16} /> Favorites</div>
          </div>

          <FilterDropdown filterExt={filterExt} setFilterExt={setFilterExt} />

          <div style={{ display: 'flex', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
            <div 
              onClick={() => setViewMode('grid')}
              title="Grid View"
              style={{ padding: '8px', cursor: 'pointer', background: viewMode === 'grid' ? 'var(--accent-color)' : 'transparent', color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)' }}
            ><LayoutGrid size={18} /></div>
            <div 
              onClick={() => setViewMode('list')}
              title="List View"
              style={{ padding: '8px', cursor: 'pointer', background: viewMode === 'list' ? 'var(--accent-color)' : 'transparent', color: viewMode === 'list' ? '#fff' : 'var(--text-muted)' }}
            ><List size={18} /></div>
          </div>

          <div style={{ position: 'relative' }}>
            <button 
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
            </button>
            
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
            onClick={() => {
              setIsMultiSelectMode(!isMultiSelectMode);
              if (isMultiSelectMode) setSelectedNodes([]);
            }}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              padding: '10px 20px', borderRadius: '24px', 
              border: '1px solid var(--border-color)', background: isMultiSelectMode ? 'var(--accent-color)' : 'var(--surface-color)', 
              color: isMultiSelectMode ? '#fff' : 'var(--accent-color)', fontWeight: 600, cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.2s'
            }}
          >
            <ListFilter size={18} /> {isMultiSelectMode ? 'Cancel Selection' : 'Select Multiple Files'}
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

      { (selectedNodes.length > 0 || isMultiSelectMode) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--accent-color)', borderRadius: '12px', padding: '12px 24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontWeight: 600, color: 'var(--accent-color)' }}>{selectedNodes.length} item(s) selected</span>
            <button onClick={(e) => { e.stopPropagation(); setSelectedNodes([]); }} style={{ background: 'transparent', border: '1px solid var(--accent-color)', color: 'var(--accent-color)', padding: '4px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Clear Selection</button>
            <button onClick={(e) => { e.stopPropagation(); setSelectedNodes(allCurrentItems.map(item => item.id)); }} style={{ background: 'var(--accent-color)', border: 'none', color: '#fff', padding: '4px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Select All</button>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={(e) => { e.stopPropagation(); setNodeToDelete('multiple'); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#EF4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
              <Trash2 size={16} /> Delete Selected
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px', color: 'var(--text-muted)', fontSize: '15px', fontWeight: 600 }}>
        {activeSidebarTab === 'folders' ? breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            <span 
              onClick={() => {
                setSelectedNodes([]);
                setCurrentFolderId(crumb.id);
                setActiveSidebarTab('folders');
              }}
              style={{
                cursor: 'pointer',
                fontWeight: idx === breadcrumbs.length - 1 ? 700 : 500,
                color: idx === breadcrumbs.length - 1 ? 'var(--text-main)' : 'var(--text-muted)',
                transition: 'color 0.2s',
                padding: '4px 8px',
                borderRadius: '6px',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
              onMouseLeave={e => e.currentTarget.style.color = idx === breadcrumbs.length - 1 ? 'var(--text-main)' : 'var(--text-muted)'}
            >
              {idx === 0 ? <Home size={22} strokeWidth={2.5} /> : crumb.name}
            </span>
            {idx < breadcrumbs.length - 1 && <ChevronRight size={16} color="var(--text-muted)" />}
          </React.Fragment>
        )) : (
          <span style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Star size={22} fill="gold" color="gold" /> Favorites
          </span>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {searchQuery.trim() ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', color: 'var(--text-main)', flexShrink: 0 }}>Search Results</h2>
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
                    onClick={() => setActiveFile(file)}
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
            {viewMode === 'list' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {folders.map((folder, index) => (
                  <div 
                    key={folder.id} 
                    onClick={(e) => handleNodeClick(e, folder, index)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px',
                      borderRadius: '8px', cursor: 'pointer',
                      background: selectedNodes.includes(folder.id) ? 'var(--accent-color)' : 'var(--surface-color)',
                      color: selectedNodes.includes(folder.id) ? '#fff' : 'var(--text-main)',
                      border: selectedNodes.includes(folder.id) ? '2px solid var(--accent-color)' : '2px solid transparent',
                    }}
                  >
                    <Folder size={20} fill={selectedNodes.includes(folder.id) ? 'rgba(255,255,255,0.4)' : 'var(--accent-color)'} color={selectedNodes.includes(folder.id) ? '#fff' : 'var(--accent-color)'} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                    <div style={{ fontSize: '13px', color: selectedNodes.includes(folder.id) ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }}>
                      {(folder.children?.length || 0)} items
                    </div>
                  </div>
                ))}
              </div>
            ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px' }}>
              {folders.map((folder, index) => (
                <div 
                  key={folder.id} 
                  onClick={(e) => handleNodeClick(e, folder, index)}
                  style={{
                    position: 'relative',
                    background: selectedNodes.includes(folder.id) ? 'var(--bg-color)' : 'var(--surface-color)',
                    padding: '24px',
                    borderRadius: '16px',
                    boxShadow: selectedNodes.includes(folder.id) ? '0 0 0 3px var(--accent-color)' : 'var(--shadow-md)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    border: selectedNodes.includes(folder.id) ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
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
                  {selectedNodes.includes(folder.id) && (
                    <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'var(--accent-color)', borderRadius: '50%', padding: '4px', color: '#fff', zIndex: 10 }}>
                      <Check size={16} strokeWidth={3} />
                    </div>
                  )}
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
            )}
          </div>
        )}

        {files.length > 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', color: 'var(--text-main)', flexShrink: 0 }}>Files</h2>
            {viewMode === 'list' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <VirtualFileList 
                files={files} 
                selectedNodes={selectedNodes} 
                handleNodeClick={handleNodeClick} 
                toggleFavorite={toggleFavorite} 
                handleDelete={handleDelete} 
                getFileIconInfo={getFileIconInfo} 
                foldersLength={folders.length} 
              />
              </div>
            ) : (
              <VirtualFileGrid 
                files={files} 
                selectedNodes={selectedNodes} 
                handleNodeClick={handleNodeClick} 
                toggleFavorite={toggleFavorite} 
                getFileIconInfo={getFileIconInfo} 
                themeStyle={themeStyle} 
                editingNodeId={editingNodeId} 
                editingName={editingName} 
                setEditingName={setEditingName} 
                setEditingNodeId={setEditingNodeId} 
                handleRenameSubmit={handleRenameSubmit} 
                foldersLength={folders.length} 
              />
            )}
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
