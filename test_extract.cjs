const AdmZip = require('adm-zip');
const path = require('path');
const os = require('os');
const fs = require('fs');

async function extractArchive(archivePath) {
    const archiveName = path.basename(archivePath, path.extname(archivePath));
    const tempDir = path.join(os.tmpdir(), '3dviewer_extract_' + Date.now());
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    const ext = path.extname(archivePath).toLowerCase();
    if (ext === '.zip') {
      const zip = new AdmZip(archivePath);
      zip.extractAllTo(tempDir, true);
    }

    const validExtensions = ['3dm', '3ds', '3mf', 'amf', 'bim', 'brep', 'dae', 'fbx', 'fcstd', 'gltf', 'ifc', 'iges', 'step', 'stl', 'obj', 'off', 'ply', 'wrl', 'glb'];
    const extractedFiles = [];

    async function scanDir(dir, relPath) {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await scanDir(path.join(dir, entry.name), relPath.concat(entry.name));
        } else {
          const fileExt = entry.name.split('.').pop().toLowerCase();
          if (validExtensions.includes(fileExt)) {
            extractedFiles.push({
              path: path.join(dir, entry.name),
              relativeTreePath: relPath
            });
          }
        }
      }
    }
    await scanDir(tempDir, [archiveName]);

    return extractedFiles;
}

extractArchive('dummy.zip').then(console.log).catch(console.error);
