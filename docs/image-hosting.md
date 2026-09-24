# Moving stimulus images to external hosting

Status: not yet implemented — on hold pending a local self-test session and
a look at the resulting data. This doc exists so the reasoning and the plan
aren't lost in the meantime.

## Why this might be necessary

The task currently ships its 1,854 THINGS stimulus images (~1.1GB,
`assets/images/`) as part of the git repo, and cognition.run's GitHub
Actions integration (`.github/workflows/cognition-github-actions.yml`,
using `javidalpe/cognition-deploy-action`) deploys straight from that repo.

When we first pushed the images, the deployed experiment still 404'd on
`manifest.json` and every stimulus image. Cognition.run's account appears
to have a quota on how many stimulus assets it will accept — we hit that
quota trying to upload all 1,854 images at once, so the deploy silently
didn't include them (or included only a subset).

If that quota can't be raised (a paid tier, a support request, etc.), the
task can't rely on cognition.run's own asset storage for the full image
set, and needs to load images from somewhere else instead.

## The plan: Cloudflare R2

R2 is Cloudflare's S3-compatible object storage, with a free tier and
(notably) no egress/bandwidth fees — a meaningful advantage over AWS S3 for
a task where many participants will each download a chunk of the image set
over the course of the study.

### Tradeoffs vs. keeping everything in cognition.run/GitHub

- **New external dependency.** The task now depends on two services being
  up during a session (cognition.run and the R2 bucket) instead of one.
  R2's uptime is generally solid, but it's a real added dependency worth
  naming.
- **Preload timing, not response timing.** jsPsych's `preload` plugin
  already fetches each block's images before trials start, so this mostly
  affects preload wait time, not in-trial reaction times. A slow or flaky
  connection could mean a slower preload, or rarely a failed fetch —
  R2's CDN should be comparable to or better than whatever cognition.run's
  own asset hosting does today.
- **A second deploy step.** Right now, `git push` is the entire deploy —
  the GitHub Action handles the rest. With R2, code changes still deploy
  via `git push`, but image changes (adding/removing/re-cropping stimuli)
  need a separate upload step to the bucket. These two are easy to let
  drift out of sync if forgotten.
- **Smaller, faster repo.** As a plus: pulling images out of git shrinks
  the repo back down from ~1.1GB to a normal code-sized repo, so pushes
  and clones stay fast. (The already-pushed commit containing the images
  would still bloat repo history unless we later rewrite it — a separate,
  more disruptive cleanup we'd only do if repo size becomes a real
  problem.)

## Steps, when we're ready

**On the Cloudflare side (manual, one-time):**
1. Create an R2 bucket (e.g. `psychophysics-stimuli`).
2. Enable public access on it — the free `r2.dev` subdomain, or a custom
   domain if one's available.
3. Create an R2 API token (Access Key ID + Secret Access Key) scoped to
   that bucket, for uploading. These stay out of the repo and out of
   chat — set as local environment variables when running the upload
   script.

**In this codebase:**
1. Add `scripts/upload_to_r2.py` — a small script using `boto3` against
   R2's S3-compatible API to push all images in `assets/images/` up to
   the bucket in one go.
2. Update `js/stimuli.js` so `stimuliFromManifestEntries` builds
   `imageUrl` from the R2 public base URL instead of the local
   `assets/images/${file}` relative path. `manifest.json` itself is tiny
   and can stay in the repo/deployed via cognition.run as before — only
   the actual image files move.
3. Revert `assets/images/` back to `.gitignore` so the repo goes back to
   being code-only.
4. Update the README's "Real stimuli" section to document the R2 upload
   step as part of getting images live, and drop the note about
   committing images directly.

## Why we're holding off

Before spending time on this, we want to run a full session locally
(tutorial + main blocks) and look at the resulting data to confirm the
task itself is behaving as intended. No point migrating image hosting for
a task that might still need behavioral changes first.
