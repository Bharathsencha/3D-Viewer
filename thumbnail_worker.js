// We will preload this script into the hidden window
const { ipcRenderer } = require('electron');

let currentResolve = null;
let currentReject = null;

window.addEventListener('load', () => {
    // Override the LoadModel method or just wait for OV events
    if (window.OV && window.OV.app) {
        // Wait, how do we hook into OnModelLoaded?
        // Let's check source/engine/viewer/viewer.js or app.js
    }
});
