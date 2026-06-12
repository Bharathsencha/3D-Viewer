import { FixedSizeList as List } from 'react-window';

import AutoSizer from 'react-virtualized-auto-sizer';

import { Trash2, Star } from 'lucide-react';

export default function VirtualFileList({ files, selectedNodes, handleNodeClick, toggleFavorite, handleDelete, getFileIconInfo, foldersLength }) {
  const Row = ({ index, style }) => {
    const file = files[index];
    const { Icon, color } = getFileIconInfo(file.name);
    const globalIndex = foldersLength + index;
    const isSelected = selectedNodes.includes(file.id);

    return (
      <div style={{ ...style, paddingLeft: '8px', paddingRight: '8px', paddingTop: '4px', paddingBottom: '4px', boxSizing: 'border-box' }}>
        <div 
          onClick={(e) => {
            if (file.missing) return;
            handleNodeClick(e, file, globalIndex);
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px',
            borderRadius: '12px', cursor: file.missing ? 'not-allowed' : 'pointer',
            background: isSelected ? 'var(--accent-bg-glow)' : 'var(--surface-color)',
            color: isSelected ? 'var(--accent-color)' : 'var(--text-main)',
            border: isSelected ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
            opacity: file.missing ? 0.6 : 1,
            height: '100%',
            transition: 'all 0.2s ease',
            boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
          }}
          onMouseEnter={e => {
            if (!isSelected && !file.missing) {
              e.currentTarget.style.background = 'var(--hover-color)';
              e.currentTarget.style.transform = 'translateX(4px)';
            }
          }}
          onMouseLeave={e => {
            if (!isSelected && !file.missing) {
              e.currentTarget.style.background = 'var(--surface-color)';
              e.currentTarget.style.transform = 'none';
            }
          }}
        >
          <Icon size={20} color={isSelected ? 'var(--accent-color)' : color} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isSelected ? 600 : 500 }}>{file.name}</span>
          <div 
            onClick={(e) => toggleFavorite(e, file.id)}
            style={{ cursor: 'pointer', padding: '4px' }}
          >
            <Star size={16} fill={file.isFavorite ? 'gold' : 'transparent'} color={file.isFavorite ? 'gold' : (isSelected ? 'var(--accent-color)' : 'var(--text-muted)')} />
          </div>
          <div style={{ width: '80px', textAlign: 'right', fontSize: '13px', color: isSelected ? 'var(--accent-color)' : 'var(--text-muted)' }}>
            {file.size ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}
          </div>
          <div 
            onClick={e => handleDelete(e, file.id)}
            style={{ cursor: 'pointer', padding: '4px', color: '#EF4444', opacity: 0.7, transition: 'opacity 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
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
