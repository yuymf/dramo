import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'specs/001-ai-ai-ai/contracts/openapi.yaml');
const outDir = path.join(root, 'public');
const out = path.join(outDir, 'openapi.json');

try {
  const yamlText = fs.readFileSync(src, 'utf8');
  const doc = yaml.parse(yamlText);
  if (!doc || !doc.openapi) throw new Error('Invalid OpenAPI file');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(out, JSON.stringify(doc, null, 2));
  console.log('OpenAPI exported to', out);
  process.exit(0);
} catch (err) {
  console.error('OpenAPI export failed:', err.message);
  process.exit(1);
}
