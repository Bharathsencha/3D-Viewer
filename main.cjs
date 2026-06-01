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
