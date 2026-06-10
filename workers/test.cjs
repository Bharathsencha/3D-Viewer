const fs = require('fs');
const rhino3dm = require('rhino3dm');
const { blake3 } = require('hash-wasm');

async function run() {
  const rhino = await rhino3dm();
  console.log('rhino3dm loaded');
  console.log('blake3 available:', typeof blake3);
}
run().catch(console.error);
