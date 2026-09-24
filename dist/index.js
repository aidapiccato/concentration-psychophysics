// Bundled by scripts/build_cognition.py -- edit the files under js/ and css/, not this one.

// ---- css/style.css ----
(function () {
  const style = document.createElement("style");
  style.textContent = "html, body {\n  height: 100%;\n  margin: 0;\n  background: #f7f7f9;\n  font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif;\n}\n\n.jspsych-content {\n  max-width: none !important;\n}\n\n#jspsych-target {\n  min-height: 100vh;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n.cmg-container {\n  position: relative;\n  margin: 0 auto;\n}\n\n.cmg-cue-label {\n  text-align: center;\n  font-size: 18px;\n  color: #333;\n  margin: 20px 0;\n}\n\n.cmg-cue {\n  position: absolute;\n  border-radius: 50%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  overflow: hidden;\n  color: #fff;\n  font-weight: 700;\n  font-size: 22px;\n  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);\n}\n\n.cmg-cue img,\n.cmg-position img {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  pointer-events: none;\n}\n\n.cmg-cue-hidden {\n  background: transparent;\n  border: 2px dashed #b3b8c1;\n  color: #b3b8c1;\n  box-shadow: none;\n}\n\n.cmg-locked {\n  pointer-events: none;\n}\n\n.cmg-dimmed {\n  opacity: 0.5;\n}\n\n.cmg-position {\n  position: absolute;\n  border-radius: 50%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  overflow: hidden;\n  font-weight: 700;\n  font-size: 20px;\n  color: #fff;\n  cursor: pointer;\n  user-select: none;\n  transition: transform 0.1s ease;\n}\n\n.cmg-position:hover {\n  transform: scale(1.06);\n}\n\n.cmg-facedown {\n  background: #cfd3da;\n  border: 2px solid #b3b8c1;\n}\n\n.cmg-correct {\n  border: 3px solid #2e8b57;\n  cursor: default;\n}\n\n.cmg-incorrect {\n  border: 3px solid #c0392b;\n  cursor: default;\n}\n\n.cmg-position.cmg-correct:hover,\n.cmg-position.cmg-incorrect:hover {\n  transform: none;\n}\n\n.cmg-catch-highlight {\n  border: 3px solid #f1c40f;\n  animation: cmg-catch-pulse 0.6s ease-in-out infinite alternate;\n}\n\n@keyframes cmg-catch-pulse {\n  from {\n    box-shadow: 0 0 0 0 rgba(241, 196, 15, 0.6);\n  }\n  to {\n    box-shadow: 0 0 12px 6px rgba(241, 196, 15, 0.6);\n  }\n}\n";
  document.head.appendChild(style);
})();

// ---- js/config.js ----
// Experiment configuration. Values can be overridden via URL query params for
// quick local iteration, e.g. index.html?blockSizes=12,24&criterion=0.7
const EXPERIMENT_CONFIG = (function () {
  const params = new URLSearchParams(window.location.search);

  // Diameter (px) of the peripheral position circles.
  const positionDiameter = parseInt(params.get("circleSize"), 10) || 100;
  // Target distance (px) between adjacent positions' centers. Defaults to
  // circleSize plus a gap of 0.75x circleSize between edges, so it scales
  // with circle size instead of needing to be hand-tuned alongside it;
  // pass ?spacing=... to override outright.
  const itemSpacing = parseInt(params.get("spacing"), 10) || positionDiameter * 1.75;
  // Radial gap (px) between consecutive rings. Defaults to a bit less than
  // a full circle diameter — the alternating stagger between rings already
  // keeps a ring's circles clear of its neighbor's, so they can sit closer
  // together radially than itemSpacing does angularly.
  const ringSpacing = parseInt(params.get("ringSpacing"), 10) || Math.round(positionDiameter * 0.75);

  // Block sizes to cycle through — one is picked at random for each new
  // block. Pass e.g. ?blockSizes=12,24 to override the set.
  const blockSizesParam = params.get("blockSizes");
  const blockSizes = blockSizesParam
    ? blockSizesParam
        .split(",")
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isInteger(n) && n > 0)
    : [12, 18, 24];

  return {
    itemSpacing: itemSpacing,
    positionDiameter: positionDiameter,
    ringSpacing: ringSpacing,
    // Caps how many concentric rings a block's layout can use — rings
    // beyond this cap are never created; instead the rings that do exist
    // absorb more items each, which their radii grow to accommodate.
    // Keeping this low limits how many unintended positions a
    // participant's cursor might cross (and briefly dwell on, in fixation
    // response mode) while travelling from the center to an outer ring.
    maxRings: parseInt(params.get("maxRings"), 10) || 3,
    // A ring is only added if every ring (including the new one) still
    // ends up with at least this many items, once n is split evenly across
    // them — keeps small blocks from being spread thin across rings.
    minRingSize: parseInt(params.get("minRingSize"), 10) || 6,
    // Folder or URL holding manifest.json and the stimulus images, without a
    // trailing slash. Defaults to the resized (256px) set hosted on Cloudflare
    // R2; pass ?imageBase=assets/images to use the full-size local copy
    // instead (e.g. when offline).
    imageBaseUrl: (
      params.get("imageBase") || "https://pub-8e8254f2c58c45018807f42031999526.r2.dev"
    ).replace(/\/+$/, ""),
    // Prolific completion code (the `cc=` value from your study's completion
    // URL). While this is empty, finishing the task does nothing special;
    // once it's filled in, participants are redirected to Prolific at the
    // end of the session (only when hosted -- never on localhost). Paste the
    // code here, or pass ?completionCode=... on the study URL.
    prolificCompletionCode: params.get("completionCode") || "CJUPQSZ5", 
    feedbackDuration: parseInt(params.get("feedback"), 10) || 500,
    interTrialInterval: parseInt(params.get("iti"), 10) || 500,
    fixationDuration: parseInt(params.get("fixation"), 10) || 200,
    // "fixation" (default) or "click" — in fixation mode, a peripheral
    // position is selected by continuously hovering it for
    // responseFixationDuration ms instead of clicking it. Pass
    // ?response=click to opt back into plain clicking.
    responseMode: params.get("response") === "click" ? "click" : "fixation",
    responseFixationDuration: parseInt(params.get("responseFixation"), 10) || 300,
    // Maximum time (ms) to select a position, measured from the moment the
    // cursor leaves the central fixation area (i.e. from the start of the
    // response stage). Pass ?deadline=0 to disable it entirely.
    responseDeadline: params.has("deadline") ? parseInt(params.get("deadline"), 10) : 2000,
    // Blocks: each is a disjoint subset of the image pool, one of
    // blockSizes chosen at random. A block is passed once the average of
    // each image's rolling accuracy (over its last `rollingWindow`
    // presentations in this block) reaches `blockCriterion`. Each block is
    // attempted once — one that hasn't passed after
    // maxAttemptsMultiplier * blockSize trials is left behind (not
    // revisited) so a subject who struggles with one block isn't held up
    // indefinitely, and the session moves on to the next block.
    blockSizes: blockSizes,
    // On each main-session trial (never during the tutorial), this is the
    // probability it's a catch trial instead of a normal memory trial: one
    // peripheral position is directly highlighted (no cue image, nothing
    // to recall) and the participant just moves to it as fast as possible
    // — a simple-RT probe randomly interspersed throughout the session to
    // help distinguish memory difficulty from attention/fatigue drift.
    catchTrialProbability: params.has("catchProb") ? parseFloat(params.get("catchProb")) : 0.05,
    // Between main-session blocks (not before the first one), a break
    // screen shows for up to this long — the participant can press any
    // key to continue sooner. Pass ?breakDuration=0 to disable breaks.
    breakDuration: params.has("breakDuration") ? parseInt(params.get("breakDuration"), 10) : 120000,
    rollingWindow: parseInt(params.get("rollingWindow"), 10) || 10,
    blockCriterion: parseFloat(params.get("criterion")) || 0.8,
    maxAttemptsMultiplier: parseInt(params.get("maxAttemptsMultiplier"), 20) || 10,
    // Safety valve: force-ends the session after this many trials total
    // even if blocks remain unfinished, so a subject can't get stuck
    // indefinitely.
    maxTotalTrials: parseInt(params.get("maxTotalTrials"), 10) || 3000,

    // Tutorial: a single practice block (disjoint from the main session's
    // image pool) run before the main session, using its own pass
    // criterion — every image must be answered correctly at least
    // tutorialMinCorrect times (a plain cumulative count, not a rolling
    // average like the main blocks use). Off by default; pass
    // ?tutorial=true to enable it.
    tutorialEnabled: params.get("tutorial") === "true",
    tutorialSize: parseInt(params.get("tutorialSize"), 10) || 4,
    tutorialMinCorrect: parseInt(params.get("tutorialMinCorrect"), 10) || 1,
  };
})();

