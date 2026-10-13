/**
 * App icon badge (Badging API). Used only for online rooms: while the page is hidden and the host starts a round or the
 * results arrive, the app icon shows a dot; it clears as soon as the player comes back. Browsers without the API, or that
 * refuse it (iOS needs notification permission for badges), do nothing: every call is safe and never throws.
 */
interface BadgeNavigator {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
}

const badgeNav = (): BadgeNavigator => navigator as unknown as BadgeNavigator;

export function setBadge(count = 1): void {
    try {
        void badgeNav().setAppBadge?.(count)?.catch(() => undefined);
    }
    catch {
        // Unsupported or refused: the badge is a nicety, nothing depends on it.
    }
}

export function clearBadge(): void {
    try {
        void badgeNav().clearAppBadge?.()?.catch(() => undefined);
    }
    catch {
        // See setBadge.
    }
}
