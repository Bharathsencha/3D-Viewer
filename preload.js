const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  importFiles: (filePaths) => ipcRenderer.invoke('models:import', filePaths),
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
  getFilePath: (file) => webUtils.getPathForFile(file)
});