// ---- js/stimuli.js ----
// Loads real stimulus images from assets/images/manifest.json — a list of
// {concept, file} entries produced by scripts/prepare_things_stimuli.py
// after downloading images from the THINGS dataset (see README).
async function loadStimulusManifest() {
  const manifestUrl = `${EXPERIMENT_CONFIG.imageBaseUrl}/manifest.json`;
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(
      `Could not load ${manifestUrl}. Have you run ` +
        "scripts/prepare_things_stimuli.py yet? See the README's " +
        "'Real stimuli' section."
    );
  }
  return response.json();
}

function shuffleArray(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

// Converts manifest entries ({concept, file}) into the stimulus objects the
// plugin renders ({id, imageUrl, label}). `id` is local to this array
// (0..entries.length-1) — every trial's cue_id/target_pos/response_pos
// indexes into whichever stimuli array is active for the current block.
function stimuliFromManifestEntries(entries) {
  return entries.map((entry, i) => ({
    id: i,
    imageUrl: `${EXPERIMENT_CONFIG.imageBaseUrl}/${entry.file}`,
    label: entry.concept,
  }));
}

// Greedily carves the full manifest into disjoint blocks: shuffle the pool
// once, then repeatedly slice off a chunk of a randomly-chosen size (from
// `sizes`, never the same size as the immediately preceding block — with
// exactly two sizes this means strict alternation; with one size, the
// no-repeat constraint is impossible so it's just used every time) until
// not enough images remain for another full block. No image appears in
// more than one block; leftover images that don't fill a complete block
// are simply unused for this session.
function generateBlocks(manifest, sizes) {
  const pool = shuffleArray(manifest);
  const blocks = [];
  let idx = 0;
  let lastSize = null;
  while (true) {
    const choices = sizes.length > 1 ? sizes.filter((s) => s !== lastSize) : sizes;
    const size = choices[Math.floor(Math.random() * choices.length)];
    if (idx + size > pool.length) break;
    blocks.push({
      entries: pool.slice(idx, idx + size),
      size: size,
    });
    idx += size;
    lastSize = size;
  }
  return blocks;
}

// ---- js/layout.js ----
// Automatically determines how many concentric rings n positions need
// (capped at opts.maxRings and opts.minRingSize), splits the n positions
// as evenly as possible across those rings via a largest-remainder
// apportionment — this guarantees the counts sum to exactly n while
// keeping every ring's angular step (nearly) identical — then places the
// rings ringSpacing apart, starting from a radius where the innermost
// ring's items are roughly opts.itemSpacing px apart.
//
// Coordinates are relative to a center point at (0, 0) — the caller (the
// plugin, which knows the actual render container size) translates these
// into pixel positions.
//
// Every other ring (odd ring index) is rotated by half its own angular
// step. With equal angular steps across rings, this puts every position
// on an odd ring exactly between two positions of the rings next to it
// rather than radially aligned with any of them. (With 3 rings, ring 2
// lines up with ring 0 again — accepted.)

function allocateRingCounts(n, weights) {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (n * w) / totalWeight);
  const counts = raw.map((r) => Math.floor(r));
  let remainder = n - counts.reduce((a, b) => a + b, 0);

  const byFractionDesc = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder; k++) {
    counts[byFractionDesc[k].i] += 1;
  }
  return counts;
}

// Smallest number of rings whose combined circumference can fit n items at
// (approximately) itemSpacing px apart.
function computeNumRings(n, itemSpacing, baseRadius, ringSpacing) {
  let numRings = 1;
  while (true) {
    let capacity = 0;
    for (let r = 0; r < numRings; r++) {
      const radius = baseRadius + r * ringSpacing;
      capacity += (2 * Math.PI * radius) / itemSpacing;
    }
    if (capacity >= n) return numRings;
    numRings++;
  }
}

