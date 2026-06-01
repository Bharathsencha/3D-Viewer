import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Music, Upload, List } from 'lucide-react';

const globalAudio = new Audio();
let globalCurrentSong = null;
let globalIsPlaying = false;

export default function MusicPlayer({ themeStyle, isDarkMode, gtaTheme }) {
  const [songs, setSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(globalCurrentSong);
  const [isPlaying, setIsPlaying] = useState(globalIsPlaying);
  const [progress, setProgress] = useState(globalAudio.currentTime || 0);
  const [duration, setDuration] = useState(globalAudio.duration || 0);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const audioRef = useRef(globalAudio);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchSongs();
    
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowPlaylist(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (songs.length > 0) {
      const barbieSong = songs.find(s => s.name.toLowerCase().includes('barbie'));
      const vcSong = songs.find(s => s.name.toLowerCase().includes('vice_city'));
      const saSong = songs.find(s => s.name.toLowerCase().includes('gta_sa'));
      const gta4Song = songs.find(s => s.name.toLowerCase().includes('gta4'));
      const gta5Song = songs.find(s => s.name.toLowerCase().includes('gta5'));
      const ghibli1Song = songs.find(s => s.name.toLowerCase().includes('ghibli1'));
      const ghibli2Song = songs.find(s => s.name.toLowerCase().includes('ghibli2'));
      const retroSong = songs.find(s => s.name.toLowerCase().includes('retro'));
      
      if (themeStyle === 'barbie') {
        if (barbieSong && currentSong?.path !== barbieSong.path) {
          playSong(barbieSong);
        } else if (barbieSong && !isPlaying) {
          audioRef.current.play();
          setIsPlaying(true);
        }
      } else if (themeStyle === 'gta') {
        let targetSong = vcSong;
        if (gtaTheme === 'san_andreas') targetSong = saSong;
        if (gtaTheme === 'gta4') targetSong = gta4Song;
        if (gtaTheme === 'gta5') targetSong = gta5Song;
        
        if (targetSong && currentSong?.path !== targetSong.path) {
          playSong(targetSong);
        } else if (targetSong && !isPlaying) {
          audioRef.current.play();
          setIsPlaying(true);
        }
      } else if (themeStyle === 'ghibli') {
        const targetSong = isDarkMode ? ghibli2Song : ghibli1Song;
        if (targetSong && currentSong?.path !== targetSong.path) {
          playSong(targetSong);
        } else if (targetSong && !isPlaying) {
          audioRef.current.play();
          setIsPlaying(true);
        }
      } else if (themeStyle === 'retro') {
        if (retroSong && currentSong?.path !== retroSong.path) {
          playSong(retroSong);
        } else if (retroSong && !isPlaying) {
          audioRef.current.play();
          setIsPlaying(true);
        }
      } else {
        // If theme is NOT a specific music theme, and current song is one of the theme songs, pause and clear it
        if (currentSong && (
          currentSong.path === barbieSong?.path || 
          currentSong.path === vcSong?.path || 
          currentSong.path === saSong?.path || 
          currentSong.path === gta4Song?.path || 
          currentSong.path === gta5Song?.path || 
          currentSong.path === ghibli1Song?.path || 
          currentSong.path === ghibli2Song?.path ||
          currentSong.path === retroSong?.path
        )) {
          audioRef.current.pause();
          setIsPlaying(false);
          globalIsPlaying = false;
          setCurrentSong(null);
          globalCurrentSong = null;
        }
      }
    }
  }, [themeStyle, isDarkMode, gtaTheme, songs, currentSong]);

  const fetchSongs = async () => {
    try {
      const list = await window.api.listMusic();
      setSongs(list);
      
      // Auto-select barbie song if none selected
      if (!globalCurrentSong && list.length > 0) {
        const barbieSong = list.find(s => s.name.toLowerCase().includes('barbie'));
        if (barbieSong) {
          setCurrentSong(barbieSong);
          globalCurrentSong = barbieSong;
          audioRef.current.src = `file://${barbieSong.path}`;
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpload = async () => {
    try {
      const uploaded = await window.api.uploadMusic();
      if (uploaded && uploaded.length > 0) {
        await fetchSongs();
        if (!globalCurrentSong) {
          playSong(uploaded[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const playSong = (song) => {
    if (globalCurrentSong?.path !== song.path) {
      audioRef.current.src = `file://${song.path}`;
    }
    setCurrentSong(song);
    globalCurrentSong = song;
    audioRef.current.play();
    setIsPlaying(true);
    globalIsPlaying = true;
  };

  const togglePlay = () => {
    if (!currentSong && songs.length > 0) {
      playSong(songs[0]);
      return;
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      globalIsPlaying = false;
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      globalIsPlaying = true;
    }
  };

  const nextSong = () => {
    if (songs.length === 0) return;
    const currentIndex = songs.findIndex(s => s.path === currentSong?.path);
    const nextIndex = (currentIndex + 1) % songs.length;
    playSong(songs[nextIndex]);
  };

  const prevSong = () => {
    if (songs.length === 0) return;
    const currentIndex = songs.findIndex(s => s.path === currentSong?.path);
    const prevIndex = (currentIndex - 1 + songs.length) % songs.length;
    playSong(songs[prevIndex]);
  };

  useEffect(() => {
    const audio = audioRef.current;
    
    const updateTime = () => setProgress(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => nextSong();

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentSong, songs]);

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setProgress(time);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: 'var(--surface-color)',
      padding: '4px 12px',
      borderRadius: '24px',
      border: '2px solid var(--border-color)',
      boxShadow: 'var(--shadow-sm)',
      position: 'relative',
      fontFamily: "'Fredoka', cursive, sans-serif"
    }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button onClick={prevSong} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', padding: '4px' }}>
          <SkipBack size={16} />
        </button>
        <button onClick={togglePlay} style={{ 
          background: 'var(--accent-color)', 
          border: '2px solid var(--border-color)', 
          borderRadius: '50%', 
          width: '32px', height: '32px', 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          color: '#fff',
          boxShadow: '2px 2px 0px var(--border-color)'
        }}>
          {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
        </button>
        <button onClick={nextSong} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', padding: '4px' }}>
          <SkipForward size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '35px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatTime(progress)}</span>
        <input 
          type="range" 
          min={0} 
          max={duration || 100} 
          value={progress} 
          onChange={handleSeek}
          style={{ flex: 1, height: '6px', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
        />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '35px', textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>{formatTime(duration)}</span>
      </div>

      <div style={{ position: 'relative' }} ref={dropdownRef}>
        <button 
          onClick={() => setShowPlaylist(!showPlaylist)}
          style={{ 
            background: 'none', border: 'none', cursor: 'pointer', 
            color: 'var(--text-main)', display: 'flex', alignItems: 'center',
            padding: '4px'
          }}
        >
          <List size={18} />
        </button>

        {showPlaylist && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            marginTop: '8px',
            background: 'var(--surface-color)',
            border: '2px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-md)',
            width: '320px',
            zIndex: 1000,
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {songs.filter(s => !s.name.toLowerCase().includes('barbie') && !s.name.toLowerCase().includes('vice_city') && !s.name.toLowerCase().includes('gta_sa') && !s.name.toLowerCase().includes('gta4') && !s.name.toLowerCase().includes('gta5') && !s.name.toLowerCase().includes('ghibli') && !s.name.toLowerCase().includes('retro')).length === 0 ? (
                <div style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                  No music found
                </div>
              ) : (
                songs.filter(s => !s.name.toLowerCase().includes('barbie') && !s.name.toLowerCase().includes('vice_city') && !s.name.toLowerCase().includes('gta_sa') && !s.name.toLowerCase().includes('gta4') && !s.name.toLowerCase().includes('gta5') && !s.name.toLowerCase().includes('ghibli') && !s.name.toLowerCase().includes('retro')).map((song, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => playSong(song)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: currentSong?.path === song.path ? 'var(--accent-color)' : 'transparent',
                      color: currentSong?.path === song.path ? '#fff' : 'var(--text-main)',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {song.thumbnail ? (
                      <img src={song.thumbnail} alt="cover" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover' }} />
                    ) : (
                      <Music size={16} />
                    )}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                      {song.name}
                    </span>
                  </div>
                ))
              )}
            </div>
            
            <div style={{ borderTop: '2px dashed var(--border-color)', margin: '4px 0' }} />
            
            <button 
              onClick={handleUpload}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              <Upload size={16} />
              Upload Music
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
