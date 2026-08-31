import fs from 'fs';
import path from 'path';

const targetFile = path.resolve('node_modules/@opennextjs/aws/dist/adapters/server-adapter.js');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  if (!content.includes('typeof __dirname')) {
    content = content.replace(
      'process.chdir(__dirname);',
      'if (typeof __dirname === "string" && __dirname.length > 0) { try { process.chdir(__dirname); } catch {} }'
    );
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[patch-opennext]: Patched process.chdir in OpenNext server-adapter.');
  }
}