function computeLayout(n, opts) {
  opts = opts || {};
  const baseRadius = opts.baseRadius || 100;
  const ringSpacing = opts.ringSpacing || 100;
  const itemSpacing = opts.itemSpacing || 100;
  // Caps how many concentric rings a layout can use — fewer rings means
  // less risk of a slow mouse accidentally dwelling on an unintended
  // position while passing over an inner ring en route to an outer one.
  const maxRings = opts.maxRings || Infinity;
  // Since n splits evenly across rings, adding another ring is only worth
  // it if every ring (including the new one) still ends up with at least
  // this many items.
  const minRingSize = opts.minRingSize || 1;

  const numRings = Math.min(
    computeNumRings(n, itemSpacing, baseRadius, ringSpacing),
    maxRings,
    Math.max(1, Math.floor(n / minRingSize))
  );

  // Equal weights split n as evenly as possible across the rings, rather
  // than proportional to radius — see the anti-alignment note above.
  const counts = allocateRingCounts(
    n,
    Array.from({ length: numRings }, () => 1)
  );

  // Each ring's own radius is sized independently from its own item count,
  // so every ring hits ~itemSpacing between its items. baseRadius is still
  // a floor under ring 0, and consecutive rings are never closer than
  // ringSpacing, to keep rings themselves visually distinct even when
  // their item-count-driven radii would otherwise sit close together.
  const radii = [];
  for (let r = 0; r < numRings; r++) {
    const idealRadius = (counts[r] * itemSpacing) / (2 * Math.PI);
    const minRadius = r === 0 ? baseRadius : radii[r - 1] + ringSpacing;
    radii.push(Math.max(idealRadius, minRadius));
  }

  const positions = [];
  let idx = 0;
  for (let r = 0; r < numRings; r++) {
    const ringCount = counts[r];
    if (ringCount === 0) continue;
    const radius = radii[r];
    const angularStep = (2 * Math.PI) / ringCount;
    const stagger = r % 2 === 1 ? angularStep / 2 : 0;
    for (let k = 0; k < ringCount; k++) {
      const angle = angularStep * k + stagger - Math.PI / 2;
      positions.push({
        index: idx,
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
        ring: r,
      });
      idx++;
    }
  }
  return positions;
}

// Derives the render container's size and the center cue's placement
// within it from a block's layout — shared by the plugin (rendering a
// trial) and experiment.js (rendering the ITI's fixation cross) so both
// land the cross at exactly the same spot; computing this independently
// in two places risks them drifting apart, which shows up as the cross
// visibly shifting between a trial and the ITI right after it.
function computeContainerGeometry(positions, positionDiameter) {
  const posRadius = positionDiameter / 2;
  const cueDiameter = positionDiameter + 10;
  const cueRadius = cueDiameter / 2;
  const margin = 20;
  const maxDist = Math.max(...positions.map((p) => Math.hypot(p.x, p.y)));
  const containerRadius = maxDist + posRadius + margin;
  return {
    size: containerRadius * 2,
    centerX: containerRadius,
    centerY: containerRadius,
    posRadius: posRadius,
    cueDiameter: cueDiameter,
    cueRadius: cueRadius,
  };
}

