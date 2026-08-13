// Experiment configuration. Values can be overridden via URL query params for
// quick local iteration, e.g. index.html?blockSizes=6,12&criterion=0.7
const EXPERIMENT_CONFIG = (function () {
  const params = new URLSearchParams(window.location.search);
  const itemSpacing = parseInt(params.get("spacing"), 10) || 100;

  // Block sizes to cycle through — one is picked at random for each new
  // block. Pass e.g. ?blockSizes=6,12,18 to override the set.
  const blockSizesParam = params.get("blockSizes");
  const blockSizes = blockSizesParam
    ? blockSizesParam
        .split(",")
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isInteger(n) && n > 0)
    : [6, 12];

  return {
    itemSpacing: itemSpacing,
    feedbackDuration: parseInt(params.get("feedback"), 10) || 1000,
    interTrialInterval: parseInt(params.get("iti"), 10) || 500,
    fixationDuration: parseInt(params.get("fixation"), 10) || 500,
    // "fixation" (default) or "click" — in fixation mode, a peripheral
    // position is selected by continuously hovering it for
    // responseFixationDuration ms instead of clicking it. Pass
    // ?response=click to opt back into plain clicking.
    responseMode: params.get("response") === "click" ? "click" : "fixation",
    responseFixationDuration: parseInt(params.get("responseFixation"), 10) || 500,
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
    rollingWindow: parseInt(params.get("rollingWindow"), 10) || 10,
    blockCriterion: parseFloat(params.get("criterion")) || 0.8,
    maxAttemptsMultiplier: parseInt(params.get("maxAttemptsMultiplier"), 10) || 10,
    // Safety valve: force-ends the session after this many trials total
    // even if blocks remain unfinished, so a subject can't get stuck
    // indefinitely.
    maxTotalTrials: parseInt(params.get("maxTotalTrials"), 10) || 2000,

    // Tutorial: a single practice block (disjoint from the main session's
    // image pool) run before the main session, using its own pass
    // criterion — every image must be answered correctly at least
    // tutorialMinCorrect times (a plain cumulative count, not a rolling
    // average like the main blocks use).
    tutorialSize: parseInt(params.get("tutorialSize"), 10) || 4,
    tutorialMinCorrect: parseInt(params.get("tutorialMinCorrect"), 10) || 2,
  };
})();
