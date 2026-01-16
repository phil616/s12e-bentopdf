import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target the public directory
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const MANIFEST_FILE = path.join(PUBLIC_DIR, 'chunks-manifest.json');

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
  console.log(`Checking for large files in ${PUBLIC_DIR}...`);

  if (!fs.existsSync(PUBLIC_DIR)) {
    console.error('Public directory not found!');
    process.exit(1);
  }

  const files = getAllFiles(PUBLIC_DIR);

  // Load existing manifest if any
  let manifest = {};
  if (fs.existsSync(MANIFEST_FILE)) {
    try {
      manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
    } catch (e) {
      console.warn('Could not parse existing manifest, starting fresh.');
    }
  }

  let changed = false;

  for (const filePath of files) {
    // Skip the manifest file itself
    if (filePath === MANIFEST_FILE) continue;

    const stats = fs.statSync(filePath);

    if (stats.size > MAX_SIZE) {
      const relativePath = path
        .relative(PUBLIC_DIR, filePath)
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
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
    console.log(`Manifest updated at ${MANIFEST_FILE}`);
  } else {
    console.log('No new files needed splitting.');
  }
}

splitFiles().catch((error) => {
  console.error('Error splitting files:', error);
  process.exit(1);
});
