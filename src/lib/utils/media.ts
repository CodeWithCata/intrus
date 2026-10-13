/**
 * prefers-reduced-motion helpers.
 */

export const reducedMotionQuery = matchMedia("(prefers-reduced-motion:reduce)"), prefersReducedMotion = () => reducedMotionQuery.matches;
