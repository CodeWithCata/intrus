<!-- Root component: renders the screen named by nav.screen inside {#key nav.n}, plus SheetHost, Toast and TitleList. -->
<script lang="ts">
  import { mount, unmount, untrack, type Component } from "svelte";
  import { nav, screenProps, takeAfterRender, type Screen } from "#lib/stores/nav.svelte.ts";
  import { focusScreenHeading } from "#lib/stores/ui.svelte.ts";
  import { state, appEl } from "#lib/stores/settings.svelte.ts";
  import "#lib/views/setup.ts";
  import "#lib/views/intro.ts";
  import "#lib/views/pass.ts";
  import "#lib/views/talk.ts";
  import "#lib/views/vote.ts";
  import "#lib/views/svote.ts";
  import "#lib/views/tally.ts";
  import "#lib/views/reveal.ts";
  import SetupScreen from "#lib/views/SetupScreen.svelte";
  import IntroScreen from "#lib/views/IntroScreen.svelte";
  import PassScreen from "#lib/views/PassScreen.svelte";
  import TalkScreen from "#lib/views/TalkScreen.svelte";
  import VoteScreen from "#lib/views/VoteScreen.svelte";
  import SimVoteScreen from "#lib/views/SimVoteScreen.svelte";
  import TallyScreen from "#lib/views/TallyScreen.svelte";
  import RevealScreen from "#lib/views/RevealScreen.svelte";
  import TrollRevealScreen from "#lib/views/TrollRevealScreen.svelte";
  import ScoreboardScreen from "#lib/views/ScoreboardScreen.svelte";
  import OnlineScreen from "#lib/views/OnlineScreen.svelte";
  import SheetHost from "#lib/components/sheets/SheetHost.svelte";
  import Toast from "#lib/components/ui/Toast.svelte";
  import UpdateBanner from "#lib/components/ui/UpdateBanner.svelte";
  import TitleList from "#lib/components/players/TitleList.svelte";

  type AnyScreen = Component<Record<string, unknown>>;
  const screens = {
    setup: SetupScreen,
    intro: IntroScreen,
    pass: PassScreen,
    talk: TalkScreen,
    vote: VoteScreen,
    svote: SimVoteScreen,
    tally: TallyScreen,
    reveal: RevealScreen,
    troll: TrollRevealScreen,
    scoreboard: ScoreboardScreen,
    online: OnlineScreen
  } as unknown as Record<Screen, AnyScreen>;

  const Current = $derived(nav.screen ? screens[nav.screen] : null);

  /* The toast lives in <body>, outside #app, so it stays clickable (undo) while a sheet makes #app inert. */
  $effect(() => {
    const t = mount(Toast, { target: document.body });
    return () => {
      unmount(t);
    };
  });

  /* Same for the "new version" banner: it sits in <body> so it stays tappable while #app is inert. */
  $effect(() => {
    const u = mount(UpdateBanner, { target: document.body });
    return () => {
      unmount(u);
    };
  });

  /* The player-title suggestions (`<datalist id="ttls">`) also live in <body>, outside #app, as before. */
  $effect(() => {
    const l = mount(TitleList, { target: document.body });
    return () => {
      unmount(l);
    };
  });

  /* After every screen change: top of the page, focus on the heading, staggered entrance (--k), queued work. */
  $effect(() => {
    void nav.n; // read it so the effect re-runs on every screen change
    untrack(() => {
      if (!nav.screen) {
        return;
      }
      window.scrollTo(0, 0);
      focusScreenHeading();
      if (!state.lite) {
        [appEl, ...appEl.querySelectorAll(".screen,.page2,.vgrid,.stage,ul")].forEach(c => [...c.children].forEach((el, i) => (el as HTMLElement).style.setProperty("--k", String(i))));
      }
      for (const fn of takeAfterRender()) {
        try {
          fn();
        } catch (e) {
          // one failing job (a sound, the voice host) must not stop the others
          console.error("[app] after-render job failed", e);
        }
      }
    });
  });
</script>

{#key nav.n}
  {#if Current}
    {@const P = screenProps()}
    <Current {...P} />
  {/if}
{/key}
<SheetHost />
