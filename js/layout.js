// Automatically determines how many concentric rings n positions need so
// that adjacent items are spaced roughly opts.itemSpacing px apart (capped
// at opts.maxRings — scaling all ring radii up uniformly instead, if that
// cap would otherwise leave items too close together), then splits the n
// positions as evenly as possible across those rings via a
// largest-remainder apportionment — this guarantees the counts sum to
// exactly n while keeping every ring's angular step (nearly) identical.
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
  const unscaledRadii = [];
  for (let r = 0; r < numRings; r++) {
    unscaledRadii.push(baseRadius + r * ringSpacing);
  }

  // Equal weights split n as evenly as possible across the rings, rather
  // than proportional to radius — see the anti-alignment note above.
  const counts = allocateRingCounts(n, unscaledRadii.map(() => 1));

  // Since counts are now independent of each ring's unscaled radius, the
  // innermost ring (smallest unscaled radius, but no fewer items than any
  // other ring) is typically the tightest fit. Scale every ring's radius
  // up uniformly (preserving their relative proportions) until whichever
  // ring is actually most cramped — its assigned count needs more
  // circumference than its unscaled radius provides — keeps items roughly
  // itemSpacing apart. A no-op (scale 1) when nothing is cramped.
  let scale = 1;
  for (let r = 0; r < numRings; r++) {
    const requiredRadius = (counts[r] * itemSpacing) / (2 * Math.PI);
    scale = Math.max(scale, requiredRadius / unscaledRadii[r]);
  }
  const radii = unscaledRadii.map((r) => r * scale);

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
