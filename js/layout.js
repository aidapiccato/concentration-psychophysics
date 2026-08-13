// Automatically determines how many concentric rings n positions need
// (capped at opts.maxRings and opts.minRingSize), splits the n positions
// as evenly as possible across those rings via a largest-remainder
// apportionment — this guarantees the counts sum to exactly n while
// keeping every ring's angular step (nearly) identical — then sizes each
// ring's own radius from its own item count so every ring independently
// keeps its items roughly opts.itemSpacing px apart.
//
// Coordinates are relative to a center point at (0, 0) — the caller (the
// plugin, which knows the actual render container size) translates these
// into pixel positions.
//
// Every other ring (odd ring index) is rotated by half its own angular
// step. With equal angular steps across rings, this puts every outer-ring
// position exactly between two inner-ring ones rather than radially
// aligned with any of them — so a cursor travelling from the center
// straight out to an outer position never passes directly over an inner
// one.

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
  // so every ring hits ~itemSpacing between its items — not just whichever
  // ring happens to need the most room, with the rest left however loose a
  // single shared scale factor left them (which could leave some rings far
  // more spread out than itemSpacing actually called for). baseRadius is
  // still a floor under ring 0, and consecutive rings are never closer
  // than ringSpacing, to keep rings themselves visually distinct even when
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
