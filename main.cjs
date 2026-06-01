const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // needed so local .3dm files can be loaded via file:// protocol
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Open in full screen (maximized) by default
  mainWindow.maximize();

  // Remove the default Electron menu bar
  mainWindow.setMenu(null);

  // Load the React app
  mainWindow.loadFile(path.join(__dirname, 'shell', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  const musicDir = path.join(__dirname, 'music');
  if (!fs.existsSync(musicDir)) {
    fs.mkdirSync(musicDir, { recursive: true });
  }

  // Copy default Barbie song if it doesn't exist in the music folder
  const defaultSongSource = path.join(__dirname, 'assets', 'default_music', 'barbie.mp3');
  const defaultSongDest = path.join(musicDir, 'barbie.mp3');
  if (fs.existsSync(defaultSongSource) && !fs.existsSync(defaultSongDest)) {
    fs.copyFileSync(defaultSongSource, defaultSongDest);
  }

  ipcMain.handle('music:list', async () => {
    try {
      const mm = await import('music-metadata');
      const files = await fs.promises.readdir(musicDir);
      const validFiles = files.filter(f => f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg'));
      
      const results = [];
      for (const f of validFiles) {
        const fullPath = path.join(musicDir, f);
        let thumbnail = null;
        try {
          const metadata = await mm.parseFile(fullPath);
          if (metadata.common.picture && metadata.common.picture.length > 0) {
            const picture = metadata.common.picture[0];
            thumbnail = `data:${picture.format};base64,${picture.data.toString('base64')}`;
          }
        } catch (err) {
          // Ignore metadata errors
        }
        
        results.push({
          name: f,
          path: fullPath,
          thumbnail: thumbnail
        });
      }
      return results;
    } catch {
      return [];
    }
  });

  ipcMain.handle('music:upload', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] }]
    });
    if (result.canceled) return [];
    
    const copiedFiles = [];
    for (const filePath of result.filePaths) {
      const fileName = path.basename(filePath);
      const destPath = path.join(musicDir, fileName);
      await fs.promises.copyFile(filePath, destPath);
      copiedFiles.push({ name: fileName, path: destPath });
    }
    return copiedFiles;
  });

  ipcMain.handle('dialog:openFiles', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '3D Models', extensions: ['3dm', '3ds', '3mf', 'amf', 'bim', 'brep', 'dae', 'fbx', 'fcstd', 'gltf', 'ifc', 'iges', 'step', 'stl', 'obj', 'off', 'ply', 'wrl', 'glb'] }]
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('fs:readFile', async (event, filePath) => {
    try {
      const data = await fs.promises.readFile(filePath);
      return { data: data.buffer, name: path.basename(filePath) };
    } catch (e) {
      return null;
    }
  });

  ipcMain.handle('fs:checkExists', async (event, filePath) => {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('library:save', async (event, data) => {
    const userData = app.getPath('userData');
    const libraryPath = path.join(userData, 'library.json');
    await fs.promises.writeFile(libraryPath, JSON.stringify(data, null, 2));
  });

  ipcMain.handle('library:load', async () => {
    const userData = app.getPath('userData');
    const libraryPath = path.join(userData, 'library.json');
    try {
      const data = await fs.promises.readFile(libraryPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return []; // Return empty library if file doesn't exist
    }
  });

  ipcMain.handle('path:basename', (event, filePath) => path.basename(filePath));
  ipcMain.handle('path:join', (event, ...paths) => path.join(...paths));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
