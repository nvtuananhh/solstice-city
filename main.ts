// SOLSTICE CITY — hand-in program (round 15).
// Node 22, standard library only. The game is plain static files under game/,
// loaded offline by a desktop browser from game/index.html. This program copies
// game/ and screenshots/ next to this file into the hand-in directory and writes
// dossier.json there, using the kit's vendored make.fun library for the summary
// the judge reads. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The scorer's caps (from the kit's gate): at most 4 screenshots, each at most
// 256 KiB; game/ at most 993 files and 48 MiB in all, every path at most 1000
// bytes; dossier text at most 163,840 bytes; index.html at most 1 MiB.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

mkdirSync(outDir, { recursive: true });

// Start clean so a stale file from an earlier hand-in can never leak in.
rmSync(join(outDir, 'game'), { recursive: true, force: true });
rmSync(join(outDir, 'screenshots'), { recursive: true, force: true });
rmSync(join(outDir, 'dossier.json'), { force: true });

cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`solstice-city handed in to ${outDir}`);
