import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder as FolderIcon, File as FileIcon, Search } from 'lucide-react';

export default function Sidebar({ library, activeFile, setActiveFile }) {
  const [expanded, setExpanded] = useState({});

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
              background: isActive ? 'var(--hover-color)' : 'transparent',
              color: isActive ? 'var(--accent-color)' : (node.missing ? '#EF4444' : 'var(--text-main)'),
              fontWeight: isActive ? 600 : 400,
              fontSize: '13px',
              userSelect: 'none',
              opacity: node.missing ? 0.6 : 1,
              borderLeft: isActive ? '3px solid var(--accent-color)' : '3px solid transparent'
            }}
            onMouseEnter={e => {
              if (!isActive && !node.missing) e.currentTarget.style.background = 'var(--hover-color)';
            }}
            onMouseLeave={e => {
              if (!isActive) e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '6px' }}>
              {isFolder ? (
                isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              ) : null}
            </span>
            <span style={{ marginRight: '8px', display: 'flex', alignItems: 'center' }}>
              {isFolder ? <FolderIcon size={16} fill="currentColor" color="currentColor" /> : <FileIcon size={16} />}
            </span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: node.missing ? 'line-through' : 'none' }}>
              {node.name}
            </span>
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
    </div>
  );
}
