const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  extractArchive: (filePath) => ipcRenderer.invoke('models:extractArchive', filePath),
  generateThumbnail: (filePath) => ipcRenderer.invoke('models:generateThumbnail', filePath),
  scanLibraryDuplicates: () => ipcRenderer.invoke('models:scanLibraryDuplicates'),
  checkDuplicates: (filePaths) => ipcRenderer.invoke('models:checkDuplicates', filePaths),
  replaceFiles: (filesToReplace) => ipcRenderer.invoke('models:replaceFiles', filesToReplace),
  deleteFile: (filePaths) => ipcRenderer.invoke('models:deleteFile', filePaths),
  commitImport: (filesToImport, forceKeep) => ipcRenderer.invoke('models:commitImport', filesToImport, forceKeep),
  getScanStatus: () => ipcRenderer.invoke('models:getScanStatus'),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  checkExists: (filePath) => ipcRenderer.invoke('fs:checkExists', filePath),
  saveLibrary: (data) => ipcRenderer.invoke('library:save', data),
  loadLibrary: () => ipcRenderer.invoke('library:load'),
  basename: (filePath) => ipcRenderer.invoke('path:basename', filePath),
  joinPaths: (...paths) => ipcRenderer.invoke('path:join', ...paths),
  listMusic: () => ipcRenderer.invoke('music:list'),
  uploadMusic: () => ipcRenderer.invoke('music:upload'),
  getFileSize: (filePath) => ipcRenderer.invoke('fs:stat', filePath),
  getFilePath: (file) => webUtils.getPathForFile(file),
  onScanProgress: (callback) => ipcRenderer.on('scan-progress', (_event, value) => callback(value)),
  onUploadProgress: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('upload-progress', listener);
    return () => ipcRenderer.removeListener('upload-progress', listener);
  },
  onBackgroundTaskProgress: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('background-tasks', listener);
    return () => ipcRenderer.removeListener('background-tasks', listener);
  },
  getAppPath: () => ipcRenderer.invoke('get-app-path')
});
