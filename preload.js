const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  checkExists: (filePath) => ipcRenderer.invoke('fs:checkExists', filePath),
  saveLibrary: (data) => ipcRenderer.invoke('library:save', data),
  loadLibrary: () => ipcRenderer.invoke('library:load'),
  basename: (filePath) => ipcRenderer.invoke('path:basename', filePath),
  joinPaths: (...paths) => ipcRenderer.invoke('path:join', ...paths)
});
