function showStartupError(message) {
  document.getElementById("jspsych-target").innerHTML =
    `<p style="color:#c0392b; max-width:500px; text-align:center;">${message}</p>`;
}

document.addEventListener("DOMContentLoaded", async function () {
  try {
    await runExperiment();
  } catch (err) {
    // Anything that goes wrong during setup (missing manifest, a CDN
    // plugin script that 404'd and left a global undefined, etc.) would
    // otherwise fail silently here, after DOMContentLoaded and before
    // jsPsych.run() — leaving a blank page with no clue why. Surface it.
    showStartupError(`Something went wrong starting the task: ${err.message}`);
    throw err;
  }
});

async function runExperiment() {
  const cfg = EXPERIMENT_CONFIG;

  const jsPsych = initJsPsych({
    display_element: "jspsych-target",
    on_finish: function () {
      // Local dev convenience: uncomment to auto-download a CSV when testing.
      // jsPsych.data.get().localSave("csv", "memory_task_data.csv");
    },
  });
  // Exposed for local debugging/iteration only (e.g. jsPsych.data.get() in
  // the browser console). Harmless to leave in for cognition.run hosting.
  window.jsPsych = jsPsych;

  const manifest = await loadStimulusManifest();
  if (manifest.length < cfg.tutorialSize) {
    throw new Error(
      `The image pool (${manifest.length} images) isn't large enough to fill ` +
        `the tutorial block (${cfg.tutorialSize}).`
    );
  }
  // The tutorial draws its images up front so they're disjoint from the
  // main session's pool — no image appears in both.
  const shuffledManifest = shuffleArray(manifest);
  const tutorialEntries = shuffledManifest.slice(0, cfg.tutorialSize);
  const mainPoolEntries = shuffledManifest.slice(cfg.tutorialSize);

  const blockQueue = generateBlocks(mainPoolEntries, cfg.blockSizes);
  if (blockQueue.length === 0) {
    throw new Error(
      `The image pool (${mainPoolEntries.length} images left after the tutorial) isn't ` +
        `large enough to fill even the smallest block size (${Math.min(...cfg.blockSizes)}).`
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
      layout: computeLayout(size, { baseRadius: 100, ringSpacing: 100, itemSpacing: cfg.itemSpacing }),
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
      "<p>You'll start with a short practice round to get the hang of it, then move on to the main task.</p>" +
        "<p>In the main task, you'll work through a series of sets &mdash; each with its own group of objects to learn. You'll automatically move on to a new set after some time.</p>" +
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
    stimulus: "",
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
    on_start: function (trial) {
      const localIdx = Math.floor(Math.random() * activeBlock.size);
      trial.cue_id = localIdx;
      trial.target_pos = activeBlock.positionStimMap.indexOf(localIdx);
      trial.positions = activeBlock.layout;
      trial.stimuli = activeBlock.stimuli;
      trial.position_stim_map = activeBlock.positionStimMap;
      // On-screen guidance text ("Hold your mouse over the cross", "Look
      // away when you're ready to respond", "Hover/Click where you've
      // seen this shape") only shows during the tutorial — by the main
      // session the participant has already learned the mechanics.
      trial.show_hints = activeBlock.kind === "tutorial";
      trial.data = {
        task: "circular_memory_grid",
        is_tutorial: activeBlock.kind === "tutorial",
        block_number: activeBlock.kind === "tutorial" ? 0 : activeBlock.blockNumber,
        block_size: activeBlock.size,
        block_trial_number: activeBlock.trialCount + 1,
        image_concept: activeBlock.stimuli[localIdx].label,
      };
    },
    on_finish: function (data) {
      activeBlock.trialCount++;
      totalTrialsRun++;
      recordOutcome(activeBlock, data.cue_id, data.correct);
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
    timeline: [blockTransition, blockPreload, blockLoop],
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

  // Set up the tutorial as the first active block, before the timeline
  // starts, so blockTransition/blockPreload/blockTrial have something to
  // read on their very first run.
  activeBlock = buildBlock("tutorial", tutorialEntries, cfg.tutorialSize);
  transitionMessage = "Let's start with a quick practice round.";

  const timeline = [instructions, blockTransition, blockPreload, blockLoop, postTutorialScreen, sessionLoop, debrief];

  jsPsych.run(timeline);
}
