#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

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
node scripts/make-hero-extension.mjs \\
  --source-video /absolute/path/scene04.mp4 \\
  --at 6.2 \\
  --out /absolute/path/scene05-hero-extension.mp4 \\
  --duration 8

Optional: --width 720 --height 1280 --fps 24 --zoom 1.08 --fade 0.3`;
}

function required(args, key) {
  const value = args[key];
  if (!value) throw new Error(`Missing --${key}\n${usage()}`);
  return String(value);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(usage());
  process.exit(0);
}

const source = resolve(required(args, 'source-video'));
const out = resolve(required(args, 'out'));
const at = Number(args.at ?? 0);
const duration = Number(args.duration ?? 8);
const width = Number(args.width ?? 720);
const height = Number(args.height ?? 1280);
const fps = Number(args.fps ?? 24);
const zoom = Number(args.zoom ?? 1.08);
const fade = Number(args.fade ?? 0.3);

if (!existsSync(source)) throw new Error(`Missing source video: ${source}`);
for (const [name, value] of Object.entries({ at, duration, width, height, fps, zoom, fade })) {
  if (!Number.isFinite(value)) throw new Error(`--${name} must be numeric`);
}
if (at < 0 || duration <= 0 || width <= 0 || height <= 0 || fps <= 0 || zoom < 1 || fade < 0) {
  throw new Error(`Invalid range\n${usage()}`);
}

mkdirSync(dirname(out), { recursive: true });
const tempDir = mkdtempSync(join(tmpdir(), 'food-ad-hero-'));
const still = join(tempDir, 'hero-source.jpg');
const totalFrames = Math.max(1, Math.round(duration * fps));
const zoomStep = Math.max(0.000001, (zoom - 1) / totalFrames);
const fadeOutStart = Math.max(0, duration - fade);

try {
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-ss', String(at), '-i', source,
    '-frames:v', '1', '-q:v', '2', still,
  ], { stdio: 'inherit' });

  const filter = [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
    `zoompan=z='min(zoom+${zoomStep.toFixed(8)},${zoom.toFixed(6)})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=${fps}`,
    fade > 0 ? `fade=t=in:st=0:d=${Math.min(fade, duration / 2).toFixed(3)}` : null,
    fade > 0 ? `fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${Math.min(fade, duration / 2).toFixed(3)}` : null,
  ].filter(Boolean).join(',');

  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-loop', '1', '-framerate', String(fps), '-i', still,
    '-vf', filter,
    '-frames:v', String(totalFrames),
    '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-crf', '16', '-preset', 'slow', out,
  ], { stdio: 'inherit' });

  const probe = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=width,height,r_frame_rate:format=duration',
    '-of', 'json', out,
  ], { encoding: 'utf8' }));

  console.log(JSON.stringify({
    ok: true,
    source_video: source,
    source_timestamp_s: at,
    output: out,
    method: 'local hero-frame slow push',
    probe,
  }, null, 2));
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

