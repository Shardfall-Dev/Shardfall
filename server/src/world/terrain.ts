/* The world's walkable ground for the server: server/data/world.bin.gz, exported from the game build by tools/export-world.py,
   checked against its manifest (server/data/world.json) at start-up. */
import fs = require('node:fs');
import path = require('node:path');
import zlib = require('node:zlib');
import crypto = require('node:crypto');
import COL = require('../../../shared/collision');

export interface Terrain {
  world: COL.World; hash: string; build: string;
  spawns: Record<string, { x: number; y: number; bound: string }>;
  shrines: { id: string; x: number; y: number }[];
}

export function loadTerrain(repoRoot: string): Terrain {
  const dir = path.join(repoRoot, 'server', 'data');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'world.json'), 'utf8'));
  const raw = zlib.gunzipSync(fs.readFileSync(path.join(dir, 'world.bin.gz')));
  const sha = crypto.createHash('sha256').update(raw).digest('hex');
  if (sha !== manifest.sha256) throw new Error('server/data/world.bin.gz does not match world.json — run python3 tools/export-world.py');
  const world = COL.decode(raw);
  const hash = COL.hash(world);
  if (hash !== manifest.hash) throw new Error(`world hash ${hash} differs from the manifest's ${manifest.hash}`);
  return { world, hash, build: manifest.build, spawns: manifest.spawns, shrines: manifest.shrines };
}
