/** A uniform random number in [0, 1) from the platform's secure generator (Workers and Node 20+). */
export function secureRng(): () => number {
  const buf = new Uint32Array(1);
  return () => {
    crypto.getRandomValues(buf);
    return buf[0] / 0x1_0000_0000;
  };
}
