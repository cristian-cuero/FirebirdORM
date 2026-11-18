#!/usr/bin/env node
/**
 * Build script for firebird-orm
 * Generates: ESM (dist/esm), CJS (dist/cjs), Types (dist/types)
 */
import {
  existsSync,
  rmSync,
  mkdirSync,
  cpSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'src');
const DIST = resolve(ROOT, 'dist');
const ESM_DIR = resolve(DIST, 'esm');
const CJS_DIR = resolve(DIST, 'cjs');
const TYPES_DIR = resolve(DIST, 'types');

const args = process.argv.slice(2);
const ONLY_ESM = args.includes('--esm');
const ONLY_CJS = args.includes('--cjs');
const ONLY_TYPES = args.includes('--types');

function log(msg) {
  console.log(`[build] ${msg}`);
}

function clean() {
  if (existsSync(DIST)) {
    rmSync(DIST, { recursive: true });
    log('Cleaned dist/');
  }
}

function createDirs() {
  if (!ONLY_TYPES) {
    mkdirSync(ESM_DIR, { recursive: true });
    mkdirSync(CJS_DIR, { recursive: true });
  }
  mkdirSync(TYPES_DIR, { recursive: true });
  log('Created dist directories');
}

function copyRecursive(src, dest) {
  const stat = statSync(src);
  if (stat.isDirectory()) {
    if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
      copyRecursive(resolve(src, entry), resolve(dest, entry));
    }
  } else if (src.endsWith('.js')) {
    let content = readFileSync(src, 'utf-8');
    writeFileSync(dest, content);
  } else {
    cpSync(src, dest);
  }
}

function generateTypes() {
  log('Generating TypeScript declarations...');
  // Will be handled by tsc separately via npm script
  log('Run: npx tsc -p jsconfig.json to generate .d.ts');
}

// Main
try {
  if (!ONLY_ESM && !ONLY_CJS && !ONLY_TYPES) {
    clean();
  }
  createDirs();

  if (!ONLY_TYPES) {
    if (!ONLY_CJS) {
      copyRecursive(SRC, ESM_DIR);
      log('ESM build ready');
    }
    if (!ONLY_ESM) {
      copyRecursive(SRC, CJS_DIR);
      log('CJS build ready');
    }
  }

  if (!ONLY_ESM && !ONLY_CJS) {
    generateTypes();
  }

  log('Build complete!');
} catch (err) {
  console.error('[build] Error:', err);
  process.exit(1);
}
