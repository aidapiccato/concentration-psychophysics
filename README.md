# Memory Task (jsPsych)

A browser-based, human-participant version of the concentration-style
positional memory task (6-position matching task in
`memory-latent-variable`/`memory-strength-io`), built for online data
collection via [cognition.run](https://www.cognition.run/) and Prolific.

Adapted for humans: the number of positions per block varies (12, 18, or 24,
not fixed), positions are laid out on one or more concentric rings
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
randomly chosen per block from `blockSizes` (default `12, 18, 24`; try
`?blockSizes=12,24` for a two-way mix), with the constraint that
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

Between blocks (not before the first one, and not around the tutorial), a
break screen shows for up to `breakDuration` ms (default 120000, i.e. 2
minutes) — pressing any key continues immediately, otherwise the next
block starts automatically once the time is up. Pass `?breakDuration=0` to
disable breaks entirely.

### Catch trials

On each main-session trial (never the tutorial), with probability
`catchTrialProbability` (default 0.05) it's a **catch trial** instead of a
normal memory trial: once cross-fixation is satisfied, one peripheral
position is directly highlighted (a pulsing yellow border) in place of a
cue image, and the participant is already looking at the center — they
just need to move to the highlighted position as fast as possible once
they notice it, with no memory component at all, and selecting it shows
only a correct/incorrect border, no item image (there's nothing meaningful
to reveal). This mirrors the normal trial's mechanics closely enough that
the same event timestamps decompose into two separate simple-RT measures:
- `cue_offset - cue_onset` — how long they lingered at the center before
  moving, now that they already know where to go
- `choice_reveal - cue_offset` — how long the actual movement + selection
  took

Randomly interspersing these throughout the session helps separate "got
slower because recall is hard" from "got slower because they're
fatigued/inattentive." Catch trials are recorded with `catch_trial: true`
and excluded from the rolling-accuracy tracking that decides when a block
passes. Pass `?catchProb=0` to disable them.

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
     always reveals whatever item is actually there (correct or not) as
     feedback — shown for a fixed `feedback` ms (default 500) regardless
     of where the participant looks — then the trial ends. There's no separate study phase,
     so early trials are pure guessing and accuracy should climb as the
     participant explores.

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
- Data recorded per trial: `cue_id`, `target_pos` (plus `target_x`/`target_y`
  — its actual on-screen coordinates, in px relative to the display's
  center — and `target_ring`/`target_angle`, see below), `response_pos`
  (`null` if the deadline was hit, plus `response_x`/`response_y`,
  `response_ring`/`response_angle`, and `response_image` — the concept
  name of whatever was actually revealed at that position, which differs
  from `cue_image` when `correct` is `false` — all `null` on a timeout),
  `correct`, `timed_out`, `is_tutorial`, `block_number` (`0` for the
  tutorial, `1+` for main-session blocks), `block_size` (the number of
  images/positions in that block — 12, 18, or 24 by default),
  `block_trial_number` (resets to 1 for each new block), `cue_image` (the
  cued item's THINGS concept name, `null` on a catch trial), `catch_trial`
  (see below), plus jsPsych's standard trial metadata — except `stimulus`
  and `response`, which are dropped from the saved CSV (via
  `.ignore(["stimulus", "response"])`) since they're only ever populated by
  the plain `html-keyboard-response` trials (instructions, transitions,
  breaks, ITI, debrief), not `circular_memory_grid` rows.

  Rather than pre-computed RT durations, five raw event timestamps (ms,
  `performance.now()`-based — monotonic and comparable across the whole
  session, though not wall-clock time) are recorded instead, so any
  duration can be reconstructed later without committing to a fixed set of
  derived measures up front:
  - `fixation_onset` — the fixation cross appears (trial start)
  - `cue_onset` — the cue image appears (or, on a catch trial, the
    highlighted target position appears)
  - `cue_offset` — the cursor leaves the cue, ending the cue-viewing stage
    and starting the response stage
  - `choice_reveal` — a position is selected and feedback shown (the
    underlying item, or on a catch trial just a correct/incorrect border);
    `null` if the deadline was hit instead
  - `iti_onset` — feedback stops being shown (after the fixed
    `feedback` duration) and the inter-trial interval begins

  For example, `cue_offset - cue_onset` is viewing time, `choice_reveal -
  cue_offset` is response/selection time (the simple-RT measurement on a
  catch trial), and `iti_onset - choice_reveal` is the (fixed)
  feedback duration.

`cue_id`/`target_pos`/`response_pos` are local indices (`0..block_size-1`)
into whichever block is currently active, not global image identifiers —
join on `cue_image` (or `block_number` + local index) if you need to track a
specific image across a participant's whole session. `target_pos` and
`response_pos` are only slot ids from that block's ring layout (see
[js/layout.js](js/layout.js)), not a fixed compass direction — use
`target_x`/`target_y`/`response_x`/`response_y` if you need actual spatial
coordinates, or `target_ring`/`response_ring` (`0` = innermost) and
`target_angle`/`response_angle` (radians, `atan2(y, x)` — `0` points right,
increasing clockwise, so `-π/2` is straight up) if polar coordinates are
more convenient. All are recorded directly rather than requiring you to
re-run `computeLayout` with matching config later.

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
joining by concept name (the recorded `cue_image` field) against the
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
| `blockSizes` | `12,18,24` | Comma-separated list of possible block sizes; one is chosen at random per block, never repeating the previous block's size (e.g. `12,24`) |
| `criterion` | 0.8 | Average per-image rolling accuracy required to pass a block |
| `rollingWindow` | 10 | Number of most recent presentations of an image (within its block) that its rolling accuracy is computed over |
| `maxAttemptsMultiplier` | 10 | A block (or the tutorial) that hasn't passed after `multiplier * size` trials is left behind (not revisited) and the session moves on |
| `timeLimit` | 50 | Hard time limit in minutes for the main session, timed from its first trial. Once it has passed, the session ends right after the current trial — even mid-block — and goes to the debrief. `0` disables it |
| `maxTotalTrials` | 2000 | Safety valve: force-ends the session after this many trials total even if blocks remain unfinished |
| `breakDuration` | 120000 | Max time (ms) a break screen shows between blocks before auto-continuing; pressing any key continues sooner. `0` disables breaks |
| `catchProb` | 0.05 | Probability any given main-session trial is a catch trial (simple-RT probe, no memory component) instead of a normal memory trial. `0` disables catch trials |
| `circleSize` | 60 | Diameter (px) of the peripheral position circles; the central cue/cross is always drawn 10px larger |
| `spacing` | `circleSize * 1.75` | Target distance (px) between adjacent positions' centers, used to size each ring so its items end up this far apart. Defaults to `circleSize` plus a gap of `0.75 * circleSize` between edges, so the gap scales with circle size instead of needing to be hand-tuned alongside it; pass an explicit value to override |
| `maxRings` | 3 | Caps how many concentric rings a block's layout can use (see below). Lower is safer against accidental selections but forces circles closer together as block size grows |
| `minRingSize` | 6 | A ring is only added if every ring (including the new one) would still end up with at least this many items once the block splits evenly across them — e.g. a 6-image block always stays on a single ring rather than spreading 3 and 3 across two |
| `ringSpacing` | `circleSize * 0.75` | Radial gap (px) between consecutive rings. Can safely be a bit less than a full circle diameter since the ring stagger already keeps neighboring rings' circles clear of each other |
| `imageBase` | Cloudflare R2 URL | Folder or URL (no trailing slash) holding `manifest.json` and the stimulus images. Defaults to the resized (256px) set on Cloudflare R2; pass `?imageBase=assets/images` to use the full-size local copy. A cross-origin host must allow CORS for `manifest.json` (it's loaded with `fetch`) |
| `feedback` | 500 | Fixed feedback duration (ms) after a response, before the trial ends |
| `iti` | 500 | Inter-trial interval in ms. Shows the same dashed fixation cross as cross-fixation (rather than a blank page), so the transition into the next trial doesn't flash to empty and back |
| `fixation` | 200 | Required continuous hover time (ms) on the center cross before the cue is revealed |
| `response` | `fixation` | How a position is selected during the response stage: `fixation` (hover-and-hold, no click) or `click` |
| `responseFixation` | 300 | In `response=fixation` mode, required continuous hover time (ms) on a position to select it |
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
rings, this means an odd ring's positions always fall exactly *between*
its neighbors' rather than lining up radially with any of them. With 3
rings, ring 2 lines up with ring 0 again, so a straight path to it can
cross an inner-ring circle; that's accepted.

Each ring's radius is then sized independently from its own item count so
that ring's items land ~`spacing` apart, regardless of how the other rings
turned out. `baseRadius` (100px, not currently exposed as a param) is a
floor under the innermost ring, and `ringSpacing` is a floor under the gap
between consecutive rings, so rings stay visually distinct even when their
item counts alone wouldn't require much separation.

Example: `http://localhost:8765?blockSizes=12,24&criterion=0.75&feedback=600`
(only 6- or 12-image blocks, a slightly more lenient 75% pass threshold)

### Inspecting data while testing

On `localhost`/`127.0.0.1` (gated on hostname, so none of this happens when
actually hosted on cognition.run):

- **In Chrome or Edge**, loading the page first shows a one-time prompt to
  choose the project's root folder. Doing so grants write access to its
  `data/` folder (created automatically, and already gitignored) for the
  rest of that page load — no further prompts. Every trial then overwrites
  `data/session_<timestamp>.csv` with the full dataset collected so far, so
  there's always a complete, up-to-date CSV on disk even if the session
  ends early. Click "Skip" to opt out of this for a given run.
- **Otherwise** (Firefox/Safari, or "Skip" was clicked): every trial
  instead backs up all data collected so far to `localStorage` (not a file
  — a crash/refresh-proof safety net), and finishing a session downloads a
  CSV (`memory_task_data_<timestamp>.csv`) the normal browser way. If a
  session never reaches the end, recover the backup from the browser
  console:

  ```js
  recoverAutosave() // downloads a CSV of whatever was collected before the interruption
  ```

The running `jsPsych` instance is also exposed as `window.jsPsych` for
local debugging (harmless to leave in when hosted). In the browser
console, mid-session or after:

```js
jsPsych.data.get().filter({task: "circular_memory_grid"}).values()
// or, to download a CSV on demand:
jsPsych.data.get().localSave("csv", "memory_task_data.csv")
```

### Analyzing a session in Python

[notebooks/load_session.ipynb](notebooks/load_session.ipynb) loads a
session CSV and computes `seen_repetition`, `seen_recency`, `rt` (cue
onset to cue offset), and `movement_rt` (cue offset to choice reveal) per
memory trial — set `CSV_PATH` in the notebook to the file you want. Needs
`pandas`/`numpy`/`matplotlib`/`seaborn`/`jupyter` from `requirements.txt`
(`pip install -r requirements.txt` inside the `psychophysics` venv); a
matching Jupyter kernel can be registered with:

```bash
psychophysics/bin/python -m ipykernel install --user --name=psychophysics --display-name="psychophysics"
```

Plots use the `figure_style` package (styling conventions shared with the
`analysis`/`memory-latent-variable` sibling projects) — it's a local
sibling repo, not on PyPI, so install it separately as an editable package
(adjust the path to wherever `figure-style` lives on your machine):

```bash
psychophysics/bin/pip install -e /path/to/figure-style
```

## Moving to cognition.run

cognition.run takes one main JavaScript source, not a folder of scripts, and
provides jsPsych itself.

1. Run `python3 scripts/build_cognition.py`. It bundles `css/style.css` and
   the `js/` files (in `index.html`'s order) into `dist/index.js`.
2. Paste `dist/index.js` into the code editor of your cognition.run task
   (or deploy it through their GitHub integration, which expects the main
   source as `index.js`). Check the editor's preview console for errors —
   in particular that the `instructions` and `preload` jsPsych plugins are
   available there, and that our custom plugin's use of `jsPsychModule`
   resolves.
3. Stimuli are not uploaded to cognition.run: they load from the Cloudflare
   R2 bucket set as the default `imageBase` in [js/config.js](js/config.js)
   (the resized 256px set from `scripts/resize_stimuli.py`, with a CORS
   policy allowing GET). Use a custom domain on the bucket for real
   collection — `r2.dev` addresses are rate-limited and meant for testing.
4. Local file saving (the `data/` folder and `localStorage` backup) only
   runs on `localhost`; when hosted, cognition.run captures the data itself
   and re-uploads anything that failed to send.
5. Consent is set up in the cognition.run task settings (markdown, logged
   acceptance, fallback URL on rejection) rather than in this code.
6. For Prolific, set the study URL to
   `https://<task>.cognition.run?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}`
   — cognition.run saves every URL parameter as a data column. The
   completion redirect is in place but inactive: paste your completion code
   into `prolificCompletionCode` in [js/config.js](js/config.js) (placeholder
   marked `TODO`), then rebuild. It redirects from the global `on_finish`,
   which cognition.run only calls after all data has uploaded.

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
