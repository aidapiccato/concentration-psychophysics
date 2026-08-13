// Automatically determines how many concentric rings n positions need so
// that adjacent items are spaced roughly opts.itemSpacing px apart, then
// allocates the n positions across those rings proportional to each ring's
// circumference (equivalently, its radius) via a largest-remainder
// apportionment — this guarantees the counts sum to exactly n while
// keeping actual on-screen distance between adjacent items approximately
// constant across rings, not just within a ring.
//
// Coordinates are relative to a center point at (0, 0) — the caller (the
// plugin, which knows the actual render container size) translates these
// into pixel positions.
//
// Every other ring (odd ring index) is rotated by half its own angular step
// so points don't line up radially with the ring inside it.

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

  const numRings = computeNumRings(n, itemSpacing, baseRadius, ringSpacing);
  const radii = [];
  for (let r = 0; r < numRings; r++) {
    radii.push(baseRadius + r * ringSpacing);
  }
  const counts = allocateRingCounts(n, radii);

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
