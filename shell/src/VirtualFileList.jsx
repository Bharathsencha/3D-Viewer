import React from 'react';
import * as ReactWindow from 'react-window';
const { FixedSizeList: List } = ReactWindow;
import * as AutoSizerWrapper from 'react-virtualized-auto-sizer';
const AutoSizer = AutoSizerWrapper.default || AutoSizerWrapper;
import { Trash2, Star } from 'lucide-react';

export default function VirtualFileList({ files, selectedNodes, handleNodeClick, toggleFavorite, handleDelete, getFileIconInfo, foldersLength }) {
  const Row = ({ index, style }) => {
    const file = files[index];
    const { Icon, color } = getFileIconInfo(file.name);
    const globalIndex = foldersLength + index;
    const isSelected = selectedNodes.includes(file.id);

    return (
      <div style={style}>
        <div 
          onClick={(e) => {
            if (file.missing) return;
            handleNodeClick(e, file, globalIndex);
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px',
            borderRadius: '8px', cursor: file.missing ? 'not-allowed' : 'pointer',
            background: isSelected ? 'var(--accent-color)' : 'var(--surface-color)',
            color: isSelected ? '#fff' : 'var(--text-main)',
            border: isSelected ? '2px solid var(--accent-color)' : '2px solid transparent',
            opacity: file.missing ? 0.6 : 1,
            height: 'calc(100% - 8px)', // accounts for gap
          }}
        >
          <Icon size={20} color={isSelected ? '#fff' : color} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
          <div 
            onClick={(e) => toggleFavorite(e, file.id)}
            style={{ cursor: 'pointer', padding: '4px' }}
          >
            <Star size={16} fill={file.isFavorite ? 'gold' : 'transparent'} color={file.isFavorite ? 'gold' : (isSelected ? '#fff' : 'var(--text-muted)')} />
          </div>
          <div style={{ width: '80px', textAlign: 'right', fontSize: '13px', color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)' }}>
            {file.size ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}
          </div>
          <div 
            onClick={e => handleDelete(e, file.id)}
            style={{ cursor: 'pointer', padding: '4px', color: isSelected ? '#fff' : '#EF4444' }}
          >
            <Trash2 size={16} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, height: '600px', width: '100%' }}>
      <AutoSizer>
        {({ height, width }) => (
          <List
            height={height}
            itemCount={files.length}
            itemSize={56} // 48px height + 8px gap
            width={width}
          >
            {Row}
          </List>
        )}
      </AutoSizer>
    </div>
  );
}
