/** The home-screen shortcuts of static/manifest.json (`/?shortcut=new` and `/?shortcut=join`). No imports, so it is trivial to test. */
export type Shortcut = "new" | "join";

/** The shortcut named by a query string, or null (anything else in the URL is ignored). */
export function shortcutFromSearch(search: string): Shortcut | null {
    const v = new URLSearchParams(search).get("shortcut");
    return v === "new" || v === "join" ? v : null;
}