// ---- js/circular-memory-grid-plugin.js ----
// Custom jsPsych plugin, in three stages:
//
// 1. Cross fixation — peripheral positions are visible but dimmed and
//    inert. A neutral dashed cross sits at center. The participant must
//    hover over it continuously for fixation_duration ms; leaving early
//    cancels progress and resets to zero (must be re-established, no
//    partial credit) — the cross is all that's shown, the cue itself is
//    not revealed yet.
//
// 2. Cue viewing — the instant fixation_duration is satisfied (while still
//    hovering), the cross is replaced by the actual cue in the same spot,
//    with no further minimum viewing time required. The participant may
//    look away whenever they choose. On a catch_trial, there's no cue
//    image — instead target_pos is directly highlighted at the periphery
//    while the participant is still hovering the (otherwise unchanged)
//    center, so the same look-away mechanic still gates the response
//    stage below; it just means "how long before you started moving,
//    now that you already know where to go" instead of viewing time.
//
// 3. Response — triggered by that look-away. It permanently hides the cue
//    (it cannot be revisited even by hovering the center again) and
//    simultaneously un-dims and unlocks the peripheral positions for
//    selection. Selecting one always reveals the item actually assigned
//    there (correct or not) as feedback, then the trial ends — except on
//    a catch_trial, where there's no item to reveal, just a
//    correct/incorrect border.
//
//    response_mode controls how a position is selected: "fixation"
//    (default) requires hovering a position continuously for
//    response_fixation_duration ms — leaving early cancels progress on
//    that position (must be re-established, no partial credit, same as
//    cross fixation), and clicking does nothing. "click" instead selects
//    immediately on click.
//
//    response_deadline (ms, 0 disables it) caps how long the participant
//    has to select a position, timed from the start of the response stage
//    (i.e. from the moment they look away from the cross). If it elapses
//    with no selection, the trial ends with a null response and
//    timed_out: true in the recorded data.
var jsPsychCircularMemoryGrid = (function (jspsych) {
  "use strict";

  const info = {
    name: "circular-memory-grid",
    version: "1.0.0",
    parameters: {
      cue_id: { type: jspsych.ParameterType.INT, default: undefined },
      target_pos: { type: jspsych.ParameterType.INT, default: undefined },
      positions: { type: jspsych.ParameterType.OBJECT, default: undefined },
      stimuli: { type: jspsych.ParameterType.OBJECT, default: undefined },
      position_stim_map: { type: jspsych.ParameterType.OBJECT, default: undefined },
      feedback_duration: { type: jspsych.ParameterType.INT, default: 500 },
      fixation_duration: { type: jspsych.ParameterType.INT, default: 500 },
      response_mode: { type: jspsych.ParameterType.STRING, default: "fixation" },
      response_fixation_duration: { type: jspsych.ParameterType.INT, default: 500 },
      response_deadline: { type: jspsych.ParameterType.INT, default: 2000 },
      // Diameter (px) of the peripheral position circles. The central
      // cue/cross is drawn 10px larger than this, preserving the same
      // visual relationship regardless of size.
      position_diameter: { type: jspsych.ParameterType.INT, default: 60 },
      // Whether to show the "Hold your mouse over the cross" / "Look away
      // when you're ready to respond" / "Hover (or Click) where you've
      // seen this shape" guidance text. Meant to be true during a tutorial
      // and false once the participant has learned the mechanics.
      show_hints: { type: jspsych.ParameterType.BOOL, default: true },
      // Catch trial: skips the cue-image stage entirely — as soon as
      // cross-fixation is satisfied, target_pos is directly highlighted
      // and the response epoch starts immediately, with no memory
      // component. Meant as a simple-RT probe, not a recall test.
      catch_trial: { type: jspsych.ParameterType.BOOL, default: false },
    },
    // Rather than pre-computed RT durations, the raw event timestamps
    // (performance.now()-based ms, monotonic and comparable across the
    // whole session) are saved instead — any duration (e.g. viewing time =
    // cue_offset - cue_onset) can be reconstructed from them later, without
    // committing to a fixed set of derived durations up front:
    //   fixation_onset — the fixation cross appears (trial start)
    //   cue_onset      — the cue image (or, on a catch trial, the
    //                    highlighted target position) appears
    //   cue_offset     — the cursor leaves the cue, ending the cue-viewing
    //                    stage and starting the response stage
    //   choice_reveal  — a position is selected and feedback shown (the
    //                    underlying item, or on a catch trial just a
    //                    correct/incorrect border); null if the deadline
    //                    was hit instead
    //   iti_onset      — the trial ends and the inter-trial interval begins
    //                    — feedback is shown for a fixed feedback_duration,
    //                    so iti_onset - choice_reveal is ~feedback_duration
    data: {
      cue_id: { type: jspsych.ParameterType.INT },
      target_pos: { type: jspsych.ParameterType.INT },
      target_x: { type: jspsych.ParameterType.FLOAT },
      target_y: { type: jspsych.ParameterType.FLOAT },
      target_ring: { type: jspsych.ParameterType.INT },
      target_angle: { type: jspsych.ParameterType.FLOAT },
      response_pos: { type: jspsych.ParameterType.INT },
      response_x: { type: jspsych.ParameterType.FLOAT },
      response_y: { type: jspsych.ParameterType.FLOAT },
      response_ring: { type: jspsych.ParameterType.INT },
      response_angle: { type: jspsych.ParameterType.FLOAT },
      response_image: { type: jspsych.ParameterType.STRING },
      correct: { type: jspsych.ParameterType.BOOL },
      fixation_onset: { type: jspsych.ParameterType.INT },
      cue_onset: { type: jspsych.ParameterType.INT },
      cue_offset: { type: jspsych.ParameterType.INT },
      choice_reveal: { type: jspsych.ParameterType.INT },
      iti_onset: { type: jspsych.ParameterType.INT },
      timed_out: { type: jspsych.ParameterType.BOOL },
    },
  };

  class CircularMemoryGridPlugin {
    static info = info;

    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    trial(display_element, trial) {
      const startTime = performance.now();
      const stimuli = trial.stimuli;
      const cueStim = stimuli[trial.cue_id];

      const posDiameter = trial.position_diameter;
      const { size, centerX, centerY, posRadius, cueDiameter, cueRadius } = computeContainerGeometry(
        trial.positions,
        posDiameter
      );

      let html = `<div class="cmg-cue-label">${trial.show_hints ? "Hold your mouse over the cross" : ""}</div>`;
      html += `<div class="cmg-container" style="width:${size}px; height:${size}px;">`;
      html += `<div class="cmg-cue cmg-cue-hidden" style="width:${cueDiameter}px; height:${cueDiameter}px; left:${centerX - cueRadius}px; top:${centerY - cueRadius}px;">+</div>`;
      trial.positions.forEach((p) => {
        html += `<div class="cmg-position cmg-facedown cmg-locked cmg-dimmed" data-pos="${p.index}" style="width:${posDiameter}px; height:${posDiameter}px; left:${centerX + p.x - posRadius}px; top:${centerY + p.y - posRadius}px;"></div>`;
      });
      html += `</div>`;
      display_element.innerHTML = html;

      const labelEl = display_element.querySelector(".cmg-cue-label");
      const cueEl = display_element.querySelector(".cmg-cue");
      const positionEls = display_element.querySelectorAll(".cmg-position");

      let crossFixationSatisfied = false;
      let responseEpochStarted = false;
      let fixationTimerId = null;
      let cueRevealTime = null;
      let responsiveStartTime = null;
      let responded = false;

      const revealCue = () => {
        cueEl.classList.remove("cmg-cue-hidden");
        cueEl.innerHTML = `<img src="${cueStim.imageUrl}" alt="${cueStim.label}" />`;
        cueRevealTime = performance.now();
        labelEl.textContent = trial.show_hints ? "Move your mouse when you're ready to respond" : "";
      };

      // Catch trial: the target position is highlighted in place of a cue
      // image, but the response epoch still only starts once the cursor
      // leaves the center (same mechanic as a normal trial, via the
      // mouseleave listener below) — not immediately. This keeps
      // cue_onset -> cue_offset meaningful as "how long they lingered
      // before moving, now that they already know where to go" and
      // cue_offset -> choice_reveal as the movement/selection time,
      // instead of collapsing both into one instant.
      const revealCatchCue = () => {
        cueRevealTime = performance.now();
        const targetEl = display_element.querySelector(`.cmg-position[data-pos="${trial.target_pos}"]`);
        targetEl.classList.add("cmg-catch-highlight");
      };

      // Assembles and finishes the trial's data — called once feedback is
      // done being shown (or immediately for a timeout, where nothing was
      // ever revealed).
      const completeTrial = (responsePos, correct, choiceRevealTime) => {
        // The ITI trial (experiment.js) starts right after finishTrial
        // resolves, so this is a close proxy for its actual onset.
        const itiOnsetTime = performance.now();
        // *_angle is atan2(y, x) in radians: 0 points right (3 o'clock), and
        // it increases clockwise since y grows downward on screen — the
        // ring's first position (layout.js) sits at -π/2 (12 o'clock).
        const targetPosition = trial.positions.find((p) => p.index === trial.target_pos);
        const responsePosition = responsePos === null ? null : trial.positions.find((p) => p.index === responsePos);
        const responseImage = responsePos === null ? null : stimuli[trial.position_stim_map[responsePos]].label;
        this.jsPsych.finishTrial({
          cue_id: trial.cue_id,
          target_pos: trial.target_pos,
          target_x: targetPosition.x,
          target_y: targetPosition.y,
          target_ring: targetPosition.ring,
          target_angle: Math.atan2(targetPosition.y, targetPosition.x),
          response_pos: responsePos,
          response_x: responsePosition ? responsePosition.x : null,
          response_y: responsePosition ? responsePosition.y : null,
          response_ring: responsePosition ? responsePosition.ring : null,
          response_angle: responsePosition ? Math.atan2(responsePosition.y, responsePosition.x) : null,
          response_image: responseImage,
          correct: correct,
          fixation_onset: Math.round(startTime),
          cue_onset: Math.round(cueRevealTime),
          cue_offset: Math.round(responsiveStartTime),
          choice_reveal: choiceRevealTime === null ? null : Math.round(choiceRevealTime),
          iti_onset: Math.round(itiOnsetTime),
          timed_out: responsePos === null,
        });
      };

      const startResponseEpoch = () => {
        responseEpochStarted = true;
        responsiveStartTime = performance.now();
        labelEl.textContent = trial.show_hints
          ? trial.response_mode === "fixation"
            ? "Hover where you think this object is"
            : "Click where you think this object is"
          : "";
        // The cross/cue is no longer relevant once searching/selecting —
        // remove it entirely rather than leaving the dashed outline behind.
        cueEl.style.display = "none";
        positionEls.forEach((el) => {
          el.classList.remove("cmg-locked");
          el.classList.remove("cmg-dimmed");
        });

        if (trial.response_deadline > 0) {
          this.jsPsych.pluginAPI.setTimeout(() => {
            if (responded) return;
            responded = true;
            labelEl.textContent = "Time's up!";
            this.jsPsych.pluginAPI.setTimeout(() => completeTrial(null, false, null), trial.feedback_duration);
          }, trial.response_deadline);
        }
      };

      cueEl.addEventListener("mouseenter", () => {
        if (responseEpochStarted || crossFixationSatisfied) return;
        // Still in the cross-fixation stage: start the required hold timer.
        fixationTimerId = window.setTimeout(() => {
          fixationTimerId = null;
          crossFixationSatisfied = true;
          if (trial.catch_trial) {
            revealCatchCue();
          } else {
            revealCue();
          }
        }, trial.fixation_duration);
      });

      cueEl.addEventListener("mouseleave", () => {
        if (responseEpochStarted) return;
        if (!crossFixationSatisfied) {
          // Left the cross before the required hold elapsed — must restart.
          if (fixationTimerId !== null) {
            window.clearTimeout(fixationTimerId);
            fixationTimerId = null;
          }
        } else {
          // Cross fixation was already satisfied and the cue was showing —
          // looking away now (no minimum viewing time required) is the
          // one-time trigger into the response epoch.
          startResponseEpoch();
        }
      });

      const selectPosition = (el) => {
        if (!responseEpochStarted || responded) return;
        responded = true;

        const responsePos = parseInt(el.getAttribute("data-pos"), 10);
        const correct = responsePos === trial.target_pos;
        const choiceRevealTime = performance.now();

        el.classList.remove("cmg-facedown");
        el.classList.remove("cmg-catch-highlight");
        el.classList.add(correct ? "cmg-correct" : "cmg-incorrect");
        // Catch trials have no memory content to test, so there's nothing
        // meaningful to reveal — just the correct/incorrect border. Normal
        // trials still reveal whatever item was actually at that position.
        if (!trial.catch_trial) {
          const revealedStim = stimuli[trial.position_stim_map[responsePos]];
          el.innerHTML = `<img src="${revealedStim.imageUrl}" alt="${revealedStim.label}" />`;
        }

        // Feedback is shown for a fixed feedback_duration, regardless of
        // where the participant looks or moves the cursor.
        this.jsPsych.pluginAPI.setTimeout(
          () => completeTrial(responsePos, correct, choiceRevealTime),
          trial.feedback_duration
        );
      };

      if (trial.response_mode === "fixation") {
        let selectionTimerId = null;
        positionEls.forEach((el) => {
          el.addEventListener("mouseenter", () => {
            if (!responseEpochStarted || responded) return;
            selectionTimerId = window.setTimeout(() => {
              selectionTimerId = null;
              selectPosition(el);
            }, trial.response_fixation_duration);
          });
          el.addEventListener("mouseleave", () => {
            if (selectionTimerId !== null) {
              window.clearTimeout(selectionTimerId);
              selectionTimerId = null;
            }
          });
        });
      } else {
        positionEls.forEach((el) => {
          el.addEventListener("click", () => selectPosition(el));
        });
      }
    }
  }

  return CircularMemoryGridPlugin;
})(jsPsychModule);

