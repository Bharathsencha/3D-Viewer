const { createExtractorFromFile } = require('node-unrar-js');
const fs = require('fs');

async function test() {
  try {
    const extractor = await createExtractorFromFile({
      filepath: 'dummy.rar',
      targetPath: 'rar_test_out'
    });
    console.log(extractor);
    // Actually extractor might be an object: { extractor } 
    // Let's check its structure.
    const ext = extractor.extractor ? extractor.extractor : extractor;
    const res = ext.extract({ files: (f) => true });
    console.log("Extracted:", res);
  } catch(e) {
    console.error("Error:", e);
  }
}
test();
