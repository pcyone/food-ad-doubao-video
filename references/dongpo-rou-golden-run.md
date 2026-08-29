# Dongpo pork 40-second golden run

Use this reference when a concrete calibrated example is helpful. It records the successful 2026-08-29 run, including the disclosed Flow-credit fallback.

## Target and continuity bible

- Dish: 东坡肉
- Target: 40 seconds, 9:16
- Plan: five 8-second beats
- Camera language: photorealistic 85–100mm macro, shallow depth of field, slow controlled movement, no cuts within a scene
- Set: charcoal stone counter, matte-black cast-iron vessel
- Light: warm tungsten key from upper left, soft cool fill from right
- Food identity: the same batch of intact 4cm skin-on pork-belly cubes with clear fat-and-lean layers
- Sound: synchronized cooking sound only; no generated speech or music
- Common negatives: no face, visible person, text, captions, logos, packaging, duplication, melting, morphing, anatomy-like mutation, or sudden props

## Final narration

```text
一块好五花，先要经得住火候的考验。热锅逼出油香，冰糖慢慢化开，给每一面染上琥珀色。姜葱、八角和绍酒入锅，香气随热雾层层升起。再交给时间，小火慢煨，让酱汁一点点收进肥瘦相间的纹理。揭盖的一刻，肉色红亮，轻轻一夹，软糯却不散。浓汁顺着边角缓缓落下，咸香里带着温润回甜。东坡肉，真正的丰腴，不是油腻，而是一口入口即化的从容。
```

The narration is about 160 Chinese characters. Doubao returned a cleaned raw duration of `40.059458s`. With a `0.25s` voice delay and `40s` target:

```text
tempo = 40.059458 / 39.75 = 1.007785
```

This is only about a 0.8% speed-up.

## Scene prompts

### Scene 1 — sear the fresh pork belly

```text
Create one continuous 8-second premium vertical food-commercial shot, photorealistic and physically plausible. In the same intimate Chinese restaurant kitchen used throughout this series, a heavy matte-black cast-iron wok sits on a charcoal stone counter under one warm tungsten key light from upper left and a very soft cool fill from the right. Five neat 4-centimeter cubes of fresh skin-on pork belly from the same batch are lowered into the already-hot wok with dark brass tongs entering only from the top edge; no hands, face, or person is visible. The cubes touch the pan and begin to sear, clean white steam rises, tiny beads of rendered fat shimmer, and the bottom edges gradually turn pale gold. Use an appetizing 85mm macro-lens look, extremely shallow depth of field, restrained highlights, rich but natural color, slow subtle push-in, no cuts, no time jump. Preserve realistic pork texture and cube geometry; no extra ingredients yet. Natural synchronized sizzling and gentle kitchen ambience only, no speech, no music. No text, subtitles, labels, logos, packaging, watermark-like graphic, or visible person. Keep all objects anatomically and physically stable with no duplication or morphing.
```

### Scene 2 — caramel color and aromatics

```text
Create one continuous 8-second premium vertical food-commercial shot that clearly continues the same Dongpo pork preparation. Use the identical intimate Chinese restaurant kitchen, charcoal stone counter, heavy matte-black cast-iron wok, warm tungsten key light from upper left, soft cool fill from right, and the same five 4-centimeter pork belly cubes, now evenly golden on their edges. A thin ribbon of clear amber rock-sugar caramel flows from just outside the top of frame into the wok while the cubes are slowly turned once by the same dark brass tongs. The caramel bubbles and coats every cube in a glossy translucent amber layer; two ginger slices, one scallion knot, and two star-anise pods remain settled around the meat. Finish with a brief splash of Shaoxing wine that flashes into fragrant steam without a flare. Photorealistic 85mm macro food cinematography, shallow depth of field, slow controlled lateral slide, single unbroken shot, no cuts. Natural caramel bubbling, sizzling, and soft steam ambience only, no speech or music. No face, person, hands, text, logos, packaging, labels, or graphic overlays. Do not duplicate, melt, deform, or change the size of the pork cubes, wok, aromatics, or utensils.
```

### Scene 3 — slow braise

