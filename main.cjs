const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Worker } = require('worker_threads');
const { autoUpdater } = require('electron-updater');
const db = require('./database.cjs');

// Thumbnail logic removed per user request

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // needed so local .3dm files can be loaded via file:// protocol
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  // Open in full screen (maximized) by default
  mainWindow.maximize();

  // Remove the default Electron menu bar
  mainWindow.setMenu(null);

  // Load the React app
  mainWindow.loadFile(path.join(__dirname, 'shell', 'dist', 'index.html'));
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}

if (gotTheLock) {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() => {
    const musicDir = path.join(app.getPath('userData'), 'music');
    if (!fs.existsSync(musicDir)) {
    fs.mkdirSync(musicDir, { recursive: true });
  }

  const modelsDir = path.join(app.getPath('userData'), 'models');
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }

  db.initDatabase();
  autoUpdater.checkForUpdatesAndNotify();

  const numWorkers = Math.min(os.cpus().length, 8); // cap at 8
  const workers = [];
  const idleWorkers = [];
  const taskQueue = [];
  let nextTaskId = 1;
  const pendingTasks = new Map();

  function processNextTask() {
    while (taskQueue.length > 0 && idleWorkers.length > 0) {
      const task = taskQueue.shift();
      const worker = idleWorkers.pop();
      worker.postMessage(task);
    }
  }

  for (let i = 0; i < numWorkers; i++) {
    const worker = new Worker(path.join(__dirname, 'workers', 'hashWorker.cjs'));
    worker.on('message', (msg) => {
      if (pendingTasks.has(msg.id)) {
        pendingTasks.get(msg.id)(msg);
        pendingTasks.delete(msg.id);
      }
      idleWorkers.push(worker);
      processNextTask();
    });
    worker.on('error', (err) => {
      console.error('Worker crashed:', err);
    });
    worker.on('exit', (code) => {
      if (code !== 0) console.error(`Worker stopped with exit code ${code}`);
    });
    idleWorkers.push(worker);
    workers.push(worker);
  }

  function hashFileAsync(filePath) {
    return new Promise((resolve, reject) => {
      const id = nextTaskId++;
      pendingTasks.set(id, (msg) => {
        if (msg.error) reject(new Error(msg.error));
        else resolve(msg.hash);
      });
      taskQueue.push({ id, type: 'hash', filePath });
      processNextTask();
    });
  }

  let initialScanFinished = false;
  let initialScanTotal = 0;

  (async () => {
    try {
      const allFiles = await fs.promises.readdir(modelsDir);
      const targetFiles = allFiles.filter(f => f.toLowerCase().endsWith('.stl') || f.toLowerCase().endsWith('.3dm'));
      const existingHashedFiles = db.getAllHashedFiles();
      
      for (const hashedFile of existingHashedFiles) {
        if (!targetFiles.includes(hashedFile)) {
          db.deleteHash(hashedFile);
        }
      }
      
      const filesToHash = targetFiles.filter(f => !existingHashedFiles.includes(f));
      
      initialScanTotal = filesToHash.length;
      if (initialScanTotal === 0) {
        initialScanFinished = true;
      }
      
      let count = 0;
      await Promise.all(filesToHash.map(async (file) => {
        try {
          const fullPath = path.join(modelsDir, file);
          const hash = await hashFileAsync(fullPath);
          db.insertHash(hash, file);
        } catch (e) {
          console.error(`Failed to hash ${file}:`, e);
        }
        count++;
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('scan-progress', { current: count, total: filesToHash.length });
        });
      }));
      initialScanFinished = true;
    } catch (e) {
      console.error('Error during initial scan:', e);
      initialScanFinished = true;
    }
  })();

  ipcMain.handle('models:getScanStatus', () => ({ finished: initialScanFinished, total: initialScanTotal }));

  ipcMain.handle('models:extractArchive', async (event, filePath) => {
    try {
      const { extractArchive } = require('./patch_archive.cjs');
      const files = await extractArchive(filePath);
      return files;
    } catch (err) {
      console.error('Error extracting archive:', err);
      return [];
    }
  });

  ipcMain.handle('models:scanLibraryDuplicates', async (event) => {
    try {
      const allFiles = await fs.promises.readdir(modelsDir);
      const targetFiles = allFiles.filter(f => f.toLowerCase().endsWith('.stl') || f.toLowerCase().endsWith('.3dm'));
      
      const fileHashMap = new Map();
      const duplicates = [];
      
      for (const file of targetFiles) {
        const fullPath = path.join(modelsDir, file);
        try {
          let hash = db.getHashByFilename(file);
          if (!hash) {
            hash = await hashFileAsync(fullPath);
            db.insertHash(hash, file);
          }
          
          if (fileHashMap.has(hash)) {
            const existingFile = fileHashMap.get(hash);
            duplicates.push({
              original: file.replace(/^\d{13}_/, ''),
              existing: existingFile.replace(/^\d{13}_/, ''),
              existingPath: path.join(modelsDir, existingFile),
              path: fullPath,
              hash
            });
          } else {
            fileHashMap.set(hash, file);
          }
        } catch (err) {
          console.error(`Failed to process duplicate check for file: ${file}`, err);
        }
      }
      return duplicates;
    } catch (err) {
      console.error('Failed to scan library for duplicates:', err);
      return [];
    }
  });

  ipcMain.handle('models:checkDuplicates', async (event, filePaths) => {
    const duplicates = [];
    const nonDuplicates = [];
    let count = 0;
    for (const filePath of filePaths) {
      count++;
      event.sender.send('upload-progress', { current: count, total: filePaths.length });
      const fileName = path.basename(filePath);
      const ext = fileName.toLowerCase().split('.').pop();
      if (ext === 'stl' || ext === '3dm') {
        try {
          const hash = await hashFileAsync(filePath);
          const existing = db.getExistingFilenameByHash(hash);
          if (existing) {
            duplicates.push({ original: fileName, existing, existingPath: path.join(modelsDir, existing), path: filePath, hash });
          } else {
            nonDuplicates.push({ original: fileName, path: filePath, hash });
          }
        } catch (err) {
          console.error('Error hashing file:', err);
          nonDuplicates.push({ original: fileName, path: filePath, hash: null });
        }
      } else {
        nonDuplicates.push({ original: fileName, path: filePath, hash: null });
      }
    }
    return { duplicates, nonDuplicates };
  });

  function generateDuplicateName(originalName, attempt) {
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext);
    return `${base}(${attempt}D)${ext}`;
  }

  ipcMain.handle('models:replaceFiles', async (event, filesToReplace) => {
    // filesToReplace: [{ original, existing, existingPath, path: newFilePath, hash }, ...]
    for (const fileObj of filesToReplace) {
      try {
        // Delete the old file
        await fs.promises.unlink(fileObj.existingPath);
        // Copy the new file over the old file's exact location (retaining the existing filename)
        await fs.promises.copyFile(fileObj.path, fileObj.existingPath);
        // The hash in the DB is the same, so we don't need to change the DB
      } catch (err) {
        console.error('Failed to replace file:', err);
      }
    }
    return true;
  });

  ipcMain.handle('models:deleteFile', async (event, filePaths) => {
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
        db.deleteHash(path.basename(filePath));
      } catch (err) {
        console.error('Failed to delete file:', filePath, err);
      }
    }
    return true;
  });

  ipcMain.handle('models:commitImport', async (event, filesToImport, globalForceKeep = false) => {
    const copiedPaths = [];
    const existingFiles = await fs.promises.readdir(modelsDir);

    for (const fileObj of filesToImport) {
      const { original, path: filePath, hash, forceKeep } = fileObj;
      let finalName = original;
      
      if ((globalForceKeep || forceKeep) && hash) {
        let attempt = 1;
        let candidateName = generateDuplicateName(original, attempt);
        while (existingFiles.some(f => f.endsWith('_' + candidateName))) {
            attempt++;
            candidateName = generateDuplicateName(original, attempt);
        }
        finalName = candidateName;
      }

      const uniqueDestName = Date.now() + '_' + finalName;
      const destPath = path.join(modelsDir, uniqueDestName);
      
      await fs.promises.copyFile(filePath, destPath);
      if (hash) {
        db.insertHash(hash, uniqueDestName);
      }
      copiedPaths.push(destPath);
    }
    return copiedPaths;
  });
  ipcMain.handle('music:list', async () => {
    try {
      const mm = await import('music-metadata');
      const files = await fs.promises.readdir(musicDir);
      const validFiles = files.filter(f => {
        const ext = f.toLowerCase();
        return ext.endsWith('.mp3') || ext.endsWith('.wav') || ext.endsWith('.ogg') || ext.endsWith('.m4a') || ext.endsWith('.flac') || ext.endsWith('.aac');
      });
      
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
      filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'] }]
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
      filters: [{ name: '3D Models & Archives', extensions: ['3dm', '3ds', '3mf', 'amf', 'bim', 'brep', 'dae', 'fbx', 'fcstd', 'gltf', 'ifc', 'iges', 'step', 'stl', 'obj', 'off', 'ply', 'wrl', 'glb', 'zip', 'rar'] }]
    });
    if (result.canceled) return [];
    
    return result.filePaths;
  });

  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('fs:scanPath', async (event, itemPath) => {
    const results = [];
    async function traverse(currentPath, baseParent) {
      const stats = await fs.promises.stat(currentPath);
      if (stats.isDirectory()) {
        const files = await fs.promises.readdir(currentPath);
        for (const file of files) {
          await traverse(path.join(currentPath, file), baseParent);
        }
      } else {
        const ext = currentPath.split('.').pop().toLowerCase();
        const supported = ['3dm', '3ds', '3mf', 'amf', 'bim', 'brep', 'dae', 'fbx', 'fcstd', 'gltf', 'ifc', 'iges', 'step', 'stl', 'obj', 'off', 'ply', 'wrl', 'glb'];
        if (supported.includes(ext)) {
          results.push({
            absolutePath: currentPath,
            relativePath: path.relative(baseParent, currentPath).replace(/\\/g, '/')
          });
        }
      }
    }
    try {
      const stats = await fs.promises.stat(itemPath);
      if (stats.isDirectory()) {
        const parentDir = path.dirname(itemPath);
        await traverse(itemPath, parentDir);
      } else {
        results.push({
          absolutePath: itemPath,
          relativePath: path.basename(itemPath)
        });
      }
      return results;
    } catch (err) {
      console.error('Failed to scan path:', err);
      return [];
    }
  });

  ipcMain.handle('fs:readFile', async (event, filePath) => {
    try {
      const data = await fs.promises.readFile(filePath);
      return { data: data.buffer, name: path.basename(filePath) };
    } catch (e) {
      return null;
    }
  });

  ipcMain.handle('fs:stat', async (event, filePath) => {
    try {
      const stats = await fs.promises.stat(filePath);
      return { size: stats.size, mtimeMs: stats.mtimeMs };
    } catch (e) {
      return { size: 0, mtimeMs: 0 };
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

  ipcMain.handle('get-app-path', () => __dirname);

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
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
