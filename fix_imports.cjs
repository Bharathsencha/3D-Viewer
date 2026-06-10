const fs = require('fs');
for (const file of ['shell/src/VirtualFileList.jsx', 'shell/src/VirtualFileGrid.jsx']) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import \{ ([^}]+) \} from 'react-window';/, "import * as ReactWindow from 'react-window';\nconst { $1 } = ReactWindow;");
  content = content.replace(/import AutoSizer from 'react-virtualized-auto-sizer';/, "import AutoSizerWrapper from 'react-virtualized-auto-sizer';\nconst AutoSizer = AutoSizerWrapper.default || AutoSizerWrapper;");
  fs.writeFileSync(file, content);
}