```text
Create one continuous 8-second premium vertical food-commercial shot of the same Dongpo pork now slow-braising in the identical heavy matte-black cast-iron pot on the same charcoal stone counter. The same five square pork belly cubes are partially submerged in deep mahogany soy braising liquid with the same two ginger slices, scallion knot, and two star-anise pods. The sauce simmers slowly with small realistic bubbles at the edges, the glossy pork skin gently trembles, and warm aromatic steam curls upward through the tungsten light. During the shot the liquid reduces subtly and clings more thickly to the fat-and-lean layers; do not show an impossible time lapse or sudden transformation. Use a locked low 85mm macro angle with an almost imperceptible push-in, shallow depth of field, realistic highlights and food texture, one unbroken shot. Natural low simmer, occasional bubble, and quiet kitchen room tone only, no speech, no music. No person, face, hands, utensils entering frame, text, labels, logos, packaging, or graphic overlays. Keep the pot, five meat cubes, aromatics, counter, lighting direction, and background stable; no duplication, morphing, new props, or scene reset.
```

### Scene 4 — lift and sauce drop

```text
Create one continuous 8-second premium vertical food-commercial shot, continuing immediately after the same Dongpo pork braise. In the identical matte-black cast-iron pot on the charcoal stone counter, the sauce is now thick, lacquered, and deep mahogany. The same dark brass tongs enter only from the top edge and gently lift one intact 4-centimeter cube from the center. The cube compresses slightly to show tenderness but never breaks or deforms; its alternating fat-and-lean layers remain clean and realistic. One slow glossy strand of sauce stretches from the lower corner of the cube, narrows, then falls back into the pot, making a single soft ripple among the remaining four cubes. Warm tungsten rim light catches the lacquered surface; cool fill preserves detail in the shadows. Photorealistic 100mm macro food cinematography, very shallow depth of field, subtle upward camera follow, no cut. Natural soft bubbling, tong contact, one sauce drop, and restrained kitchen ambience only, no speech or music. No hands, face, person, text, subtitles, labels, logos, packaging, or graphic overlays. No duplication, melting, anatomy-like mutation, floating ingredients, or sudden background change.
```

### Scene 5 — requested plated hero shot

```text
Continuous 8-second vertical hero shot for a premium Dongpo pork commercial. On the same charcoal stone counter under the same warm upper-left key and cool right fill, stack three intact 4-centimeter cubes from the same braised batch on a pale-jade celadon plate. Show clear fat-and-lean layers and deep mahogany glaze. A spoon just beyond the top edge pours one controlled ribbon of glossy braising sauce over the top cube, following its corners and pooling lightly. Add two fine scallion curls; keep the familiar matte-black pot softly blurred at back left. Warm steam rises and thins. Photorealistic 85mm macro, very shallow depth of field, slow elegant 15-degree orbit ending in a stable hero composition, no cut. Natural sauce-pour and quiet kitchen ambience only. No speech, music, visible person, hand, chopsticks, text, captions, logos, packaging, graphics, duplication, morphing, melting, or new props.
```

## Actual generation result

- Scenes 1–4: genuinely submitted to Google Flow, returned HTTP 200, downloaded as four separate 8-second `720×1280`, 24fps H.264/AAC clips.
- Scene 5: not submitted because the Flow account had insufficient credits; lower-cost model checks also had no active submit.
- Final beat: an 8-second slow-push hero extension made from scene 4 at approximately `6.2s`. It has no source ambience, so the compositor supplied silence for that segment while retaining the foreground narration.

## Render settings and measured result

- Ordered inputs: scene 1, scene 2, scene 3, scene 4, disclosed hero extension
- Scale/crop: `1080×1920`
- Frame rate: `24fps`
- Original-audio control: `ambient_volume=0.07`
- Voice delay: `0.25s`
- H.264: CRF 16, preset slow, yuv420p, High profile
- AAC: 192kbps, 48kHz stereo
- Final duration: `40.000000s`
- Frames: `960`
- Mean audio: `-20.4dB`
- Peak audio: `-5.8dB`
- Full decode: pass
- Black segments at least 0.5s: zero
- Keyframe positions: approximately 1s, 10s, 20s, 30s, and 39s

## Lessons to preserve

- Repeating stable props and counts in every prompt materially improved cross-scene continuity.
- One main physical action per 8-second scene reduced food morphing.
- Continuous TTS gave a more natural result than scene-by-scene synthesis.
- The raw narration was close enough to target that only negligible tempo correction was required.
- Flow submission and local recovery must be treated as separate states; HTTP 200 prevents accidental duplicate generations.
- A disclosed hero-frame extension is an acceptable last-resort ending, but it is not equivalent to a generated plated hero shot.

