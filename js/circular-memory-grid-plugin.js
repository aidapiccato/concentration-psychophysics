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
//    look away whenever they choose.
//
// 3. Response — triggered by that look-away. It permanently hides the cue
//    (it cannot be revisited even by hovering the center again) and
//    simultaneously un-dims and unlocks the peripheral positions for
//    selection. Selecting one always reveals the item actually assigned
//    there (correct or not) as feedback, then the trial ends.
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
      feedback_duration: { type: jspsych.ParameterType.INT, default: 900 },
      fixation_duration: { type: jspsych.ParameterType.INT, default: 500 },
      response_mode: { type: jspsych.ParameterType.STRING, default: "fixation" },
      response_fixation_duration: { type: jspsych.ParameterType.INT, default: 500 },
      response_deadline: { type: jspsych.ParameterType.INT, default: 2000 },
      // Whether to show the "Hold your mouse over the cross" / "Look away
      // when you're ready to respond" / "Hover (or Click) where you've
      // seen this shape" guidance text. Meant to be true during a tutorial
      // and false once the participant has learned the mechanics.
      show_hints: { type: jspsych.ParameterType.BOOL, default: true },
    },
    data: {
      cue_id: { type: jspsych.ParameterType.INT },
      target_pos: { type: jspsych.ParameterType.INT },
      response_pos: { type: jspsych.ParameterType.INT },
      correct: { type: jspsych.ParameterType.BOOL },
      rt: { type: jspsych.ParameterType.INT },
      fixation_rt: { type: jspsych.ParameterType.INT },
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

      const maxDist = Math.max(...trial.positions.map((p) => Math.hypot(p.x, p.y)));
      const posRadius = 30;
      const margin = 20;
      const containerRadius = maxDist + posRadius + margin;
      const size = containerRadius * 2;
      const centerX = containerRadius;
      const centerY = containerRadius;

      let html = `<div class="cmg-cue-label">${trial.show_hints ? "Hold your mouse over the cross" : ""}</div>`;
      html += `<div class="cmg-container" style="width:${size}px; height:${size}px;">`;
      html += `<div class="cmg-cue cmg-cue-hidden" style="left:${centerX - 35}px; top:${centerY - 35}px;">+</div>`;
      trial.positions.forEach((p) => {
        html += `<div class="cmg-position cmg-facedown cmg-locked cmg-dimmed" data-pos="${p.index}" style="left:${centerX + p.x - posRadius}px; top:${centerY + p.y - posRadius}px;"></div>`;
      });
      html += `</div>`;
      display_element.innerHTML = html;

      const labelEl = display_element.querySelector(".cmg-cue-label");
      const cueEl = display_element.querySelector(".cmg-cue");
      const positionEls = display_element.querySelectorAll(".cmg-position");

      let crossFixationSatisfied = false;
      let responseEpochStarted = false;
      let fixationTimerId = null;
      let responsiveStartTime = null;
      let responded = false;

      const revealCue = () => {
        cueEl.classList.remove("cmg-cue-hidden");
        cueEl.innerHTML = `<img src="${cueStim.imageUrl}" alt="${cueStim.label}" />`;
        labelEl.textContent = trial.show_hints ? "Move your mouse when you're ready to respond" : "";
      };

      const finishWithResponse = (responsePos, correct) => {
        const rt = responsePos === null ? null : Math.round(performance.now() - responsiveStartTime);
        const fixationRt = Math.round(responsiveStartTime - startTime);
        this.jsPsych.pluginAPI.setTimeout(() => {
          this.jsPsych.finishTrial({
            cue_id: trial.cue_id,
            target_pos: trial.target_pos,
            response_pos: responsePos,
            correct: correct,
            rt: rt,
            fixation_rt: fixationRt,
            timed_out: responsePos === null,
          });
        }, trial.feedback_duration);
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
            finishWithResponse(null, false);
          }, trial.response_deadline);
        }
      };

      cueEl.addEventListener("mouseenter", () => {
        if (responseEpochStarted || crossFixationSatisfied) return;
        // Still in the cross-fixation stage: start the required hold timer.
        fixationTimerId = window.setTimeout(() => {
          fixationTimerId = null;
          crossFixationSatisfied = true;
          revealCue();
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
        const revealedStim = stimuli[trial.position_stim_map[responsePos]];
        const correct = responsePos === trial.target_pos;

        el.classList.remove("cmg-facedown");
        el.classList.add(correct ? "cmg-correct" : "cmg-incorrect");
        el.innerHTML = `<img src="${revealedStim.imageUrl}" alt="${revealedStim.label}" />`;

        finishWithResponse(responsePos, correct);
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
