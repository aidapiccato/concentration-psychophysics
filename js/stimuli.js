// Loads real stimulus images from assets/images/manifest.json — a list of
// {concept, file} entries produced by scripts/prepare_things_stimuli.py
// after downloading images from the THINGS dataset (see README).
async function loadStimulusManifest() {
  const response = await fetch("assets/images/manifest.json");
  if (!response.ok) {
    throw new Error(
      "Could not load assets/images/manifest.json. Have you run " +
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
    imageUrl: `assets/images/${entry.file}`,
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
