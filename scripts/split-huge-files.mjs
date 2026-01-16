import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjust this if your dist folder is located elsewhere
const DIST_DIR = path.resolve(__dirname, '../dist');
const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const MANIFEST_FILE = path.join(DIST_DIR, 'chunks-manifest.json');

// Recursively find files
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

async function splitFiles() {
  console.log(`Checking for large files in ${DIST_DIR}...`);

  if (!fs.existsSync(DIST_DIR)) {
    console.error('Dist directory not found!');
    process.exit(1);
  }

  const files = getAllFiles(DIST_DIR);
  const manifest = {};

  for (const filePath of files) {
    const stats = fs.statSync(filePath);

    if (stats.size > MAX_SIZE) {
      const relativePath = path
        .relative(DIST_DIR, filePath)
        .replace(/\\/g, '/');
      console.log(
        `Splitting ${relativePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`
      );

      const buffer = fs.readFileSync(filePath);
      const totalChunks = Math.ceil(stats.size / MAX_SIZE);

      manifest[relativePath] = totalChunks;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * MAX_SIZE;
        const end = Math.min(start + MAX_SIZE, stats.size);
        const chunk = buffer.subarray(start, end);
        const chunkPath = `${filePath}.part${i + 1}`;
        fs.writeFileSync(chunkPath, chunk);
        console.log(`  Created ${path.basename(chunkPath)}`);
      }

      // Remove original file
      fs.unlinkSync(filePath);
      console.log(`  Removed original file: ${relativePath}`);
    }
  }

  if (Object.keys(manifest).length > 0) {
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
    console.log(`Manifest written to ${MANIFEST_FILE}`);
  } else {
    console.log('No files needed splitting.');
  }
}

splitFiles().catch((error) => {
  console.error('Error splitting files:', error);
  process.exit(1);
});
