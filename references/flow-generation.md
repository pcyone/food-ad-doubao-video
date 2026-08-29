# Google Flow generation protocol

Read this reference only for end-to-end jobs that require new footage from Google Flow.

## Local runtime

Set the local Flow suite directory before using the helper:

```bash
export FOOD_AD_FLOW_SUITE_ROOT=/absolute/path/to/hbg-gemini-flow-suite
```

Expected components:

- Docker container: `gemini-flow-suite`
- Persistent Flow profile inside the runtime: `/data/gflow/profile_flow`
- Host Chrome authorization profile: `${FOOD_AD_FLOW_PROFILE:-$HOME/.gemini-flow-suite/flow-chrome}`
- Generated-media output root in the container: `/data/outputs`

The user must approve network/UI execution when the environment requests it. Authorization to generate the requested scenes does not authorize unrelated browsing, extra candidates, account changes, purchases, or upgrades.

Never print cookies, bearer values, API keys, or credential contents. Safe evidence includes authorization booleans, project IDs, media IDs, HTTP status, operation-presence booleans, local output paths, and probe data.

## Prepare one prompt per scene

Store prompts as ordered UTF-8 files:

```text
scene-prompts/scene01.txt
scene-prompts/scene02.txt
...
```

Use one Flow project and one requested candidate per scene. This keeps evidence and recovery unambiguous and avoids spending credits on unwanted variants.

Before submitting, lock:

- Aspect ratio, normally `9:16`.
- Supported duration, normally 8 seconds for a five-scene 40-second plan.
- Model, normally the user's requested model or `veo-quality` when quality is prioritized.
- Output directory containing the dish slug and scene number.

## Standard submission

From the suite root:

```bash
food_prompt=$(< /absolute/path/scene01.txt)
./suite flow video t2v "$food_prompt" \
  --model veo-quality \
  --aspect 9:16 \
  --count 1 \
  --out-dir food-ads/<dish-slug>/scene01 \
  --json
```

Run scenes sequentially unless there is a demonstrated reason that the authorized Flow profile safely supports parallel sessions. Persistent browser profiles are prone to lock contention.

## Submission evidence

Use this state model:

1. **Project created/configured:** not submitted.
2. **Prompt entered or button activated:** not yet proven.
3. **Generation endpoint returns HTTP 200:** submitted.
4. **Media ID/operation observed:** retain safe audit evidence.
5. **Video recovered and probed:** locally usable.

Do not mark a scene successful at states 1 or 2.

If the standard command creates/configures a project but exits before a proven submit, retain the project ID from the safe log and use:

```bash
zsh <skill-dir>/scripts/run-flow-project-task.zsh \
  submit PROJECT_ID /absolute/path/scene01.txt
```

The helper targets only the unique active video-submit button and requires HTTP 200. It deliberately refuses generic Create buttons.

## Recover instead of regenerate

Generation can succeed on the server even when the local session closes, the download times out, or an automation selector fails. If HTTP 200 was observed, do not resubmit first.

Recover from the same project:

```bash
zsh <skill-dir>/scripts/run-flow-project-task.zsh \
  recover PROJECT_ID /absolute/path/scene01-output
```

The recovery helper:

- Opens the existing project.
- Observes project/media responses.
- Finds candidate media IDs.
- Prefers successful media status.
- Downloads one valid video container.
- Does not invoke the generation endpoint.

If the server task is still processing, wait briefly and repeat recovery for the same project. An unchanged processing state is not permission to generate a duplicate.

## Credits or disabled submit

When the unique submit button never becomes active:

1. Confirm the prompt is present and the project editor loaded.
2. Inspect the visible disabled-button message when available.
3. If the message says Flow credits are insufficient, stop retrying the same model.
4. At most once, check a genuinely cheaper supported model when this is in scope and would not create unwanted cost.
5. If no model can submit, choose among:
   - Wait for credits.
   - Shorten the target runtime.
   - Reuse or locally extend already generated footage.

For a local hero extension, prefer a stable late frame with clear food structure and use:

```bash
node <skill-dir>/scripts/make-hero-extension.mjs \
  --source-video /absolute/path/last-good-scene.mp4 \
  --at 6.2 \
  --out /absolute/path/scene05-hero-extension.mp4 \
  --duration 8
```

Record the fallback, source scene, timestamp, duration, and reason in `generation-audit.json`. Do not label it as a Flow-generated scene.

## Per-scene acceptance

Probe each downloaded clip and create a small contact sheet. Accept only when:

- The file is a valid video container and fully decodes.
- Orientation is vertical and duration is usable.
- Ingredient count and shape remain plausible.
- The cooking action reads clearly without an impossible jump.
- The lighting, vessel, counter, and background match the continuity bible.
- There is no generated text, logo, packaging, duplicate utensil, melted food, or anatomy-like artifact.
- The final frame provides a workable handoff to the next scene.

Keep the original clip audio when it contains useful synchronized cooking sound; the render script will attenuate it.

## Generation audit schema

Use a small JSON file such as:

```json
{
  "provider": "Google Flow",
  "requested_scene_count": 5,
  "flow_generated_clips": 4,
  "flow_generated_clip_duration_s": 32,
  "model": "Veo 3.1 Quality",
  "fallbacks": [
    {
      "scene": 5,
      "method": "local hero-frame slow push",
      "source_scene": 4,
      "source_timestamp_s": 6.2,
      "duration_s": 8,
      "reason": "Flow credits exhausted"
    }
  ]
}
```

Pass this file to `new-food-ad-project.mjs --generation-audit ...` so the render embeds the facts in `verification.json`.
