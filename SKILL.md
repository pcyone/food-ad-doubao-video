---
name: food-ad-doubao-video
description: "Create end-to-end vertical food advertisements from a dish name or supplied clips: design continuity-locked prompts, generate ordered shots in Google Flow, synthesize one continuous Chinese Doubao narration, mix quiet cooking ambience, render a 1080×1920 MP4, and produce ffprobe and keyframe verification. Use for new dish ads as well as finish-only jobs with existing footage."
---

# Food Ad Doubao Video

Produce a complete vertical food commercial while preserving an auditable boundary between AI-generated footage, local fallbacks, and post-production.

## Choose the operating mode

- **End-to-end:** The user supplies a dish name, cooking process, or asks you to choose a dish. Develop the narration and shot prompts, generate the clips in Google Flow, then finish the video.
- **Finish-only:** The user already supplies ordered clips and a final narration. Skip Flow generation and start with the project/TTS scripts.

Ask only for information that is both missing and unsafe to infer. If the user asks you to choose a dish or write the copy, do so and continue. Treat narration as locked only when the user says it is final or confirmed.

## Required outcome

Unless the user requests different specifications, deliver:

- One `1080×1920`, `24fps`, H.264/AAC MP4 at the requested duration, default 40 seconds.
- One continuous Doubao voiceover. Do not synthesize separate lines and splice them.
- Ordered cooking visuals with original synchronized sound kept only as a quiet ambience bed.
- `verification.json` containing clip, voice, render, generation-audit, and QA facts.
- `关键帧检查.jpg` covering the opening, process, transition, and final hero image.
- The final narration and prompt package when prompts were created.

## End-to-end workflow

1. Establish a continuity bible: kitchen/counter, vessel, lighting direction, lens language, ingredient count and geometry, hero garnish, sound, and negative constraints.
2. Divide the target runtime into coherent cooking beats. For a 40-second ad, prefer five 8-second scenes when Flow supports 8-second generation.
3. Write each prompt as one continuous shot. Repeat the continuity anchors in every prompt; do not rely on Flow remembering an earlier project.
4. Read [references/flow-generation.md](references/flow-generation.md), then generate one candidate per scene unless the user authorizes alternatives. Count a scene as submitted only after the generation request returns HTTP 200.
5. Download and probe every successful scene. Create a contact sheet before accepting it. Reject clips with food morphing, duplicated ingredients, broken geometry, wrong orientation, intrusive text, or continuity failure.
6. If Flow reaches a credit or service limit, follow the stopping and recovery rules in the Flow reference. Never present a local extension as a Flow-generated scene. When an approved local hero extension is appropriate, use `scripts/make-hero-extension.mjs` and record it in the generation audit.
7. Save the final narration as UTF-8 text and the ordered clips as absolute paths. Initialize the project, then run the composition script.
8. Inspect the generated contact sheet yourself and confirm the final probe and QA data before delivery.

For the exact successful 40-second Dongpo pork run, read [references/dongpo-rou-golden-run.md](references/dongpo-rou-golden-run.md). Use it as a calibrated example, not as a requirement that every dish use pork-specific props or five scenes.

## Prompt construction

Each scene prompt should specify:

- The cooking action and how it changes during the shot.
- Stable dish identity, portion count, vessel, counter, light direction, and background.
- Lens, depth of field, camera move, duration, orientation, and no-cut requirement.
- Physically plausible heat, steam, sauce, oil, utensil, and ingredient motion.
- Natural synchronized cooking ambience only when desired.
- Negative constraints: no speech, music, text, captions, logos, packaging, unrelated people, duplication, melting, morphing, anatomy-like mutation, or sudden new props.

Prefer one visible action per scene. Avoid asking a short generation to show multiple time jumps or a complete recipe transformation.

## Flow evidence and fallback boundary

- Reuse the authorized local Flow runtime when available; never expose cookies, tokens, or credential values.
- A click, loading animation, or created project is not evidence that generation started. Require HTTP 200 and retain safe project/media identifiers.
- If submission succeeded but download or local automation failed, recover media from the same project. Do not spend credits by regenerating first.
- If the unique submit button is disabled because credits are exhausted, stop repeated model attempts after one proportionate alternate check.
- A local still-frame extension may fill a final hero beat only when it remains visually honest, preserves the requested ordering, and is disclosed in `verification.json` and the handoff. Otherwise ask the user whether to wait for credits, shorten the target, or reuse footage.

## Doubao TTS

Use the local Doubao configuration if available. Prefer `--env /absolute/path/.env.local` or set `DOUBAO_TTS_ENV_FILE`. Without either, the render script checks `.env.local` in the current directory and two legacy project locations under the current user's `Documents/短视频相关` folder.

Never print secret values. Required variables:

- `DOUBAO_TTS_API_KEY`
- `DOUBAO_TTS_RESOURCE_ID`
- `DOUBAO_TTS_SPEAKER`

Call the network TTS only with the normal approval when required. If configuration is missing, report the missing variable; do not silently change providers.

The composition script generates one PCM stream, converts it to a cleaned 48kHz WAV, measures the real duration, and computes:

```text
tempo = raw_voice_duration / (target_duration - voice_delay)
```

Keep tempo within `0.88–1.18`. Outside this range, the copy and duration are materially mismatched: revise the copy or target duration instead of forcing the voice.

## Project and render scripts

Create a reusable project:

```bash
node <skill-dir>/scripts/new-food-ad-project.mjs \
  --dish "东坡肉" \
  --clips /absolute/path/scene01.mp4,/absolute/path/scene02.mp4 \
  --script /absolute/path/narration.txt \
  --out-dir /absolute/path/project \
  --duration 40 \
  --generation-audit /absolute/path/generation-audit.json
```

Then render:

```bash
node <skill-dir>/scripts/make-food-ad-video.mjs --project /absolute/path/project
```

Re-run probe, decode, black-frame, volume, and contact-sheet QA without calling TTS again:

```bash
node <skill-dir>/scripts/make-food-ad-video.mjs \
  --verify-existing /absolute/path/final.mp4 \
  --out-dir /absolute/path/verification-output
```

Useful overrides:

- `--env /absolute/path/.env.local`
- `--ambient-volume 0.07`
- `--voice-delay 0.25`
- `--speech-rate <provider value>`
- `--crf 16`
- `--preset slow`

The render script must fail on missing clips, missing TTS configuration, unsafe tempo, decode errors, or malformed output. It writes:

- `audio/voiceover_doubao_raw.wav`
- `<dish>_高端美食广告_<duration>s.mp4`
- `关键帧检查.jpg`
- `verification.json`

## Verification and handoff

Before delivery:

- Confirm duration is within about 0.1 seconds of target.
- Confirm `1080×1920`, `24fps`, H.264 video and AAC audio unless overridden.
- Confirm full decode succeeds.
- Confirm there is no unintended black segment of at least 0.5 seconds.
- Check mean/peak audio levels and listen when practical.
- Inspect all five contact-sheet positions for order, crop, continuity, deformation, and final-frame quality.
- State how many clips were truly generated by Flow and disclose every fallback.
- Link the MP4, verification JSON, contact sheet, narration, and prompt package from the designated output directory.
