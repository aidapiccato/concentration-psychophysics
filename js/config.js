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
