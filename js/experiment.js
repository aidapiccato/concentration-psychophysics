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
