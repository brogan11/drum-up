// Per-account limits for profile media. These are the "standard" allotment and
// currently apply to every user. They live in one place so that when tiered
// plans ship later, only this file (and the gating call sites) need to change.
// Keep the copy neutral in the UI — e.g. "3 of 3 used", never an upsell.

export const STANDARD_PLAN = {
  maxVideos: 3,
  maxPhotos: 6,
}

// Convenience helpers so call sites read clearly.
export function videoLimit() {
  return STANDARD_PLAN.maxVideos
}
export function photoLimit() {
  return STANDARD_PLAN.maxPhotos
}
