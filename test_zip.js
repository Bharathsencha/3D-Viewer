const AdmZip = require('adm-zip');
const zip = new AdmZip();
zip.addFile("test.txt", Buffer.from("inner content"));
zip.writeZip("test.zip");
