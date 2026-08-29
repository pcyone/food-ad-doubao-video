#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const DEFAULT_ENV_CANDIDATES = [
  resolve(process.cwd(), '.env.local'),
  join(homedir(), 'Documents', '短视频相关', 'tang-paper-video', '.env.local'),
  join(homedir(), 'Documents', '短视频相关', 'knowledge-paper-template', '.env.local'),
];

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
node scripts/make-food-ad-video.mjs \\
  --dish "客家酿豆腐" \\
  --script /absolute/path/narration.txt \\
  --clips /absolute/path/1.mp4,/absolute/path/2.mp4 \\
  --out-dir /absolute/path/out \\
  --duration 40 \\
  --generation-audit /absolute/path/generation-audit.json

Or:
node scripts/make-food-ad-video.mjs --project /absolute/path/food-ad-project

Verification only:
node scripts/make-food-ad-video.mjs \\
  --verify-existing /absolute/path/final.mp4 \\
  --out-dir /absolute/path/verification-output`;
}

function loadEnv(file) {
  if (!existsSync(file)) throw new Error(`Missing Doubao config: ${file}`);
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at < 1) continue;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function requiredArg(args, name) {
  const value = args[name];
  if (!value) throw new Error(`Missing --${name}\n${usage()}`);
  return value;
}

function parseStreamedObjects(raw) {
  const items = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          items.push(JSON.parse(raw.slice(start, i + 1)));
        } catch {
          // Ignore keep-alive or partial fragments.
        }
        start = -1;
      }
    }
  }
  return items;
}

function ffprobeJSON(file, extra = []) {
  return JSON.parse(execFileSync('ffprobe', [
    '-v', 'error',
    ...extra,
    '-of', 'json',
    file,
  ], { encoding: 'utf8' }));
}

function duration(file) {
  const output = execFileSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1',
    file,
  ], { encoding: 'utf8' }).trim();
  return Number(output);
}

function readLines(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

function clipInfo(file) {
  const data = ffprobeJSON(file, ['-show_entries', 'stream=codec_type:format=duration']);
  const streams = data.streams || [];
  return {
    file,
    duration: Number(data.format?.duration || 0),
    hasAudio: streams.some((stream) => stream.codec_type === 'audio'),
  };
}

function safeName(name) {
  return name.replace(/[/:*?"<>|\\]/g, '').replace(/\s+/g, '').trim() || '美食广告';
}

async function synthesizeDoubao({ text, envFile, outDir, speechRate }) {
  loadEnv(envFile);
  mkdirSync(outDir, { recursive: true });
  const apiKey = requiredEnv('DOUBAO_TTS_API_KEY');
  const resourceId = requiredEnv('DOUBAO_TTS_RESOURCE_ID');
  const speaker = requiredEnv('DOUBAO_TTS_SPEAKER');
  const model = process.env.DOUBAO_TTS_MODEL?.trim() || '';
  const pcmPath = resolve(outDir, 'voiceover_raw.pcm');
  const wavPath = resolve(outDir, 'voiceover_doubao_raw.wav');
  const reqParams = {
    text,
    speaker,
    audio_params: {
      format: 'pcm',
      sample_rate: 24000,
      speech_rate: Number.isFinite(speechRate) ? speechRate : Number(process.env.DOUBAO_TTS_SPEECH_RATE ?? -2),
      loudness_rate: 0,
    },
    additions: JSON.stringify({
      explicit_language: 'zh',
      enable_language_detector: true,
      disable_markdown_filter: true,
      silence_duration: 120,
    }),
  };
  if (model) reqParams.model = model;

  const response = await fetch('https://openspeech.bytedance.com/api/v3/tts/unidirectional', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Connection: 'keep-alive',
      'X-Api-Key': apiKey,
      'X-Api-Resource-Id': resourceId,
      'X-Api-Request-Id': randomUUID(),
    },
    body: JSON.stringify({
      user: { uid: `food-ad-${randomUUID()}` },
      req_params: reqParams,
    }),
  });

  const messages = parseStreamedObjects(await response.text());
  const audio = Buffer.concat(
    messages
      .filter((item) => item.code === 0 && typeof item.data === 'string')
      .map((item) => Buffer.from(item.data, 'base64')),
  );
  if (!response.ok || !messages.some((item) => item.code === 20000000) || !audio.length) {
    const failure = messages.find((item) => typeof item.code === 'number' && ![0, 20000000].includes(item.code));
    throw new Error(`Doubao synthesis failed: ${failure?.message || response.status}`);
  }

  writeFileSync(pcmPath, audio);
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', pcmPath,
    '-af', 'silenceremove=start_periods=1:start_duration=0.04:start_threshold=-50dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_duration=0.06:start_threshold=-50dB:start_silence=0.06,areverse,afade=t=in:st=0:d=0.02,alimiter=limit=0.95',
    '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', wavPath,
  ]);
  return wavPath;
}

function buildConcatFilter({ clipInfos, voiceIndex, tempo, voiceDelay, targetDuration, ambientVolume }) {
  const videoParts = clipInfos.map((_, index) =>
    `[${index}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=24,setsar=1,setpts=PTS-STARTPTS[v${index}]`
  );
  const audioParts = clipInfos.map((info, index) => {
    if (info.hasAudio) {
      return `[${index}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=${ambientVolume}[a${index}]`;
    }
    const duration = Math.max(0.1, info.duration).toFixed(3);
    return `anullsrc=channel_layout=stereo:sample_rate=48000,atrim=0:${duration},volume=0[a${index}]`;
  });
  const videoLabels = clipInfos.map((_, index) => `[v${index}]`).join('');
  const audioLabels = clipInfos.map((_, index) => `[a${index}]`).join('');
  const delayMs = Math.max(0, Math.round(voiceDelay * 1000));
  const fadeOutStart = Math.max(0, targetDuration - 0.4).toFixed(3);
  return [
    ...videoParts,
    `${videoLabels}concat=n=${clipInfos.length}:v=1:a=0,fade=t=in:st=0:d=0.2,fade=t=out:st=${Math.max(0, targetDuration - 0.3).toFixed(3)}:d=0.3[vout]`,
    ...audioParts,
    `${audioLabels}concat=n=${clipInfos.length}:v=0:a=1[amb]`,
    `[${voiceIndex}:a]atempo=${tempo.toFixed(4)},loudnorm=I=-16:LRA=8:TP=-1.5,adelay=${delayMs}|${delayMs},apad,atrim=0:${targetDuration},afade=t=out:st=${fadeOutStart}:d=0.4[vo]`,
    `[amb][vo]amix=inputs=2:duration=first:weights=0.22 1:dropout_transition=0,alimiter=limit=0.98[aout]`,
  ].join(';');
}

function makeContactSheet({ finalPath, outPath, targetDuration }) {
  const points = [
    1,
    targetDuration * 0.25,
    targetDuration * 0.5,
    targetDuration * 0.75,
    Math.max(1, targetDuration - 1),
  ].map((second) => Math.round(second * 24));
  const selectExpr = points.map((frame) => `eq(n\\,${frame})`).join('+');
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', finalPath,
    '-vf', `select='${selectExpr}',scale=270:480,tile=5x1`,
    '-frames:v', '1',
    outPath,
  ]);
}

function runFfmpegInspection(args, label) {
  const result = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = String(result.stderr || '').trim().split(/\r?\n/).slice(-8).join('\n');
    throw new Error(`${label} failed${detail ? `:\n${detail}` : ''}`);
  }
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

function inspectFinalMedia(finalPath) {
  runFfmpegInspection([
    '-hide_banner', '-v', 'error', '-i', finalPath, '-f', 'null', '-',
  ], 'Full decode');

  const blackLog = runFfmpegInspection([
    '-hide_banner', '-v', 'info', '-i', finalPath,
    '-vf', 'blackdetect=d=0.5:pix_th=0.10', '-an', '-f', 'null', '-',
  ], 'Black-frame inspection');
  const blackSegments = [...blackLog.matchAll(/black_duration:([0-9.]+)/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);

  const volumeLog = runFfmpegInspection([
    '-hide_banner', '-v', 'info', '-i', finalPath,
    '-map', '0:a:0', '-af', 'volumedetect', '-f', 'null', '-',
  ], 'Volume inspection');
  const meanMatch = volumeLog.match(/mean_volume:\s*(-?[0-9.]+) dB/);
  const maxMatch = volumeLog.match(/max_volume:\s*(-?[0-9.]+) dB/);

  return {
    full_decode_pass: true,
    black_segments_over_0_5s: blackSegments.length,
    black_segment_durations_s: blackSegments,
    audio_mean_volume_db: meanMatch ? Number(meanMatch[1]) : null,
    audio_max_volume_db: maxMatch ? Number(maxMatch[1]) : null,
  };
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(usage());
  process.exit(0);
}
if (args['verify-existing']) {
  const finalPath = resolve(String(args['verify-existing']));
  if (!existsSync(finalPath)) throw new Error(`Missing video to verify: ${finalPath}`);
  const outDir = resolve(args['out-dir'] || dirname(finalPath));
  const targetDuration = Number(args.duration || duration(finalPath));
  if (!Number.isFinite(targetDuration) || targetDuration <= 0) {
    throw new Error('Unable to determine a positive verification duration.');
  }
  mkdirSync(outDir, { recursive: true });
  const contactSheet = resolve(outDir, '关键帧检查.jpg');
  makeContactSheet({ finalPath, outPath: contactSheet, targetDuration });
  const qa = inspectFinalMedia(finalPath);
  const verification = {
    dish: args.dish || basename(finalPath).split('_')[0] || '未指定菜品',
    verification_mode: 'existing-file',
    final: finalPath,
    target_duration_s: targetDuration,
    contact_sheet: contactSheet,
    video_probe: ffprobeJSON(finalPath, ['-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,nb_frames', '-show_entries', 'format=duration,size']),
    audio_probe: ffprobeJSON(finalPath, ['-select_streams', 'a:0', '-show_entries', 'stream=codec_name,sample_rate,channels', '-show_entries', 'format=duration']),
    qa,
  };
  const verificationPath = resolve(outDir, 'verification.json');
  writeFileSync(verificationPath, JSON.stringify(verification, null, 2));
  console.log(JSON.stringify({
    ok: true,
    verification_mode: 'existing-file',
    contact_sheet: contactSheet,
    verification: verificationPath,
    qa,
  }, null, 2));
  process.exit(0);
}
const projectDir = args.project ? resolve(String(args.project)) : null;
const projectConfigPath = projectDir ? resolve(projectDir, 'project.json') : null;
const projectConfig = projectConfigPath && existsSync(projectConfigPath)
  ? JSON.parse(readFileSync(projectConfigPath, 'utf8'))
  : {};
const dish = args.dish || projectConfig.dish || requiredArg(args, 'dish');
const scriptPath = resolve(args.script || projectConfig.script || (projectDir ? resolve(projectDir, 'narration.txt') : requiredArg(args, 'script')));
const clipInput = args.clips || (Array.isArray(projectConfig.clips) ? projectConfig.clips.join(',') : '');
const clips = (clipInput ? clipInput.split(',') : (projectDir ? readLines(resolve(projectDir, 'clips.txt')) : []))
  .map((item) => resolve(item.trim()))
  .filter(Boolean);
const outDir = resolve(args['out-dir'] || projectConfig.out_dir || projectConfig.outDir || projectDir || `./${safeName(dish)}-food-ad`);
const targetDuration = Number(args.duration || projectConfig.duration || 40);
const voiceDelay = Number(args['voice-delay'] ?? projectConfig.voice_delay ?? projectConfig.voiceDelay ?? 0.25);
const ambientVolume = Number(args['ambient-volume'] ?? projectConfig.ambient_volume ?? projectConfig.ambientVolume ?? 0.07);
const crf = String(args.crf || projectConfig.crf || 16);
const preset = String(args.preset || projectConfig.preset || 'slow');
const discoveredEnv = DEFAULT_ENV_CANDIDATES.find((candidate) => existsSync(candidate));
const envFile = resolve(
  args.env
  || projectConfig.env
  || process.env.DOUBAO_TTS_ENV_FILE
  || discoveredEnv
  || DEFAULT_ENV_CANDIDATES[0]
);
const speechRate = args['speech-rate'] == null && projectConfig.speech_rate == null && projectConfig.speechRate == null
  ? NaN
  : Number(args['speech-rate'] ?? projectConfig.speech_rate ?? projectConfig.speechRate);
const generationAuditPath = args['generation-audit'] ? resolve(String(args['generation-audit'])) : null;
const generationAudit = generationAuditPath
  ? JSON.parse(readFileSync(generationAuditPath, 'utf8'))
  : (projectConfig.generation_audit ?? projectConfig.generationAudit ?? null);

if (!existsSync(scriptPath)) throw new Error(`Missing narration script: ${scriptPath}`);
if (!clips.length) throw new Error('No clips provided.');
for (const clip of clips) {
  if (!existsSync(clip)) throw new Error(`Missing clip: ${clip}`);
}
if (!Number.isFinite(targetDuration) || targetDuration <= 0) throw new Error('--duration must be a positive number.');

mkdirSync(outDir, { recursive: true });
const clipInfos = clips.map((clip) => clipInfo(clip));
const text = readFileSync(scriptPath, 'utf8').replace(/\n{2,}/g, '\n').trim();
const voicePath = await synthesizeDoubao({
  text,
  envFile,
  outDir: resolve(outDir, 'audio'),
  speechRate,
});
const rawVoiceDuration = duration(voicePath);
const effectiveVoiceWindow = Math.max(1, targetDuration - voiceDelay);
const tempo = rawVoiceDuration / effectiveVoiceWindow;
if (tempo < 0.88 || tempo > 1.18) {
  throw new Error(`Narration duration ${rawVoiceDuration.toFixed(2)}s is mismatched for ${targetDuration}s video; required tempo ${tempo.toFixed(3)} is outside the safe 0.88-1.18 range.`);
}

const finalPath = resolve(outDir, `${safeName(dish)}_高端美食广告_${Math.round(targetDuration)}s.mp4`);
const filter = buildConcatFilter({
  clipInfos,
  voiceIndex: clips.length,
  tempo,
  voiceDelay,
  targetDuration,
  ambientVolume,
});
execFileSync('ffmpeg', [
  '-hide_banner', '-y',
  ...clips.flatMap((clip) => ['-i', clip]),
  '-i', voicePath,
  '-filter_complex', filter,
  '-map', '[vout]',
  '-map', '[aout]',
  '-t', String(targetDuration),
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-profile:v', 'high',
  '-level', '4.2',
  '-crf', crf,
  '-preset', preset,
  '-c:a', 'aac',
  '-b:a', '192k',
  '-movflags', '+faststart',
  finalPath,
], { stdio: 'inherit' });

const contactSheet = resolve(outDir, '关键帧检查.jpg');
makeContactSheet({ finalPath, outPath: contactSheet, targetDuration });
const qa = inspectFinalMedia(finalPath);
const verification = {
  dish,
  clips: clipInfos.map((info) => ({ file: basename(info.file), duration_s: info.duration, has_audio: info.hasAudio })),
  final: finalPath,
  voiceover: voicePath,
  raw_voice_duration_s: rawVoiceDuration,
  tempo,
  target_duration_s: targetDuration,
  contact_sheet: contactSheet,
  video_probe: ffprobeJSON(finalPath, ['-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,nb_frames', '-show_entries', 'format=duration,size']),
  audio_probe: ffprobeJSON(finalPath, ['-select_streams', 'a:0', '-show_entries', 'stream=codec_name,sample_rate,channels', '-show_entries', 'format=duration']),
  qa,
};
if (generationAudit) verification.generation_audit = generationAudit;
const verificationPath = resolve(outDir, 'verification.json');
writeFileSync(verificationPath, JSON.stringify(verification, null, 2));
console.log(JSON.stringify({
  ok: true,
  final: finalPath,
  voiceover: voicePath,
  contact_sheet: contactSheet,
  verification: verificationPath,
  raw_voice_duration_s: rawVoiceDuration,
  tempo,
  qa,
}, null, 2));
