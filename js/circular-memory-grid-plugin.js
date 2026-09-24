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
