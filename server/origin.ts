/**
 * Origin allow-list for WebSocket upgrades and /api/new-code. Browsers always send Origin on those requests;
 * a missing or unlisted Origin is refused. ALLOWED_ORIGINS is a comma-separated list of origins:
 *  - exact:               https://intrus.example.com
 *  - any subdomain:       https://*.example.com            (one or more labels: a.example.com, a.b.example.com)
 *  - one label, any text: https://*--intrus.netlify.app    (deploy-preview-3--intrus.netlify.app; the * never spans a dot)
 *  - "*" alone allows everything (local experiments only).
 * A wildcard must be followed by a full domain that itself contains a dot (example.com), so "https://*.com" and
 * "https://*" match nothing. Prefer exact origins in production; never allow all of a shared host such as *.netlify.app,
 * because then ANY site on that host could use this server.
 */
const norm = (s: string): string => s.trim().replace(/\/+$/, "").toLowerCase();
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function isAllowedOrigin(origin: string | null | undefined, allowed: string | undefined): boolean {
  const list = (allowed ?? "").split(",").map(norm).filter(Boolean);
  if (list.includes("*")) return true;
  if (!origin) return false;
  const o = norm(origin);
  return list.some((entry) => {
    if (!entry.includes("*")) return entry === o;
    // The part after the last * must be a real domain (has a dot once leading "." / "-" are dropped).
    const rest = entry.slice(entry.lastIndexOf("*") + 1).replace(/^[.-]+/, "");
    if (!rest.includes(".")) return false;
    const pattern = escapeRe(entry)
      .replace(/\\\*\\\./g, "([a-z0-9-]+\\.)+") // "*." = one or more whole labels
      .replace(/\\\*/g, "[a-z0-9-]+"); // any other "*" = characters inside ONE label
    return new RegExp("^" + pattern + "$").test(o);
  });
}
