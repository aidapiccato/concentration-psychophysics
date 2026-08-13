# Memory Task (jsPsych)

A browser-based, human-participant version of the concentration-style
positional memory task (6-position matching task in
`memory-latent-variable`/`memory-strength-io`), built for online data
collection via [cognition.run](https://www.cognition.run/) and Prolific.

Adapted for humans: the number of positions per block varies (6, 12, or 18,
not fixed at 6), positions are laid out on one or more concentric rings
instead of a fixed grid, and — like the original task — a session is a
sequence of performance-gated blocks rather than one long fixed run.

## How the task works

### Tutorial

Off by default. When enabled (`tutorialEnabled: true`, or pass
`?tutorial=true`), the participant runs through a single **tutorial
block** before the main session — `tutorialSize` images (default 4), drawn
from the pool before the main session's blocks are generated so the two
never overlap. With the tutorial off, the instructions screen still runs
once before the main session, with wording adjusted to drop the
practice-round mention. The tutorial uses a
simpler pass criterion than regular blocks: every image must be answered
correctly at least `tutorialMinCorrect` times (default 2) — a plain
cumulative count, not the rolling-average criterion regular blocks use. It's
otherwise mechanically identical to a regular block (same trial stages,
same `maxAttemptsMultiplier`/`maxTotalTrials` safety valves), so the
participant practices the actual task, not a simplified stand-in.

The main jsPsych `instructions` screen (explaining the hover/select
mechanics) runs once, immediately before the tutorial, and is *not*
repeated before the main session — by the time the tutorial finishes, the
participant has already done it for real. A dedicated "Practice complete!"
screen marks the handoff from tutorial to main session.

The in-trial guidance text ("Hold your mouse over the cross", "Look away
when you're ready to respond", "Hover/Click where you've seen this shape")
only appears during the tutorial too — the plugin's `show_hints` parameter
(set from `activeBlock.kind === "tutorial"` in
[js/experiment.js](js/experiment.js)) blanks all three for main-session
trials, once the participant no longer needs the hand-holding. The
"Time's up!" deadline message is unaffected — it's feedback, not
usage guidance, so it always shows.

### Blocks

The main session is a sequence of **blocks**, each a disjoint subset of the
image pool (no image appears in more than one block across the whole
session, and never one already used by the tutorial). Block size is
randomly chosen per block from `blockSizes` (default `6, 12`; try
`?blockSizes=6,12,18` for a three-way mix), with the constraint that
consecutive blocks never share a size — with exactly two sizes this means
strict alternation; with one size the constraint is trivially impossible,
so it's just reused every time. See [js/stimuli.js](js/stimuli.js)'s
`generateBlocks`, which shuffles the pool once and greedily slices off
same-sized chunks until not enough images remain for another full block
(leftovers go unused). Within a block, each image is randomly assigned to
one grid position, fixed for that block's layout.

A block is **passed** once the average of every image's *rolling accuracy*
(its hit rate over its last `rollingWindow` presentations *in this block*,
default 10) reaches `criterion` (default 0.8) — this requires every image
in the block to have been shown at least once, so a block can't pass by
luck before it's actually been tested. Passing immediately advances to a
new block.

Each block is attempted **once**. One that hasn't passed after
`maxAttemptsMultiplier * blockSize` trials (default multiplier 10) is left
behind — not revisited — and the session moves on to the next block, so a
participant who struggles with one block isn't held up indefinitely and
never repeats a block they've already failed.

The session ends once every block has been attempted (passed or left
behind), or after `maxTotalTrials` (default 2000) trials total — a safety
valve for the case where blocks keep hitting their cap without passing. A
brief message announces each transition ("Nice work! Starting a new set of
shapes." / "Let's move on to a different set of shapes.").

### Trials

Within a block, each trial cues one of that block's images (uniformly at
random, immediate repeats allowed) and has three stages, all
mouse-hover-driven (no eye tracking):
  1. **Cross fixation**: all peripheral positions are shown immediately,
     dimmed and inert (unclickable), and a dashed cross sits at center. The
     participant must hover over it continuously for `fixation` ms; leaving
     early resets progress to zero — no partial credit, it must be
     re-established from scratch. The cue itself is not shown yet.
  2. **Cue viewing**: the instant the hold requirement is satisfied (while
     still hovering), the cross is replaced by the actual cued item in the
     same spot. There's no minimum viewing time here — the participant can
     look away immediately or stay as long as they like.
  3. **Response**: triggered by that look-away. The cue and its dashed
     cross are removed entirely for the rest of the trial (not just hidden
     — there's nothing left to hover back onto) and simultaneously the
     peripheral positions un-dim and unlock for selection. Selecting one
     always reveals
     whatever item is actually there (correct or not) as feedback, then the
     trial ends — there's no separate study phase, so early trials are pure
     guessing and accuracy should climb as the participant explores.

     How a position gets selected depends on `response` (see param table):
     by default (`fixation`), selection requires hovering a position
     continuously for `responseFixation` ms — leaving early cancels
     progress on that position (same no-partial-credit rule as cross
     fixation), and clicking does nothing. Pass `?response=click` for plain
     click-to-select instead.

     Selection is also capped by `deadline` ms (default 2000), timed from
     the start of the response stage — i.e. from the moment the cursor
     leaves the central fixation area. If it elapses with no selection made,
     the trial ends automatically with a null response (`timed_out: true`
     in the data). Pass `?deadline=0` to disable it.
- Data recorded per trial: `cue_id`, `target_pos`, `response_pos` (`null`
  if the deadline was hit), `correct`, `rt` (time from the response stage
  starting to the click/selection, `null` on a timeout), `fixation_rt`
  (time from trial start to the response stage starting — i.e.
  cross-fixation hold time plus however long the cue was viewed),
  `timed_out`, `is_tutorial`, `block_number` (`0` for the tutorial, `1+`
  for main-session blocks), `block_size`, `block_trial_number` (resets to 1
  for each new block), `image_concept` (the cued item's THINGS concept
  name), plus jsPsych's standard trial metadata.

`cue_id`/`target_pos`/`response_pos` are local indices (`0..block_size-1`)
into whichever block is currently active, not global image identifiers —
join on `image_concept` (or `block_number` + local index) if you need to
track a specific image across a participant's whole session.

## Real stimuli: THINGS dataset

Object images come from [THINGS](https://things-initiative.org/) — 1,854
naturalistic object concepts with an associated
[memorability dataset](https://osf.io/5a7z6/) (recognition accuracy per
image from a separate large-scale study), so task performance can later be
compared against known memorability.

**1. Download images.** The images live in OSF project
[osf.io/jum2f](https://osf.io/jum2f/files/osfstorage), via
[osfclient](https://github.com/osfclient/osfclient), installed into a
dedicated virtual environment (`psychophysics/`, already created and
gitignored) rather than your system Python:

```bash
python3 -m venv psychophysics       # only needed once
source psychophysics/bin/activate
pip install -r requirements.txt
osf -p jum2f fetch osfstorage/images_THINGSplus-CC0.zip
unzip images_THINGSplus-CC0.zip -d things_download
```

**Don't use `osf clone` here** — that project bundles 61 files total,
including the full academic-use image set (`images_THINGS.zip`,
password-gated, ~5GB, citation required) plus a pile of metadata/norms
files (embeddings, category ratings, PDFs) you don't need for this. `osf
fetch` grabs just the one CC0 zip (~1.18GB, no password) you actually want.
If you *do* want the metadata later (e.g. `concepts-metadata_things.tsv`),
run `osf -p jum2f list` to see everything available and `osf fetch` the
specific files you need.

**2. Build the manifest.** Point the prep script at wherever the images
landed — it handles either a folder-per-concept layout or a flat
folder of files named like `aardvark_01b.jpg`, keeps one image per concept,
copies them into `assets/images/`, and writes `assets/images/manifest.json`:

```bash
python3 scripts/prepare_things_stimuli.py /path/to/downloaded/things/images
```

Open `assets/images/manifest.json` afterward and spot-check a few entries —
concept names are inferred from folder/file names, not verified against the
real THINGS concept list.

**3. Run the task.** `js/stimuli.js` fetches `assets/images/manifest.json`
at startup and carves the whole pool into disjoint blocks (see "Blocks"
above); the plugin renders each block's images as `<img>` elements,
preloaded per-block via jsPsych's `preload` plugin so there's no visible
loading delay mid-trial — only the current block's images are ever
downloaded, not the whole pool. If the manifest is missing, the page shows
a clear error instead of failing silently.

**Memorability scores aren't wired into the trial data yet** — they'd need
joining by concept name (the recorded `image_concept` field) against the
[THINGS memorability dataset](https://osf.io/5a7z6/) (`osf -p 5a7z6 clone
things-memorability`) in your own analysis, or added to the manifest and
threaded through `stimuliFromManifestEntries()` in
[js/stimuli.js](js/stimuli.js) if you want it directly in the exported
trial data.

## Stack

- [jsPsych 7.3.4](https://www.jspsych.org/7.3/) loaded via CDN
  (`unpkg.com`) — no build step, no npm install. This matches how
  cognition.run expects experiments: plain static HTML/CSS/JS.
- One custom jsPsych plugin ([js/circular-memory-grid-plugin.js](js/circular-memory-grid-plugin.js))
  for the click-a-position trial type; everything else uses stock jsPsych
  plugins (`instructions`, `html-keyboard-response`, `preload`).

## File layout

```
index.html                          entry point, loads jsPsych + our scripts
css/style.css                       trial visuals
js/config.js                        EXPERIMENT_CONFIG (reads URL params)
js/stimuli.js                       loads manifest.json, carves it into disjoint blocks
js/layout.js                        ring layout math (positions relative to center)
js/circular-memory-grid-plugin.js   custom jsPsych plugin for the response trial
js/experiment.js                    builds the timeline and runs it
scripts/prepare_things_stimuli.py   turns downloaded THINGS images into assets/images/ + manifest.json
assets/images/                      stimulus images + manifest.json (gitignored, not checked in)
requirements.txt                    Python deps for the download step (osfclient)
psychophysics/                      virtualenv for requirements.txt (gitignored, not checked in)
.claude/launch.json                 local dev server config
```

## Run locally

```bash
python3 -m http.server 8765
```

Then open `http://localhost:8765` in a browser.

**If a change doesn't seem to take effect after editing a file**, the
browser is almost certainly serving a cached copy — `python3 -m
http.server` doesn't send cache-control headers, so browsers are free to
reuse old JS/CSS on a plain refresh. Every local asset in
[index.html](index.html) is loaded with a `?v=N` query string for exactly
this reason; bump `N` on *all* of them together whenever any local `.js` or
`.css` file changes, then refresh. A hard refresh (Cmd+Shift+R) works too,
but not everyone remembers that step.

### Configuring a run via URL params

No code changes needed to try different settings:

| Param | Default | Meaning |
|---|---|---|
| `tutorial` | `false` | Set to `true` to run a practice tutorial block before the main session |
| `tutorialSize` | 4 | Number of images in the practice tutorial block, run once before the main session |
| `tutorialMinCorrect` | 2 | Number of correct responses required per image to pass the tutorial (a cumulative count, not a rolling average) |
| `blockSizes` | `6,12` | Comma-separated list of possible block sizes; one is chosen at random per block, never repeating the previous block's size (e.g. `6,12,18`) |
| `criterion` | 0.8 | Average per-image rolling accuracy required to pass a block |
| `rollingWindow` | 10 | Number of most recent presentations of an image (within its block) that its rolling accuracy is computed over |
| `maxAttemptsMultiplier` | 10 | A block (or the tutorial) that hasn't passed after `multiplier * size` trials is left behind (not revisited) and the session moves on |
| `maxTotalTrials` | 2000 | Safety valve: force-ends the session after this many trials total even if blocks remain unfinished |
| `circleSize` | 60 | Diameter (px) of the peripheral position circles; the central cue/cross is always drawn 10px larger |
| `spacing` | `circleSize * 1.75` | Target distance (px) between adjacent positions' centers, used to size each ring so its items end up this far apart. Defaults to `circleSize` plus a gap of `0.75 * circleSize` between edges, so the gap scales with circle size instead of needing to be hand-tuned alongside it; pass an explicit value to override |
| `maxRings` | 2 | Caps how many concentric rings a block's layout can use (see below). Lower is safer against accidental selections but forces circles closer together as block size grows |
| `minRingSize` | 6 | A ring is only added if every ring (including the new one) would still end up with at least this many items once the block splits evenly across them — e.g. a 6-image block always stays on a single ring rather than spreading 3 and 3 across two |
| `ringSpacing` | `circleSize * 0.75` | Radial gap (px) between consecutive rings. Can safely be a bit less than a full circle diameter since the ring stagger already keeps neighboring rings' circles clear of each other |
| `feedback` | 1000 | Feedback duration in ms after a response |
| `iti` | 500 | Inter-trial interval in ms |
| `fixation` | 500 | Required continuous hover time (ms) on the center cross before the cue is revealed |
| `response` | `fixation` | How a position is selected during the response stage: `fixation` (hover-and-hold, no click) or `click` |
| `responseFixation` | 500 | In `response=fixation` mode, required continuous hover time (ms) on a position to select it |
| `deadline` | 2000 | Max time (ms) to select a position, timed from the start of the response stage. `0` disables it |

The number of rings *within* a block is computed automatically
(`computeNumRings` in [js/layout.js](js/layout.js)) from that block's size
and `spacing`, recomputed per block since block size varies — but capped
at `maxRings` and `minRingSize`. Fewer rings means less chance of a
participant's cursor crossing (and, in `response=fixation` mode, briefly
dwelling on) an unintended position on an inner ring while travelling out
to a position on an outer one. The block's positions are then split as
evenly as possible across those rings (6 and 6 for a 12-image block on 2
rings, not proportional to each ring's radius) so every ring has the same
angular step — combined with the alternating half-step stagger between
rings, this means an outer ring's positions always fall exactly *between*
an inner ring's rather than lining up radially with any of them, which is
what actually keeps a straight path from the center to an outer position
from crossing directly over an inner one.

Each ring's radius is then sized independently from its own item count so
that ring's items land ~`spacing` apart, regardless of how the other rings
turned out — no ring ends up more spread out than `spacing` calls for just
because a different ring needed more room. `baseRadius` (100px, not
currently exposed as a param) is a floor under the innermost ring, and
`ringSpacing` is a floor under the gap between consecutive rings, so rings
stay visually distinct even when their item counts alone wouldn't require
much separation.

Example: `http://localhost:8765?blockSizes=6,12&criterion=0.75&feedback=600`
(only 6- or 12-image blocks, a slightly more lenient 75% pass threshold)

### Inspecting data while testing

The running `jsPsych` instance is exposed as `window.jsPsych` for local
debugging (harmless to leave in when hosted). In the browser console:

```js
jsPsych.data.get().filter({task: "circular_memory_grid"}).values()
// or, to download a CSV:
jsPsych.data.get().localSave("csv", "memory_task_data.csv")
```

## Moving to cognition.run

1. Create a free account at cognition.run and start a new experiment —
   their demo experiments are a good sanity check for how they expect files
   structured (plain static jsPsych, same as this project).
2. Upload/sync this folder's contents (`index.html`, `css/`, `js/`,
   `assets/`) as the experiment source. No build step is needed since
   everything already runs from static files + CDN scripts. Note
   `assets/images/` is the full stimulus pool (e.g. ~1.18GB for all 1,854
   THINGSplus CC0 images) even though each participant's browser only ever
   downloads whichever block's images are currently active, preloaded fresh
   per block via jsPsych's preload step — check cognition.run's upload size
   limits before pushing the whole pool.
3. cognition.run automatically captures jsPsych's `DataCollection` output
   per participant — you don't need to wire up your own data-saving
   endpoint.
4. Before going live, add a Prolific completion step: on the debrief screen,
   redirect to your Prolific completion URL (`https://app.prolific.com/submissions/complete?cc=<COMPLETION_CODE>`)
   so participants return automatically. This isn't wired up yet — it's a
   small addition to the `debrief` trial's `on_finish` in
   [js/experiment.js](js/experiment.js) once you have a completion code from
   your Prolific study.
5. Cognition.run gives you a public experiment link — paste that into your
   Prolific study's "Study URL" field. No other Prolific-side integration is
   needed; Prolific just needs to know where to send participants and what
   completion code to expect back.

## Known rough edges / next steps

- Cue scheduling *within* a block is plain uniform random (immediate
  repeats allowed) — it doesn't weight toward images the participant is
  getting wrong, the way an adaptive/staircase schedule might.
- Each block is attempted exactly once, whether it's passed or left behind
  after hitting the trial cap — no revisits, and no deliberate re-testing
  of a passed block later to check retention.
- Memorability scores aren't joined into the exported trial data yet (see
  "Real stimuli" above).
- `assets/images/` and `psychophysics/` (the venv) are already gitignored,
  since neither the real image files nor a virtualenv belong in version
  control if you start using git for this project.