// ---- js/experiment.js ----
// The task renders into #jspsych-target. index.html provides it; a host that
// runs this script inside its own page (e.g. cognition.run) may not, so
// create it if it's missing.
function ensureDisplayElement() {
  let target = document.getElementById("jspsych-target");
  if (!target) {
    target = document.createElement("div");
    target.id = "jspsych-target";
    document.body.appendChild(target);
  }
  return target;
}

function showStartupError(message) {
  ensureDisplayElement().innerHTML =
    `<p style="color:#c0392b; max-width:500px; text-align:center;">${message}</p>`;
}

// Starts immediately if the page has already finished loading (a host may
// inject this script after DOMContentLoaded has fired, in which case a plain
// listener would never run).
async function startTask() {
  try {
    ensureDisplayElement();
    await runExperiment();
  } catch (err) {
    // Anything that goes wrong during setup (missing manifest, a CDN
    // plugin script that 404'd and left a global undefined, etc.) would
    // otherwise fail silently here, after DOMContentLoaded and before
    // jsPsych.run() — leaving a blank page with no clue why. Surface it.
    showStartupError(`Something went wrong starting the task: ${err.message}`);
    throw err;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startTask);
} else {
  startTask();
}

// Saving data to disk automatically only makes sense when testing locally
// — on cognition.run this would trigger unexpected file writes/downloads
// in every participant's browser, so all of it is gated on hostname.
const isLocalDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const supportsFileSystemAccess = "showDirectoryPicker" in window;
const AUTOSAVE_KEY = "memory_task_autosave";
// jsPsych's generic stimulus/response columns are only ever populated by
// the plain html-keyboard-response trials (instructions, transitions,
// breaks, ITI, debrief) — noise in a CSV meant for analyzing
// circular_memory_grid rows, which use their own more specific fields.
const IGNORED_DATA_COLUMNS = ["stimulus", "response"];

