import { useMemo, useState, useEffect, useRef, Fragment } from 'react';
import { Folder, File, ChevronRight, Home, Plus, Upload, Sun, Moon, Search, Box, Edit2, Trash2, ListFilter, Check, Star, LayoutGrid, List, FileBox, Code, Image } from 'lucide-react';
import Fuse from 'fuse.js';

import ThemeDropdown from './ThemeDropdown';
import DuplicateManager from './DuplicateManager';
import VirtualFileList from './VirtualFileList';
import VirtualFileGrid from './VirtualFileGrid';
import FilterDropdown from './FilterDropdown';

export default function Dashboard({ library, setLibrary, currentFolderId, setCurrentFolderId, setActiveFile, isDarkMode, setIsDarkMode, themeStyle, setThemeStyle }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [duplicateData, setDuplicateData] = useState(null);
  const [resolvingDuplicates, setResolvingDuplicates] = useState(null);
  const [isLibraryScan, setIsLibraryScan] = useState(false);
  const [libraryDuplicateData, setLibraryDuplicateData] = useState(null);
  const [archiveModalData, setArchiveModalData] = useState(null);
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
  const sortDropdownRef = useRef(null);
  const [notification, setNotification] = useState(null); // { message: '', type: 'success' | 'info' | 'error' }

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
  const allCurrentItems = useMemo(() => [...folders, ...files], [folders, files]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSelectedNodes([]);
      setLastSelectedIndex(null);
    }, 0);
    return () => clearTimeout(timer);
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

  const handleScanDuplicates = async () => {
    setIsProcessingFiles(true);
    try {
      const dups = await window.api.scanLibraryDuplicates();
      if (dups && dups.length > 0) {
        setLibraryDuplicateData(dups);
      } else {
        setNotification({ message: "No duplicates found in your library!", type: 'success' });
      }
    } catch (err) {
      console.error('Failed to scan library for duplicates:', err);
      setNotification({ message: "Failed to scan for duplicates: " + err.message, type: 'error' });
    } finally {
      setIsProcessingFiles(false);
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
      setNotification({ message: 'Failed to add designs: ' + err.message, type: 'error' });
    }
  };

  const handleDuplicateResolutionComplete = async (results) => {
    if (isLibraryScan) {
      const toDeletePaths = [];
      const libraryPathsToRemove = [];

      for (const r of results) {
        if (r.action === 'skip') {
          // Keep Existing, meaning delete the duplicate (r.path)
          toDeletePaths.push(r.path);
          libraryPathsToRemove.push(r.path);
        } else if (r.action === 'replace') {
          // Replace Existing, meaning delete the existing (r.existingPath)
          toDeletePaths.push(r.existingPath);
          libraryPathsToRemove.push(r.existingPath);
        }
      }

      if (toDeletePaths.length > 0) {
        await window.api.deleteFile(toDeletePaths);
        
        const removeNodesByPath = (nodes, paths) => {
          return nodes
            .filter(n => n.type !== 'file' || !paths.includes(n.path))
            .map(n => {
              if (n.type === 'folder' && n.children) {
                return { ...n, children: removeNodesByPath(n.children, paths) };
              }
              return n;
            });
        };
        setLibrary(prev => removeNodesByPath(prev, libraryPathsToRemove));
      }

      setResolvingDuplicates(null);
      setIsLibraryScan(false);
      return;
    }

    let finalList = [];
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


  const proceedWithImport = async (finalFiles, archiveMappings) => {
    setIsProcessingFiles(true);
    try {
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
      console.error('Import failed:', err);
    } finally {
      setIsProcessingFiles(false);
      setUploadProgress(null);
    }
  };

  const handleArchiveExtractSelection = async (extractFlat) => {
    if (!archiveModalData) return;
    const { archiveFiles, currentIndex, accumulatedFiles, accumulatedMappings } = archiveModalData;
    const currentArchivePath = archiveFiles[currentIndex];
    
    let nextAccumulatedFiles = [...accumulatedFiles];
    let nextAccumulatedMappings = { ...accumulatedMappings };

    if (extractFlat !== null) {
      setIsProcessingFiles(true);
      try {
        const extracted = await window.api.extractArchive(currentArchivePath);
        const archiveName = currentArchivePath.split(/[/\\]/).pop().split('.').slice(0, -1).join('.');
        
        for (const item of extracted) {
          nextAccumulatedFiles.push(item.absolutePath);
          if (extractFlat) {
            // Flatten: just the file name
            nextAccumulatedMappings[item.absolutePath] = item.absolutePath.split(/[/\\]/).pop();
          } else {
            // Preserve tree: archiveName/relativePath
            nextAccumulatedMappings[item.absolutePath] = archiveName + '/' + item.relativePath;
          }
        }
      } catch (err) {
        console.error('Failed to extract archive:', err);
        setNotification({ message: 'Failed to unpack Zip: ' + err.message, type: 'error' });
      }
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < archiveFiles.length) {
      setArchiveModalData({
        archiveFiles,
        currentIndex: nextIndex,
        accumulatedFiles: nextAccumulatedFiles,
        accumulatedMappings: nextAccumulatedMappings
      });
    } else {
      setArchiveModalData(null);
      if (nextAccumulatedFiles.length > 0) {
        await proceedWithImport(nextAccumulatedFiles, nextAccumulatedMappings);
      } else {
        setIsProcessingFiles(false);
      }
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).map(f => window.api.getFilePath(f)).filter(Boolean);
    if (droppedFiles.length === 0) return;

    setIsProcessingFiles(true);
    try {
      let normalFiles = [];
      let archiveFiles = [];
      for (const filePath of droppedFiles) {
        const ext = filePath.split('.').pop().toLowerCase();
        if (ext === 'zip' || ext === 'rar') {
          archiveFiles.push(filePath);
        } else {
          normalFiles.push(filePath);
        }
      }

      let accumulatedFiles = [];
      let accumulatedMappings = {};

      // Scan normal files/folders
      for (const filePath of normalFiles) {
        const scanned = await window.api.scanPath(filePath);
        for (const item of scanned) {
          accumulatedFiles.push(item.absolutePath);
          accumulatedMappings[item.absolutePath] = item.relativePath;
        }
      }

      if (archiveFiles.length > 0) {
        setArchiveModalData({
          archiveFiles,
          currentIndex: 0,
          accumulatedFiles,
          accumulatedMappings
        });
      } else {
        if (accumulatedFiles.length > 0) {
          await proceedWithImport(accumulatedFiles, accumulatedMappings);
        } else {
          setIsProcessingFiles(false);
        }
      }
    } catch (err) {
      console.error('Failed to process dropped files:', err);
      setIsProcessingFiles(false);
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
        flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
        position: 'relative', background: 'var(--bg-color)'
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
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--surface-color)',
            padding: '40px 48px',
            borderRadius: '20px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            border: '1px solid var(--border-color)',
            maxWidth: '90%',
            width: '420px',
            textAlign: 'center'
          }}>
            <div style={{ 
              width: '48px', 
              height: '48px', 
              border: '4px solid var(--accent-bg-glow)', 
              borderTopColor: 'var(--accent-color)', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite' 
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                {uploadProgress ? 'Adding Designs...' : 'Preparing Designs...'}
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                {uploadProgress 
                  ? `Completed ${uploadProgress.current} of ${uploadProgress.total} files` 
                  : 'Reading design details. Please wait...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {resolvingDuplicates && (
        <DuplicateManager
          duplicates={resolvingDuplicates}
          isDarkMode={isDarkMode}
          themeStyle={themeStyle}
          isLibraryScan={isLibraryScan}
          onComplete={handleDuplicateResolutionComplete}
          onCancel={() => {
            setResolvingDuplicates(null);
            setIsLibraryScan(false);
            if (!isLibraryScan && duplicateData) {
              const nonDups = duplicateData.nonDuplicates || [];
              setDuplicateData(null);
              if (nonDups.length > 0) commitAndAddNodes(nonDups, false);
            }
          }}
        />
      )}

      {archiveModalData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg-color)', padding: '32px', borderRadius: '16px',
            width: '500px', maxWidth: '90%', color: 'var(--text-main)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '20px' }}>Import Compressed File (Zip)</h2>
            <p style={{ marginBottom: '24px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              How would you like to open the Zip file <strong style={{ color: 'var(--text-main)' }}>{archiveModalData.archiveFiles[archiveModalData.currentIndex].split(/[/\\]/).pop()}</strong>?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={async () => {
                  await handleArchiveExtractSelection(true); // extract flat
                }}
                style={{
                  padding: '14px 20px', borderRadius: '8px', border: '1px solid var(--border-color)',
                  background: 'var(--surface-color)', color: 'var(--text-main)', cursor: 'pointer',
                  fontWeight: 600, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px',
                  transition: 'all 0.2s'
                }}
              >
                <span>Unpack files in current folder</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>All designs inside the zip will be added directly to this folder.</span>
              </button>
              <button 
                onClick={async () => {
                  await handleArchiveExtractSelection(false); // extract to folder name (preserving structure)
                }}
                style={{
                  padding: '14px 20px', borderRadius: '8px', border: '1px solid var(--border-color)',
                  background: 'var(--surface-color)', color: 'var(--text-main)', cursor: 'pointer',
                  fontWeight: 600, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px',
                  transition: 'all 0.2s'
                }}
              >
                <span>Unpack to a new folder</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>Create a new folder named after the zip file to keep the designs organized.</span>
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button 
                onClick={() => {
                  handleArchiveExtractSelection(null);
                }}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none',
                  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 500
                }}
              >
                Skip Zip
              </button>
            </div>
          </div>
        </div>
      )}

      {libraryDuplicateData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg-color)', padding: '32px', borderRadius: '16px',
            width: '500px', maxWidth: '90%', color: 'var(--text-main)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '20px' }}>Duplicate Designs in Library</h2>
            <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
              We found {libraryDuplicateData.length} duplicate design(s) already saved in your library.
            </p>
            <div style={{
              maxHeight: '150px', overflowY: 'auto', marginBottom: '24px',
              background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px'
            }}>
              {libraryDuplicateData.map((d, i) => (
                <div key={i} style={{ marginBottom: '8px', fontSize: '14px' }}>
                  <strong>{d.original}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>(matches {d.existing})</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => {
                  setLibraryDuplicateData(null);
                }}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)',
                  background: 'transparent', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 500
                }}
              >
                Close
              </button>
              <button 
                onClick={async () => {
                  const pathsToDelete = libraryDuplicateData.map(d => d.path);
                  setLibraryDuplicateData(null);
                  setIsProcessingFiles(true);
                  try {
                    await window.api.deleteFile(pathsToDelete);
                    
                    const removeNodesByPath = (nodes, paths) => {
                      return nodes
                        .filter(n => n.type !== 'file' || !paths.includes(n.path))
                        .map(n => {
                          if (n.type === 'folder' && n.children) {
                            return { ...n, children: removeNodesByPath(n.children, paths) };
                          }
                          return n;
                        });
                    };
                    setLibrary(prev => removeNodesByPath(prev, pathsToDelete));
                    setNotification({ message: `Successfully cleaned up ${pathsToDelete.length} duplicate designs!`, type: 'success' });
                  } catch (err) {
                    console.error(err);
                    setNotification({ message: "Failed to delete duplicates: " + err.message, type: 'error' });
                  } finally {
                    setIsProcessingFiles(false);
                  }
                }}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: '1px solid #ef4444',
                  background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', cursor: 'pointer', fontWeight: 600
                }}
              >
                Clean Up Duplicates
              </button>
              <button 
                onClick={() => {
                  setIsLibraryScan(true);
                  setResolvingDuplicates(libraryDuplicateData);
                  setLibraryDuplicateData(null);
                }}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none',
                  background: 'var(--accent-color)', color: '#fff', cursor: 'pointer', fontWeight: 500
                }}
              >
                Review Each File
              </button>
            </div>
          </div>
        </div>
      )}

      {duplicateData && !resolvingDuplicates && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg-color)', padding: '32px', borderRadius: '16px',
            width: '500px', maxWidth: '90%', color: 'var(--text-main)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '20px' }}>Duplicate Files Found</h2>
            <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>
              We found {duplicateData.duplicates.length} design(s) that are already in your folders. How would you like to proceed?
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
                Review Each
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
                Skip Duplicates
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
                Import as Copies
              </button>
            </div>
          </div>
        </div>
      )}
      {isDragging && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--accent-bg-glow)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
          padding: '24px'
        }}>
          <div style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'var(--glass-blur)',
            border: '3px dashed var(--accent-color)',
            borderRadius: '24px',
            padding: '48px 64px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'center',
            maxWidth: '500px'
          }}>
            <div className="pulse-icon" style={{ background: 'var(--accent-bg-glow)', padding: '20px', borderRadius: '50%', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={48} strokeWidth={2} />
            </div>
            <h2 style={{ fontSize: '22px', color: 'var(--text-main)', fontWeight: 700, margin: 0 }}>
              Drop your 3D designs here
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Designs will be added to the current folder.<br/>
              Supports STL, OBJ, and 3DM files.
            </p>
          </div>
        </div>
      )}
      {/* Top Navbar */}
      <div className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', height: '64px', position: 'relative', flexShrink: 0 }}>
        {/* Left: Logo and current folder */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Box size={24} color="var(--accent-color)" className="item-card-icon" />
          <h1 className="logo-text" style={{ margin: 0, fontSize: '22px' }}>
            3D Viewer
          </h1>
          {currentFolder && (
            <>
              <ChevronRight size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', background: 'var(--accent-bg-glow)', padding: '4px 10px', borderRadius: '12px' }}>
                {currentFolder.name}
              </span>
            </>
          )}
        </div>

        {/* Center: Search container */}
        <div className="search-container">
          <Search size={16} color="var(--text-muted)" style={{ marginRight: '8px' }} />
          <input 
            type="text" 
            placeholder="Search files..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Right: Actions and Theme Toggles */}
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
          
          <button 
            onClick={handleCreateFolder}
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '20px' }}
          >
            <Plus size={16} /> New Folder
          </button>
          <button 
            onClick={handleAddFiles}
            className="btn-primary"
            style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '20px' }}
          >
            <Upload size={16} /> Add Files
          </button>

          <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 4px' }}></div>

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

      {/* Control Toolbar */}
      <div className="app-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 24px', height: '52px', flexShrink: 0 }}>
        {/* Left Side: Navigation Pills & Breadcrumbs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '2px', gap: '2px' }}>
            <div 
              onClick={() => { setActiveSidebarTab('folders'); setCurrentFolderId(null); }}
              title="Home"
              className={`tab-pill ${activeSidebarTab === 'folders' ? 'active' : ''}`}
              style={{ padding: '6px 12px', borderRadius: '18px', fontSize: '13px' }}
            >
              <Home size={14} /> Home
            </div>
            <div 
              onClick={() => { setActiveSidebarTab('favorites'); setCurrentFolderId(null); }}
              title="Favorites"
              className={`tab-pill ${activeSidebarTab === 'favorites' ? 'active' : ''}`}
              style={{ padding: '6px 12px', borderRadius: '18px', fontSize: '13px' }}
            >
              <Star size={14} /> Favorites
            </div>
          </div>

          <div style={{ width: '1px', height: '16px', background: 'var(--border-color)' }}></div>

          {/* Breadcrumbs inside Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>
            {activeSidebarTab === 'folders' ? breadcrumbs.map((crumb, idx) => (
              <Fragment key={idx}>
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
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
                  onMouseLeave={e => e.currentTarget.style.color = idx === breadcrumbs.length - 1 ? 'var(--text-main)' : 'var(--text-muted)'}
                >
                  {idx === 0 ? 'Root' : crumb.name}
                </span>
                {idx < breadcrumbs.length - 1 && <ChevronRight size={12} color="var(--text-muted)" />}
              </Fragment>
            )) : (
              <span style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Favorites
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Sorting, Filter, ViewMode & Multi-select */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            onClick={handleScanDuplicates}
            className="btn-secondary"
            style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500 }}
          >
            <Search size={14} /> Duplicates
          </button>
          
          <button 
            onClick={() => {
              setIsMultiSelectMode(!isMultiSelectMode);
              if (isMultiSelectMode) setSelectedNodes([]);
            }}
            className="dropdown-trigger"
            style={{ 
              background: isMultiSelectMode ? 'var(--accent-bg-glow)' : 'var(--surface-color)', 
              borderColor: isMultiSelectMode ? 'var(--accent-color)' : 'var(--border-color)',
              color: isMultiSelectMode ? 'var(--accent-color)' : 'var(--text-main)',
              fontSize: '12px', padding: '6px 12px', borderRadius: '8px'
            }}
          >
            <ListFilter size={14} /> Select
          </button>

          <FilterDropdown filterExt={filterExt} setFilterExt={setFilterExt} />

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', padding: '2px' }}>
            <div 
              onClick={() => setViewMode('grid')}
              title="Grid View"
              style={{ 
                padding: '4px 8px', cursor: 'pointer', borderRadius: '6px',
                background: viewMode === 'grid' ? 'var(--accent-bg-glow)' : 'transparent', 
                color: viewMode === 'grid' ? 'var(--accent-color)' : 'var(--text-muted)',
                transition: 'all 0.2s'
              }}
            ><LayoutGrid size={14} /></div>
            <div 
              onClick={() => setViewMode('list')}
              title="List View"
              style={{ 
                padding: '4px 8px', cursor: 'pointer', borderRadius: '6px',
                background: viewMode === 'list' ? 'var(--accent-bg-glow)' : 'transparent', 
                color: viewMode === 'list' ? 'var(--accent-color)' : 'var(--text-muted)',
                transition: 'all 0.2s'
              }}
            ><List size={14} /></div>
          </div>

          {/* Sort Menu */}
          <div ref={sortDropdownRef} style={{ position: 'relative' }}>
            <button 
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="dropdown-trigger"
              style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px' }}
            >
              <ListFilter size={14} color="var(--text-muted)" />
              <span>
                {sortBy === 'newest' && 'Newest'}
                {sortBy === 'oldest' && 'Oldest'}
                {sortBy === 'name-asc' && 'A-Z'}
                {sortBy === 'name-desc' && 'Z-A'}
                {sortBy === 'size-desc' && 'Size (Desc)'}
                {sortBy === 'size-asc' && 'Size (Asc)'}
              </span>
            </button>
            
            {isSortOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                background: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-lg)',
                padding: '4px',
                minWidth: '150px',
                zIndex: 150,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                {[
                  { id: 'newest', label: 'Newest First' },
                  { id: 'oldest', label: 'Oldest First' },
                  { id: 'name-asc', label: 'Name (A-Z)' },
                  { id: 'name-desc', label: 'Name (Z-A)' },
                  { id: 'size-desc', label: 'Size (Largest)' },
                  { id: 'size-asc', label: 'Size (Smallest)' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => { setSortBy(opt.id); setIsSortOpen(false); }}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: sortBy === opt.id ? 'var(--accent-color)' : 'transparent',
                      color: sortBy === opt.id ? '#fff' : 'var(--text-main)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '13px',
                      transition: 'all 0.15s',
                      fontWeight: sortBy === opt.id ? 600 : 400
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Content Container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px 64px 32px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        
        { (selectedNodes.length > 0 || isMultiSelectMode) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--accent-bg-glow)', border: '1px solid var(--accent-color)', borderRadius: '12px', padding: '12px 24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontWeight: 600, color: 'var(--accent-color)', fontSize: '14px' }}>{selectedNodes.length} item(s) selected</span>
              <button onClick={(e) => { e.stopPropagation(); setSelectedNodes([]); }} className="btn-secondary" style={{ padding: '4px 12px', borderRadius: '16px', fontSize: '12px' }}>Clear</button>
              <button onClick={(e) => { e.stopPropagation(); setSelectedNodes(allCurrentItems.map(item => item.id)); }} className="btn-primary" style={{ padding: '4px 12px', borderRadius: '16px', fontSize: '12px', boxShadow: 'none' }}>Select All</button>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={(e) => { e.stopPropagation(); setNodeToDelete('multiple'); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#EF4444', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                <Trash2 size={14} /> Delete Selected
              </button>
            </div>
          </div>
        )}

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
                  className={`item-card ${selectedNodes.includes(folder.id) ? 'selected' : ''}`}
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                >
                  {selectedNodes.includes(folder.id) && (
                    <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'var(--accent-color)', borderRadius: '50%', padding: '4px', color: '#fff', zIndex: 10 }}>
                      <Check size={16} strokeWidth={3} />
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div className="item-card-icon" style={{ display: 'flex', alignItems: 'center' }}>
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
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: 'var(--bg-color)', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
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
                  <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--text-main)', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
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
              <VirtualFileList 
                files={files} 
                selectedNodes={selectedNodes} 
                handleNodeClick={handleNodeClick} 
                toggleFavorite={toggleFavorite} 
                handleDelete={handleDelete} 
                getFileIconInfo={getFileIconInfo} 
                foldersLength={folders.length} 
              />
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
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
              <button type="submit" style={{ padding: '6px 16px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Create Folder</button>
            </div>
          </form>
        </div>
      )}

      {nodeToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface-color)', padding: '24px', borderRadius: '12px', width: '320px', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ margin: '0 0 16px 0', color: 'var(--text-main)' }}>
              {nodeToDelete === 'multiple' ? 'Delete Selected?' : 'Delete Design?'}
            </h3>
            <p style={{ margin: '0 0 24px 0', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.5 }}>
              Are you sure you want to permanently delete this? It will be removed from your computer and library.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setNodeToDelete(null)} style={{ padding: '6px 12px', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={confirmDeleteNode} style={{ padding: '6px 16px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Delete Permanently</button>
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
      {notification && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--surface-color)',
          border: `1px solid ${notification.type === 'error' ? '#EF4444' : (notification.type === 'success' ? '#10B981' : 'var(--accent-color)')}`,
          borderRadius: '12px',
          padding: '12px 24px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: '300px',
          maxWidth: '90%',
          backdropFilter: 'var(--glass-blur)',
          animation: 'slide-down 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: notification.type === 'error' ? '#EF4444' : (notification.type === 'success' ? '#10B981' : 'var(--accent-color)')
          }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', flex: 1 }}>{notification.message}</span>
          <button 
            onClick={() => setNotification(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              padding: '2px 6px',
              fontFamily: 'inherit'
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      </div> {/* Scrollable Content Container */}
    </div>
  );
}
