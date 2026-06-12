import { useState, useEffect } from 'react';

const thumbnailCache = new Map();

export default function Thumbnail({ file, defaultIcon }) {
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchThumbnail = async () => {
      if (thumbnailCache.has(file.path)) {
        if (isMounted) {
          setThumbnailUrl(thumbnailCache.get(file.path));
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        const thumbPath = await window.api.generateThumbnail(file.path);
        if (isMounted && thumbPath) {
          let url = thumbPath;
          if (!thumbPath.startsWith('data:image')) {
            url = 'file://' + thumbPath;
          }
          thumbnailCache.set(file.path, url);
          if (isMounted) {
            setThumbnailUrl(url);
          }
        }
      } catch (err) {
        console.error('Thumbnail error', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    if (file.path) fetchThumbnail();
    return () => { isMounted = false; };
  }, [file.path]);

  if (thumbnailUrl) {
    return (
      <div style={{ width: '100%', height: '120px', overflow: 'hidden', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={thumbnailUrl} alt={file.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ width: '100%', height: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <div className="spinner" style={{ width: '24px', height: '24px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Generating...</span>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return defaultIcon;
}
