const AdmZip = require('adm-zip');
const { createExtractorFromFile } = require('node-unrar-js');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function extractArchive(archivePath) {
    const archiveName = path.basename(archivePath, path.extname(archivePath));
    const tempDir = path.join(os.tmpdir(), '3dviewer_extract_' + Date.now());
    await fs.promises.mkdir(tempDir, { recursive: true });

    const ext = path.extname(archivePath).toLowerCase();
    
    if (ext === '.zip') {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(archivePath);
      zip.extractAllTo(tempDir, true);
    } else if (ext === '.rar') {
      const { createExtractorFromFile } = require('node-unrar-js');
      const extractor = await createExtractorFromFile({
        filepath: archivePath
      });
      const { files } = extractor.extract({ files: (f) => true });
      for (const file of files) {
        if (!file.fileHeader.flags.directory) {
          const outPath = path.join(tempDir, file.fileHeader.name);
          await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
          await fs.promises.writeFile(outPath, file.extraction);
        }
      }
    }

    const validExtensions = ['3dm', '3ds', '3mf', 'amf', 'bim', 'brep', 'dae', 'fbx', 'fcstd', 'gltf', 'ifc', 'iges', 'step', 'stl', 'obj', 'off', 'ply', 'wrl', 'glb'];
    const extractedFiles = [];

    async function scanDir(dir, baseDir) {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await scanDir(path.join(dir, entry.name), baseDir);
        } else {
          const fileExt = entry.name.split('.').pop().toLowerCase();
          if (validExtensions.includes(fileExt)) {
            extractedFiles.push({
              absolutePath: path.join(dir, entry.name),
              relativePath: path.relative(baseDir, path.join(dir, entry.name))
            });
          }
        }
      }
    }

    await scanDir(tempDir, tempDir);
    return extractedFiles;
}

module.exports = { extractArchive };
