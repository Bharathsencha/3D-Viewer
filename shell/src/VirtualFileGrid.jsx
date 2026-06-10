import React, { useRef, useState } from 'react';
import * as ReactWindow from 'react-window';
const { FixedSizeGrid: Grid } = ReactWindow;
import * as AutoSizerWrapper from 'react-virtualized-auto-sizer';
const AutoSizer = AutoSizerWrapper.default || AutoSizerWrapper;
import { Check, Edit2, Star } from 'lucide-react';

export default function VirtualFileGrid({ files, selectedNodes, handleNodeClick, toggleFavorite, getFileIconInfo, themeStyle, editingNodeId, editingName, setEditingName, setEditingNodeId, handleRenameSubmit, foldersLength }) {
  const columnWidth = 244; // 220 + 24 gap
  const rowHeight = 160;

  const Cell = ({ columnIndex, rowIndex, style, data }) => {
    const { itemsPerRow } = data;
    const index = rowIndex * itemsPerRow + columnIndex;
    if (index >= files.length) return null;

    const file = files[index];
    const { Icon, color } = getFileIconInfo(file.name);
    const globalIndex = foldersLength + index;
    const isSelected = selectedNodes.includes(file.id);

    return (
      <div style={{ ...style, width: style.width - 24, height: style.height - 24 }}>
        <div 
          onClick={(e) => {
            if (file.missing) return;
            handleNodeClick(e, file, globalIndex);
          }}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            background: isSelected ? 'var(--bg-color)' : 'var(--surface-color)',
            padding: '24px',
            borderRadius: '16px',
            boxShadow: isSelected ? '0 0 0 3px var(--accent-color)' : 'var(--shadow-md)',
            cursor: file.missing ? 'not-allowed' : 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            border: isSelected ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
            opacity: file.missing ? 0.6 : 1,
            transition: 'all 0.2s',
            boxSizing: 'border-box'
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
          {isSelected && (
            <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'var(--accent-color)', borderRadius: '50%', padding: '4px', color: '#fff', zIndex: 10 }}>
              <Check size={16} strokeWidth={3} />
            </div>
          )}
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
                    onClick={(e) => toggleFavorite(e, file.id)}
                    style={{ cursor: 'pointer', padding: '4px' }}
                    title="Favorite"
                  >
                    <Star size={14} fill={file.isFavorite ? 'gold' : 'transparent'} color={file.isFavorite ? 'gold' : 'var(--text-muted)'} />
                  </div>
                  <div 
                    onClick={e => { e.stopPropagation(); setEditingNodeId(file.id); setEditingName(file.name); }}
                    style={{ cursor: 'pointer', opacity: 0.5, padding: '4px' }}
                  >
                    <Edit2 size={14} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, height: '600px', width: '100%' }}>
      <AutoSizer>
        {({ height, width }) => {
          const itemsPerRow = Math.max(1, Math.floor(width / columnWidth));
          const rowCount = Math.ceil(files.length / itemsPerRow);

          return (
            <Grid
              columnCount={itemsPerRow}
              columnWidth={columnWidth}
              height={height}
              rowCount={rowCount}
              rowHeight={rowHeight}
              width={width}
              itemData={{ itemsPerRow }}
            >
              {Cell}
            </Grid>
          );
        }}
      </AutoSizer>
    </div>
  );
}
