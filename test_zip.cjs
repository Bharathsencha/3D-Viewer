const AdmZip = require('adm-zip');
const zip = new AdmZip();
zip.addFile("test.stl", Buffer.from("dummy stl content"));
zip.writeZip("dummy.zip");
