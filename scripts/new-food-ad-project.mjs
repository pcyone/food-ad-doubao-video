#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function usage() {
  return `Usage:
node scripts/new-food-ad-project.mjs \\
  --dish "客家酿豆腐" \\
  --out-dir /absolute/path/project \\
  --clips /absolute/path/1.mp4,/absolute/path/2.mp4 \\
  --script /absolute/path/narration.txt \\
  --duration 40 \\
  --generation-audit /absolute/path/generation-audit.json`;
}

function required(args, name) {
  const value = args[name];
  if (!value) throw new Error(`Missing --${name}\n${usage()}`);
  return value;
}

function safeName(name) {
  return name.replace(/[/:*?"<>|\\]/g, '').replace(/\s+/g, '').trim() || '美食广告';
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(usage());
  process.exit(0);
}
const dish = required(args, 'dish');
const outDir = resolve(args['out-dir'] || `./${safeName(dish)}-food-ad`);
const duration = Number(args.duration || 40);
const clips = String(args.clips || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
  .map((item) => resolve(item));
const narration = args.script
  ? readFileSync(resolve(String(args.script)), 'utf8').trim()
  : `请在这里粘贴「${dish}」最终确认的口播稿。`;
const generationAuditPath = args['generation-audit']
  ? resolve(String(args['generation-audit']))
  : null;
const generationAudit = generationAuditPath
  ? JSON.parse(readFileSync(generationAuditPath, 'utf8'))
  : null;

mkdirSync(outDir, { recursive: true });
const narrationPath = resolve(outDir, 'narration.txt');
const clipsPath = resolve(outDir, 'clips.txt');
const projectPath = resolve(outDir, 'project.json');
const runPath = resolve(outDir, 'run-command.txt');

if (!existsSync(narrationPath) || args.force) writeFileSync(narrationPath, `${narration}\n`);
if (!existsSync(clipsPath) || args.force) writeFileSync(clipsPath, `${clips.join('\n')}${clips.length ? '\n' : ''}`);

const project = {
  dish,
  duration,
  script: narrationPath,
  clips,
  out_dir: outDir,
  ambient_volume: Number(args['ambient-volume'] ?? 0.07),
  voice_delay: Number(args['voice-delay'] ?? 0.25),
  crf: Number(args.crf || 16),
  preset: String(args.preset || 'slow'),
};
if (generationAudit) project.generation_audit = generationAudit;
writeFileSync(projectPath, `${JSON.stringify(project, null, 2)}\n`);

const makeScript = resolve(import.meta.dirname, 'make-food-ad-video.mjs');
const command = `node ${shellQuote(makeScript)} --project ${shellQuote(outDir)}`;
writeFileSync(runPath, `${command}\n`);

console.log(JSON.stringify({
  ok: true,
  project: outDir,
  narration: narrationPath,
  clips: clipsPath,
  config: projectPath,
  generation_audit: generationAuditPath,
  run_command: command,
}, null, 2));
