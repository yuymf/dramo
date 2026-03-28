/**
 * Post-build script: adds .js extensions to relative imports in dist/
 * Required for Node.js ESM ("type": "module") runtime on Vercel.
 * tsc does not add .js extensions to compiled output.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';

const DIST = 'dist';

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

let fixed = 0;
for (const file of walk(DIST)) {
  let content = readFileSync(file, 'utf8');
  const original = content;

  // Match: from './foo' or from '../lib/bar' (without .js)
  content = content.replace(
    /from\s+['"](\.[^'"]+)['"]/g,
    (match, importPath) => {
      if (importPath.endsWith('.js')) return match;
      const absPath = resolve(dirname(file), importPath);
      if (existsSync(absPath + '.js')) {
        return match.replace(importPath, importPath + '.js');
      }
      if (existsSync(join(absPath, 'index.js'))) {
        return match.replace(importPath, importPath + '/index.js');
      }
      return match;
    }
  );

  if (content !== original) {
    writeFileSync(file, content);
    fixed++;
  }
}

console.log(`fix-esm-imports: patched ${fixed} files in dist/`);
