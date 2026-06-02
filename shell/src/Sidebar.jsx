import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder as FolderIcon, File as FileIcon, Search, Edit2, Trash2 } from 'lucide-react';

export default function Sidebar({ library, setLibrary, activeFile, setActiveFile, themeStyle }) {
  const [expanded, setExpanded] = useState({});
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [nodeToDelete, setNodeToDelete] = useState(null);

  const renameNodeInFolder = (nodeId, newName, currentList) => {
    return currentList.map(n => {
      if (n.id === nodeId) {
        return { ...n, name: newName };
      }
      if (n.type === 'folder' && n.children) {
        return { ...n, children: renameNodeInFolder(nodeId, newName, n.children) };
      }
      return n;
    });
  };

  const handleRenameSubmit = (e, nodeId) => {
    e.stopPropagation();
    e.preventDefault();
    if (editingName.trim() && setLibrary) {
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

  const confirmDeleteNode = () => {
    if (nodeToDelete && setLibrary) {
      setLibrary(deleteNodeFromFolder(nodeToDelete, library));
      setNodeToDelete(null);
      if (activeFile && activeFile.id === nodeToDelete) {
        setActiveFile(null);
      }
    }
  };

  // Auto-expand folders when a file is selected
  useEffect(() => {
    if (activeFile && library) {
      const foldersToExpand = {};
      
      const findPath = (nodes, targetId, currentPath = []) => {
        for (const node of nodes) {
          if (node.id === targetId) return currentPath;
          if (node.type === 'folder' && node.children) {
            const path = findPath(node.children, targetId, [...currentPath, node.id]);
            if (path) return path;
          }
        }
        return null;
      };

      const path = findPath(library, activeFile.id);
      if (path) {
        path.forEach(id => {
          foldersToExpand[id] = true;
        });
        setExpanded(prev => ({ ...prev, ...foldersToExpand }));
      }
    }
  }, [activeFile, library]);

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderTree = (nodes, depth = 0) => {
    return nodes.map(node => {
      const isFolder = node.type === 'folder';
      const isExpanded = expanded[node.id];
      const indent = depth * 16 + 12;
      const isActive = !isFolder && activeFile && activeFile.id === node.id;

      return (
        <div key={node.id}>
          <div 
            onClick={(e) => {
              if (isFolder) toggleExpand(node.id, e);
              else if (!node.missing) setActiveFile(node);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 12px',
              paddingLeft: `${indent}px`,
              cursor: node.missing ? 'not-allowed' : 'pointer',
              background: isActive ? 'var(--hover-color, rgba(0,0,0,0.05))' : 'transparent',
              color: isActive ? 'var(--selected-text, var(--accent-color))' : (node.missing ? '#EF4444' : 'var(--text-main)'),
              fontWeight: isActive ? 600 : 400,
              fontSize: '13px',
              userSelect: 'none',
              opacity: node.missing ? 0.6 : 1,
              borderLeft: isActive ? '3px solid var(--accent-color)' : '3px solid transparent'
            }}
            onMouseEnter={e => {
              if (!isActive && !node.missing) e.currentTarget.style.background = 'var(--hover-color)';
              const actions = e.currentTarget.querySelector('.sidebar-actions');
              if (actions) actions.style.opacity = '1';
            }}
            onMouseLeave={e => {
              if (!isActive) e.currentTarget.style.background = 'transparent';
              const actions = e.currentTarget.querySelector('.sidebar-actions');
              if (actions) actions.style.opacity = '0';
            }}
          >
            <span style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '6px' }}>
              {isFolder ? (
                isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              ) : null}
            </span>
            <span style={{ marginRight: '8px', display: 'flex', alignItems: 'center' }}>
              {isFolder ? (
                themeStyle === 'cartoon' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="var(--border-color)" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    <circle cx="9" cy="13" r="1.5" fill="#000"></circle>
                    <circle cx="15" cy="13" r="1.5" fill="#000"></circle>
                    <path d="M10 16c1.5 1.5 2.5 1.5 4 0" stroke="#000" strokeWidth="1.5" strokeLinecap="round"></path>
                  </svg>
                ) : (
                  <FolderIcon size={16} fill="currentColor" color="currentColor" />
                )
              ) : (
                themeStyle === 'cartoon' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#ffffff" stroke="var(--border-color)" strokeWidth="2">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                    <polyline points="13 2 13 9 20 9"></polyline>
                    <circle cx="9" cy="14" r="1.5" fill="#000"></circle>
                    <circle cx="15" cy="14" r="1.5" fill="#000"></circle>
                    <path d="M10 17c1.5 1.5 2.5 1.5 4 0" stroke="#000" strokeWidth="1.5" strokeLinecap="round"></path>
                  </svg>
                ) : (
                  <FileIcon size={16} />
                )
              )}
            </span>
            {editingNodeId === node.id ? (
              <form onSubmit={e => handleRenameSubmit(e, node.id)} style={{ display: 'flex', width: '100%', gap: '4px', marginLeft: '4px' }}>
                <input 
                  autoFocus
                  value={editingName} 
                  onChange={e => setEditingName(e.target.value)} 
                  onClick={e => e.stopPropagation()}
                  style={{ width: '100%', padding: '2px 4px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--accent-color)', outline: 'none', background: 'var(--surface-color)', color: 'var(--text-main)' }}
                />
              </form>
            ) : (
              <>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: node.missing ? 'line-through' : 'none' }}>
                  {node.name}
                </span>
                <div className="sidebar-actions" style={{ display: 'flex', gap: '4px', opacity: 0, transition: 'opacity 0.2s', marginLeft: 'auto' }}>
                  <div 
                    onClick={e => { e.stopPropagation(); setEditingNodeId(node.id); setEditingName(node.name); }}
                    style={{ cursor: 'pointer', opacity: 0.5, padding: '2px' }}
                    title="Rename"
                  >
                    <Edit2 size={12} />
                  </div>
                  <div 
                    onClick={e => { e.stopPropagation(); setNodeToDelete(node.id); }}
                    style={{ cursor: 'pointer', opacity: 0.7, padding: '2px', color: '#EF4444' }}
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </div>
                </div>
              </>
            )}
          </div>
          {isFolder && isExpanded && node.children && renderTree(node.children, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div style={{
      width: '260px',
      height: 'calc(100% - 24px)', // Leave margin top and bottom
      margin: '12px 12px 12px 16px', // Floating margins
      background: 'var(--surface-color)',
      border: '1px solid var(--border-color)', // Full border instead of just right
      borderRadius: '16px', // Smooth corners
      boxShadow: 'var(--shadow-md)', // Modern depth
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ 
          background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '6px', 
          display: 'flex', alignItems: 'center', padding: '6px 12px', gap: '8px'
        }}>
          <Search size={14} color="var(--text-muted)" />
          <input 
            type="text" 
            placeholder="Search..." 
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '100%', color: 'var(--text-main)' }}
          />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {renderTree(library)}
      </div>

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
    </div>
  );
}
