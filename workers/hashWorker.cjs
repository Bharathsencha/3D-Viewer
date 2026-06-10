const { parentPort } = require('worker_threads');
const fs = require('fs');
const rhino3dm = require('rhino3dm');
const { blake3 } = require('hash-wasm');

let rhino = null;

async function initRhino() {
  if (!rhino) {
    rhino = await rhino3dm();
  }
}

function parseAsciiStlGeometry(text) {
  // A simplistic parser for ASCII STL that extracts triangles
  // Extracts vertices and creates a binary-equivalent buffer for hashing
  const facetRegex = /facet\s+normal\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)[\s\S]*?outer\s+loop[\s\S]*?vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)[\s\S]*?vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)[\s\S]*?vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)[\s\S]*?endloop[\s\S]*?endfacet/g;
  const triangles = [];
  let match;
  while ((match = facetRegex.exec(text)) !== null) {
    triangles.push(match.slice(1, 13).map(Number));
  }
  
  const buffer = Buffer.alloc(4 + triangles.length * 50);
  buffer.writeUInt32LE(triangles.length, 0);
  let offset = 4;
  for (const tri of triangles) {
    for (let i = 0; i < 12; i++) {
      buffer.writeFloatLE(tri[i], offset);
      offset += 4;
    }
    buffer.writeUInt16LE(0, offset); // attribute byte count
    offset += 2;
  }
  return buffer;
}

function isBinaryStl(buffer) {
  if (buffer.length < 84) return false;
  // Check if there's an ASCII indicator (very rough heuristic, but standard STL parser logic)
  const headerStr = buffer.toString('utf8', 0, 80);
  if (headerStr.startsWith('solid ') && buffer.toString('utf8').indexOf('facet normal') !== -1) {
      // It claims to be solid and has facet normal -> likely ASCII
      // Let's verify by checking the binary triangle count vs file size
      const numTriangles = buffer.readUInt32LE(80);
      const expectedBinarySize = 84 + (numTriangles * 50);
      if (buffer.length !== expectedBinarySize) {
          return false;
      }
  }
  
  const numTriangles = buffer.readUInt32LE(80);
  const expectedBinarySize = 84 + (numTriangles * 50);
  return buffer.length === expectedBinarySize;
}

async function processFile(filePath) {
  const ext = filePath.toLowerCase().split('.').pop();
  
  if (ext === 'stl') {
    const buffer = fs.readFileSync(filePath);
    let hashBuffer;
    
    if (isBinaryStl(buffer)) {
      // Ignore 80-byte header, hash the rest (triangle count + triangles)
      hashBuffer = buffer.subarray(80);
    } else {
      // ASCII STL: normalize to binary format buffer
      const text = buffer.toString('utf8');
      hashBuffer = parseAsciiStlGeometry(text);
    }
    
    // Hash using BLAKE3
    return await blake3(hashBuffer);
  } else if (ext === '3dm') {
    await initRhino();
    const buffer = fs.readFileSync(filePath);
    const doc = rhino.File3dm.fromByteArray(new Uint8Array(buffer));
    
    const objects = doc.objects();
    const count = objects.count;
    
    const geoStrings = [];
    for (let i = 0; i < count; i++) {
      const obj = objects.get(i);
      const geometry = obj.geometry();
      if (geometry) {
        geoStrings.push(JSON.stringify(geometry.toJSON({})));
      }
    }
    // Sort to handle potential re-ordering of objects
    geoStrings.sort();
    
    const dataToHash = geoStrings.join('\n');
    return await blake3(dataToHash);
  } else {
    throw new Error('Unsupported file extension');
  }
}

parentPort.on('message', async (message) => {
  if (message.type === 'hash') {
    try {
      const hash = await processFile(message.filePath);
      parentPort.postMessage({ id: message.id, hash });
    } catch (error) {
      parentPort.postMessage({ id: message.id, error: error.message });
    }
  }
});
