// Auto-discovers source modules in ../sources/*.js. Each module default-exports a source descriptor:
//   { id, title, layer, description, run(ctx) }  -- see sources/README or any existing source.
// Drop a new file in sources/ and it's instantly available to the CLI. No registration needed.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sourcesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'sources');

export async function loadSources() {
  const out = [];
  for (const file of readdirSync(sourcesDir).filter((f) => f.endsWith('.js'))) {
    const mod = await import(pathToFileURL(join(sourcesDir, file)).href);
    if (mod.default?.id) out.push(mod.default);
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export async function getSource(id) {
  return (await loadSources()).find((s) => s.id === id) || null;
}