// One-time prompt (Chrome/Edge only) to grant write access to the
// project's data/ folder, so every trial can be written straight to disk
// there without asking again. Returns null if unsupported, skipped, or
// cancelled — callers fall back to the localStorage + browser-download
// path in that case.
async function chooseDataDirectory() {
  if (!supportsFileSystemAccess) return null;
  return new Promise((resolve) => {
    const target = document.getElementById("jspsych-target");
    target.innerHTML =
      '<div style="text-align:center; max-width:500px;">' +
      "<p>Local dev: choose this project's root folder (human_psychophysics) " +
      "to save trial-by-trial data straight into its data/ folder.</p>" +
      '<button id="choose-data-dir">Choose folder</button>' +
      '<p><a id="skip-data-dir" href="#">Skip (browser download at the end instead)</a></p>' +
      "</div>";
    document.getElementById("choose-data-dir").addEventListener("click", async () => {
      try {
        const rootHandle = await window.showDirectoryPicker();
        resolve(await rootHandle.getDirectoryHandle("data", { create: true }));
      } catch (err) {
        resolve(null); // cancelled, or permission denied
      }
    });
    document.getElementById("skip-data-dir").addEventListener("click", (e) => {
      e.preventDefault();
      resolve(null);
    });
  });
}

async function runExperiment() {
  const cfg = EXPERIMENT_CONFIG;

  // Sends the participant back to Prolific once the session is complete.
  // Does nothing until cfg.prolificCompletionCode is filled in.
  function redirectToProlific() {
    if (!cfg.prolificCompletionCode) return;
    window.location.href = `https://app.prolific.com/submissions/complete?cc=${encodeURIComponent(
      cfg.prolificCompletionCode
    )}`;
  }

  const dataDirHandle = isLocalDev ? await chooseDataDirectory() : null;
  const sessionFilename = `session_${Date.now()}.csv`;

  // Overwrites the same on-disk file with the full dataset so far — not an
  // append, so it's always a valid, complete CSV even if the session ends
  // early.
  async function writeSessionFile(csv) {
    const fileHandle = await dataDirHandle.getFileHandle(sessionFilename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(csv);
    await writable.close();
  }

  const jsPsych = initJsPsych({
    display_element: "jspsych-target",
    // Backs up all data collected so far after every trial — to data/ on
    // disk when a folder was granted, otherwise to localStorage (a
    // crash/refresh-proof safety net, not a downloaded file, recoverable
    // from the browser console with window.recoverAutosave()).
    on_trial_finish: function () {
      if (!isLocalDev) return;
      const csv = jsPsych.data.get().ignore(IGNORED_DATA_COLUMNS).csv();
      if (dataDirHandle) {
        writeSessionFile(csv);
      } else {
        localStorage.setItem(AUTOSAVE_KEY, csv);
      }
    },
    on_finish: function () {
      // On cognition.run, this global on_finish only runs after the
      // platform has finished uploading every trial, so redirecting from
      // here (and only here) can't lose data.
      if (!isLocalDev) {
        redirectToProlific();
        return;
      }
      const csv = jsPsych.data.get().ignore(IGNORED_DATA_COLUMNS).csv();
      if (dataDirHandle) {
        writeSessionFile(csv);
      } else {
        jsPsych.data.get().ignore(IGNORED_DATA_COLUMNS).localSave("csv", `memory_task_data_${Date.now()}.csv`);
      }
      localStorage.removeItem(AUTOSAVE_KEY);
    },
  });
  if (isLocalDev) {
    window.recoverAutosave = function () {
      const csv = localStorage.getItem(AUTOSAVE_KEY);
      if (!csv) {
        console.log("No autosaved data found.");
        return;
      }
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `memory_task_autosave_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };
  }
  // Exposed for local debugging/iteration only (e.g. jsPsych.data.get() in
  // the browser console). Harmless to leave in for cognition.run hosting.
  window.jsPsych = jsPsych;

  const manifest = await loadStimulusManifest();

  let tutorialEntries = [];
  let mainPoolEntries;
  if (cfg.tutorialEnabled) {
    if (manifest.length < cfg.tutorialSize) {
      throw new Error(
        `The image pool (${manifest.length} images) isn't large enough to fill ` +
          `the tutorial block (${cfg.tutorialSize}).`
      );
    }
    // The tutorial draws its images up front so they're disjoint from the
    // main session's pool — no image appears in both.
    const shuffledManifest = shuffleArray(manifest);
    tutorialEntries = shuffledManifest.slice(0, cfg.tutorialSize);
    mainPoolEntries = shuffledManifest.slice(cfg.tutorialSize);
  } else {
    mainPoolEntries = shuffleArray(manifest);
  }

  const blockQueue = generateBlocks(mainPoolEntries, cfg.blockSizes);
  if (blockQueue.length === 0) {
    const poolDescription = cfg.tutorialEnabled
      ? `${mainPoolEntries.length} images left after the tutorial`
      : `${mainPoolEntries.length} images`;
    throw new Error(
      `The image pool (${poolDescription}) isn't large enough to fill even the ` +
        `smallest block size (${Math.min(...cfg.blockSizes)}).`
    );
  }

  // --- Block/session state. `activeBlock` is whichever block (tutorial or
  // a main-session block) the trial/preload definitions below currently
  // read from; it's reassigned as the session moves through phases. ---
  let activeBlock = null;
  let currentMainBlock = null;
  let blockCounter = 0;
  let completedBlockCount = 0;
  let totalTrialsRun = 0;
  let transitionMessage = "";
  let sessionAborted = false;

  function buildBlock(kind, entries, size) {
    const stimuli = stimuliFromManifestEntries(entries);
    return {
      kind: kind,
      entries: entries,
      size: size,
      stimuli: stimuli,
      positionStimMap: jsPsych.randomization.shuffle(stimuli.map((s) => s.id)),
      layout: computeLayout(size, {
        baseRadius: 100,
        ringSpacing: cfg.ringSpacing,
        itemSpacing: cfg.itemSpacing,
        maxRings: cfg.maxRings,
        minRingSize: cfg.minRingSize,
      }),
      history: {}, // regular blocks: localIdx -> array of recent bool outcomes
      correctCounts: new Array(size).fill(0), // tutorial: localIdx -> cumulative correct count
      trialCount: 0,
    };
  }

  function recordOutcome(block, localIdx, correct) {
    if (block.kind === "tutorial") {
      if (correct) block.correctCounts[localIdx]++;
      return;
    }
    if (!block.history[localIdx]) block.history[localIdx] = [];
    block.history[localIdx].push(correct);
    if (block.history[localIdx].length > cfg.rollingWindow) {
      block.history[localIdx].shift();
    }
  }

  function rollingAccuracy(block, localIdx) {
    const h = block.history[localIdx];
    if (!h || h.length === 0) return null;
    return h.reduce((sum, v) => sum + (v ? 1 : 0), 0) / h.length;
  }

  // Regular blocks: average of every image's rolling accuracy, null (not
  // yet eligible) until every image has been shown at least once. Tutorial:
  // every image must have at least tutorialMinCorrect correct responses.
  function blockPassed(block) {
    if (block.kind === "tutorial") {
      for (let i = 0; i < block.size; i++) {
        if (block.correctCounts[i] < cfg.tutorialMinCorrect) return false;
      }
      return true;
    }
    const accs = [];
    for (let i = 0; i < block.size; i++) {
      const a = rollingAccuracy(block, i);
      if (a === null) return false;
      accs.push(a);
    }
    const avg = accs.reduce((sum, v) => sum + v, 0) / accs.length;
    return avg >= cfg.blockCriterion;
  }

  // Sets up the next main-session block — every block is attempted exactly
  // once; a block that doesn't pass before hitting the trial cap is left
  // behind rather than requeued. Returns false when there's nothing left
  // to run (session over).
  function advanceToNextBlock() {
    if (sessionAborted) return false;

    if (currentMainBlock) {
      if (currentMainBlock.passed) {
        completedBlockCount++;
        transitionMessage =
          blockQueue.length > 0
            ? "Nice work! Starting a new set of shapes."
            : "Nice work! That was the last set.";
      } else {
        transitionMessage =
          blockQueue.length > 0
            ? "Let's move on to a different set of shapes."
            : "That was the last set.";
      }
      if (totalTrialsRun >= cfg.maxTotalTrials) {
        sessionAborted = true;
      }
    } else {
      transitionMessage = "Starting the first set of shapes.";
    }

    if (sessionAborted || blockQueue.length === 0) {
      currentMainBlock = null;
      activeBlock = null;
      return false;
    }

    const next = blockQueue.shift();
    currentMainBlock = buildBlock("regular", next.entries, next.size);
    currentMainBlock.blockNumber = ++blockCounter;
    activeBlock = currentMainBlock;
    return true;
  }

  const selectInstruction =
    cfg.responseMode === "fixation"
      ? "Hold your mouse over the circle there to make a selection and reveal the object underneath it."
      : "Click the circle to make a selection and reveal the object underneath it.";
  const selectVerb = cfg.responseMode === "fixation" ? "selectable by hovering" : "clickable";
  const deadlineWarning =
    cfg.responseDeadline > 0
      ? ` You'll have ${(cfg.responseDeadline / 1000).toFixed(1)} seconds to do this once you move your mouse away from the cue object, so decide before then.`
      : "";

  const instructions = {
    type: jsPsychInstructions,
    pages: [
      "<h2>Memory Task</h2>" +
        "<p>The goal of this task is to learn and recall the location of hidden objects.</p>" +
        "<p>You'll be cued with an object, and then asked to respond with the location of that object. </p>",

        "<p>On each trial, the circles around the edge are where an object might be hidden.</p>" +
        "<p>Hold your mouse over the cross in the center and keep it there. Once you've held still long enough, the cue object will appear.</p>" +
        "<p>Once the object appears, hold the mouse there and look at it for as long as you like." + 
        "<p>The cue object will dissapear once you move your mouse.",
        
        "<p>When you're ready to answer, move your mouse to the circle on the edge where you think that object is located." +
        `<p>${selectInstruction}</p>` +
        `<p>${deadlineWarning}</p>`,
      (cfg.tutorialEnabled
        ? "<p>You'll start with a short practice round to get the hang of it, then move on to the main task.</p>" +
          "<p>In the main task, you'll work through a series of sets &mdash; each with its own group of objects to learn. You'll automatically move on to a new set after some time.</p>"
        : "<p>You'll work through a series of sets &mdash; each with its own group of objects to learn. You'll automatically move on to a new set after some time.</p>") +
        '<p>Click "Next" or press the right arrow key to begin.</p>',
    ],
    show_clickable_nav: true,
  };

  const blockTransition = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: function () {
      return `<p>${transitionMessage}</p>`;
    },
    choices: "NO_KEYS",
    trial_duration: 1500,
  };

  const blockPreload = {
    type: jsPsychPreload,
    images: function () {
      return activeBlock.stimuli.map((s) => s.imageUrl);
    },
  };

  const iti = {
    type: jsPsychHtmlKeyboardResponse,
    // Keeps the same dashed fixation cross visible in exactly the same
    // spot (rather than a blank page) so feedback -> ITI -> the next
    // trial's cross-fixation stage reads as one continuous marker instead
    // of a flash to empty and back. Reuses the plugin's own geometry
    // (computeContainerGeometry) and markup structure — a container sized
    // to activeBlock's layout, with an empty label above it — so nothing
    // shifts between this and the real trial screens around it.
    stimulus: function () {
      const { size, centerX, centerY, cueDiameter, cueRadius } = computeContainerGeometry(
        activeBlock.layout,
        cfg.positionDiameter
      );
      return (
        '<div class="cmg-cue-label"></div>' +
        `<div class="cmg-container" style="width:${size}px; height:${size}px;">` +
        `<div class="cmg-cue cmg-cue-hidden" style="width:${cueDiameter}px; height:${cueDiameter}px; left:${
          centerX - cueRadius
        }px; top:${centerY - cueRadius}px;">+</div>` +
        "</div>"
      );
    },
    choices: "NO_KEYS",
    trial_duration: cfg.interTrialInterval,
  };

  const blockTrial = {
    type: jsPsychCircularMemoryGrid,
    // Placeholders — on_start overwrites all of these fresh for every
    // trial, based on whichever block is currently active.
    cue_id: 0,
    target_pos: 0,
    positions: [],
    stimuli: [],
    position_stim_map: [],
    feedback_duration: cfg.feedbackDuration,
    fixation_duration: cfg.fixationDuration,
    response_mode: cfg.responseMode,
    response_fixation_duration: cfg.responseFixationDuration,
    response_deadline: cfg.responseDeadline,
    position_diameter: cfg.positionDiameter,
    on_start: function (trial) {
      trial.positions = activeBlock.layout;
      trial.stimuli = activeBlock.stimuli;
      trial.position_stim_map = activeBlock.positionStimMap;
      // Catch trials are a simple-RT probe, not a memory test — never
      // during the tutorial, and no image/memory component involved, so
      // any position can be the target.
      const isCatchTrial = activeBlock.kind !== "tutorial" && Math.random() < cfg.catchTrialProbability;
      trial.catch_trial = isCatchTrial;
      // On-screen guidance text ("Hold your mouse over the cross", "Look
      // away when you're ready to respond", "Hover/Click where you've
      // seen this shape") only shows during the tutorial — by the main
      // session the participant has already learned the mechanics. Never
      // shown on catch trials either way, since they're main-session-only.
      trial.show_hints = activeBlock.kind === "tutorial";

      if (isCatchTrial) {
        trial.cue_id = null;
        trial.target_pos = activeBlock.layout[Math.floor(Math.random() * activeBlock.layout.length)].index;
        trial.data = {
          task: "circular_memory_grid",
          catch_trial: true,
          is_tutorial: false,
          block_number: activeBlock.blockNumber,
          block_size: activeBlock.size,
          block_trial_number: activeBlock.trialCount + 1,
          cue_image: null,
        };
        return;
      }

      const localIdx = Math.floor(Math.random() * activeBlock.size);
      trial.cue_id = localIdx;
      trial.target_pos = activeBlock.positionStimMap.indexOf(localIdx);
      trial.data = {
        task: "circular_memory_grid",
        catch_trial: false,
        is_tutorial: activeBlock.kind === "tutorial",
        block_number: activeBlock.kind === "tutorial" ? 0 : activeBlock.blockNumber,
        block_size: activeBlock.size,
        block_trial_number: activeBlock.trialCount + 1,
        cue_image: activeBlock.stimuli[localIdx].label,
      };
    },
    on_finish: function (data) {
      activeBlock.trialCount++;
      totalTrialsRun++;
      // Catch trials aren't tied to a real cued image, so they're excluded
      // from the rolling-accuracy tracking that decides when a block
      // passes — including them would corrupt per-image accuracy with an
      // artificially easy "trial" that isn't testing recall at all.
      if (!data.catch_trial) {
        recordOutcome(activeBlock, data.cue_id, data.correct);
      }
    },
  };

  const blockLoop = {
    timeline: [blockTrial, iti],
    loop_function: function () {
      if (blockPassed(activeBlock)) {
        activeBlock.passed = true;
        return false;
      }
      if (activeBlock.trialCount >= cfg.maxAttemptsMultiplier * activeBlock.size) {
        activeBlock.passed = false;
        return false;
      }
      if (totalTrialsRun >= cfg.maxTotalTrials) {
        activeBlock.passed = false;
        return false;
      }
      return true;
    },
  };

  const breakTrial = {
    // Only shown from the 2nd main-session block onward — activeBlock is
    // already pointing at the block about to run by the time this node's
    // condition is checked (loop_function reassigns it before looping back
    // to the top of sessionLoop's timeline).
    timeline: [
      {
        type: jsPsychHtmlKeyboardResponse,
        stimulus:
          "<h2>Take a break</h2>" +
          "<p>Rest for a moment if you'd like. The task will continue " +
          "automatically in a couple of minutes, or press any key to " +
          "continue sooner.</p>",
        choices: "ALL_KEYS",
        trial_duration: cfg.breakDuration,
      },
    ],
    conditional_function: function () {
      return cfg.breakDuration > 0 && activeBlock && activeBlock.kind !== "tutorial" && activeBlock.blockNumber > 1;
    },
  };

  const postTutorialScreen = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus:
      "<h2>Practice complete!</h2>" +
      "<p>Now you'll move on to the main task, with larger sets of shapes.</p>" +
      "<p>Press any key to begin.</p>",
    choices: "ALL_KEYS",
    on_finish: function () {
      // Seeds the first main-session block so blockTransition's message and
      // blockPreload/blockTrial's activeBlock-dependent params have
      // something to read on sessionLoop's very first iteration.
      advanceToNextBlock();
    },
  };

  const sessionLoop = {
    timeline: [breakTrial, blockTransition, blockPreload, blockLoop],
    loop_function: function () {
      return advanceToNextBlock();
    },
  };

  const debrief = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: function () {
      // Excludes the tutorial so the reported accuracy reflects the main
      // task, not the practice round.
      const memoryTrials = jsPsych.data.get().filter({ task: "circular_memory_grid", is_tutorial: false });
      const nCorrect = memoryTrials.filter({ correct: true }).count();
      const nTotal = memoryTrials.count();
      const accuracy = nTotal > 0 ? Math.round((100 * nCorrect) / nTotal) : 0;
      return (
        "<h2>Task complete!</h2>" +
        `<p>Sets completed: ${completedBlockCount}</p>` +
        `<p>Your accuracy: ${accuracy}%</p>` +
        "<p>Press any key to finish.</p>"
      );
    },
    choices: "ALL_KEYS",
  };

  // Set up the first active block, before the timeline starts, so
  // blockTransition/blockPreload/blockTrial have something to read on
  // their very first run.
  let timeline;
  if (cfg.tutorialEnabled) {
    activeBlock = buildBlock("tutorial", tutorialEntries, cfg.tutorialSize);
    transitionMessage = "Let's start with a quick practice round.";
    timeline = [instructions, blockTransition, blockPreload, blockLoop, postTutorialScreen, sessionLoop, debrief];
  } else {
    // No tutorial: seed the first main-session block directly so
    // sessionLoop's first iteration has an activeBlock to read.
    advanceToNextBlock();
    timeline = [instructions, sessionLoop, debrief];
  }

  jsPsych.run(timeline);
}
