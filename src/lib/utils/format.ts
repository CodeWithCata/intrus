/**
 * formatClock(seconds) -> "mm:ss".
 */

export const formatClock = (s?: any) => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
