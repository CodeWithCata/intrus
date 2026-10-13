<!-- Hero artwork (detective with a magnifying glass) on the setup screen. -->
<script lang="ts">
  // Animated detective scene on the home screen (static artwork; only the ink colour is shared).
  import { INK } from "#lib/data/constants.ts";
</script>

<svg viewBox="0 0 160 150" role="img" aria-label="Detectiv cu lupă">
  <defs><radialGradient id="hm"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><linearGradient id="hc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2E2E35"/><stop offset="1" stop-color="{INK}"/></linearGradient></defs>
  <circle cx="126" cy="30" r="27" fill="url(#hm)"/><circle cx="126" cy="30" r="14" fill="#fff" fill-opacity=".28"/>
  <g fill="#fff" fill-opacity=".15"><circle cx="121" cy="26" r="3.2"/><circle cx="131" cy="36" r="2.2"/><circle cx="128.500" cy="23.500" r="1.400"/></g>
  <ellipse cx="108" cy="58" rx="16" ry="2.600" fill="#fff" fill-opacity=".14"/><ellipse cx="24" cy="60" rx="14" ry="2.400" fill="#fff" fill-opacity=".12"/>
  <path class="tw" transform="translate(100 14) scale(.9)" d="M0-4Q0 0 4 0Q0 0 0 4Q0 0-4 0Q0 0 0-4z" fill="#fff" fill-opacity=".8"/><path class="tw" style="animation-delay:-2s" transform="translate(150 70) scale(.7)" d="M0-4Q0 0 4 0Q0 0 0 4Q0 0-4 0Q0 0 0-4z" fill="#fff" fill-opacity=".7"/><path class="tw" style="animation-delay:-3s" transform="translate(46 22) scale(.6)" d="M0-4Q0 0 4 0Q0 0 0 4Q0 0-4 0Q0 0 0-4z" fill="#fff" fill-opacity=".6"/>
  <g fill="#000" fill-opacity=".16"><rect x="2" y="92" width="20" height="58"/><rect x="24" y="76" width="14" height="74"/><rect x="132" y="88" width="16" height="62"/><rect x="148" y="104" width="12" height="46"/></g>
  <g fill="#000" fill-opacity=".2"><rect x="136" y="77" width="10" height="8" rx="2"/><path d="M135 77l6-5 6 5z"/></g><path d="M137 85l-1 3M145 85l1 3M31 76V63" stroke="#000" stroke-opacity=".22" stroke-width="1.500" fill="none"/><circle class="bl" cx="31" cy="61.500" r="1.800" fill="#FFD0DA"/>
  <g fill="#fff" fill-opacity=".3"><rect x="7" y="100" width="4" height="4"/><rect x="13" y="112" width="4" height="4"/><rect x="7" y="124" width="4" height="4"/><rect x="28" y="86" width="4" height="4"/><rect x="28" y="124" width="4" height="4"/><rect x="137" y="98" width="4" height="4"/><rect x="142" y="112" width="4" height="4"/><rect x="137" y="124" width="4" height="4"/><rect x="152" y="116" width="4" height="4"/></g>
  <g fill="#FFD9A0" fill-opacity=".85"><rect x="28" y="106" width="4" height="4"/><rect x="152" y="130" width="4" height="4"/></g>
  <path d="M12 24a8 8 0 1 1 12 7c-3 2-4 3-4 7M20 50h.01" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="4" stroke-linecap="round"/>
  <defs><clipPath id="hf"><path d="M60 52C60 45 67 42 76 42S92 45 92 52V68C92 80 85 90 76 90S60 80 60 68Z"/></clipPath><clipPath id="hk"><path d="M14 150C14 121 30 104 56 100H96C122 104 138 121 138 150Z"/></clipPath></defs>
  <path d="M14 150C14 121 30 104 56 100H96C122 104 138 121 138 150Z" fill="url(#hc)"/>
  <path d="M76 100H96C122 104 138 121 138 150H76Z" fill="#000" fill-opacity=".14"/><path d="M57 102C34 106 17 123 17 148" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="1.600" stroke-linecap="round"/>
  <g clip-path="url(#hk)"><rect x="10" y="134" width="132" height="6" fill="#fff" fill-opacity=".2"/><path d="M34 122h16v3.500H34zM102 122h16v3.500h-16z" fill="#fff" fill-opacity=".13"/><g fill="#fff" fill-opacity=".6"><circle cx="62" cy="146" r="1.800"/><circle cx="90" cy="146" r="1.800"/><circle cx="66" cy="127" r="1.800"/><circle cx="86" cy="127" r="1.800"/></g></g>
  <rect x="69.500" y="132" width="13" height="10" rx="2" fill="#fff"/><rect x="72.500" y="135" width="7" height="4" rx="1" fill="{INK}" fill-opacity=".35"/>
  <path d="M40.0 109.5L41.6 113.7L46.2 114.0L42.7 116.9L43.8 121.3L40.0 118.8L36.2 121.3L37.3 116.9L33.8 114.0L38.4 113.7z" fill="#fff"/><circle cx="40" cy="116.600" r="1.500" fill="{INK}"/>
  <path d="M69 86h14v16H69z" fill="#D9D9DF"/><path d="M67 96L76 124L85 96Z" fill="#fff"/>
  <path d="M72.500 98h7l-1 5h-5z" fill="#D8002B"/><path d="M73.200 103L71 124L76 129L81 124L78.800 103Z" fill="#D8002B"/><path d="M74.500 105L73.200 122" stroke="#fff" stroke-opacity=".3" stroke-linecap="round"/>
  <ellipse cx="60" cy="66" rx="2.600" ry="3.800" fill="#fff" stroke="{INK}" stroke-width="1.500"/><ellipse cx="92" cy="66" rx="2.600" ry="3.800" fill="#fff" stroke="{INK}" stroke-width="1.500"/>
  <path d="M60 52C60 45 67 42 76 42S92 45 92 52V68C92 80 85 90 76 90S60 80 60 68Z" fill="#fff"/><path d="M92 52V68C92 80 85 90 76 90C83 86 87 78 87 68V52Z" fill="#E4E4E9" fill-opacity=".85"/>
  <g clip-path="url(#hf)"><rect x="58" y="55" width="36" height="12" fill="{INK}" fill-opacity=".92"/><path d="M58 55H94" stroke="#fff" stroke-opacity=".15"/></g>
  <circle cx="70.500" cy="61" r="2.200" fill="#fff"/><circle cx="81.500" cy="61" r="2.200" fill="#fff"/>
  <path d="M76 66v7h-2.500M70.500 80q6 3.500 12-1.500M82.500 78.500l1.800-1.300" fill="none" stroke="{INK}" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/>
  <g fill="{INK}" fill-opacity=".2"><circle cx="69" cy="85" r=".7"/><circle cx="73" cy="87.500" r=".7"/><circle cx="77" cy="88" r=".7"/><circle cx="81" cy="87.500" r=".7"/><circle cx="84" cy="85" r=".7"/></g>
  <path d="M48 103L58 86L69 90L74 112L63 118Z" fill="#2E2E35" stroke="#fff" stroke-opacity=".4" stroke-width="1.200" stroke-linejoin="round"/><path d="M104 103L94 86L83 90L78 112L89 118Z" fill="#2E2E35" stroke="#fff" stroke-opacity=".4" stroke-width="1.200" stroke-linejoin="round"/>
  <path d="M63 121L58 134M89 121L94 134" stroke="#fff" stroke-opacity=".3" stroke-width="1.200" stroke-dasharray="2 3" stroke-linecap="round"/>
  <path d="M54 50C54 27 98 27 98 50Z" fill="{INK}"/><path d="M62 36q14-6 28 0" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="1.500" stroke-linecap="round"/><path d="M54.300 42H97.700V48H54.300Z" fill="#fff"/><text x="76" y="47" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-weight="800" font-size="6.500" fill="{INK}">?</text>
  <ellipse cx="76" cy="50" rx="35" ry="6.500" fill="{INK}"/><path d="M41 50q35 6 70 0" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.400"/><path d="M45 47q31-5 62 0" fill="none" stroke="#fff" stroke-opacity=".2" stroke-linecap="round"/>
  <path d="M126 112L116 128" stroke="#fff" stroke-opacity=".3" stroke-width="15.600" stroke-linecap="round"/><path d="M126 112L116 128" stroke="#2B2B31" stroke-width="14" stroke-linecap="round"/><path d="M111.600 122.600L122.400 129.400" stroke="#fff" stroke-opacity=".6" stroke-width="2.500" stroke-linecap="round"/>
  <path d="M112 108L113 142" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M110 138h5M110 141h5" stroke="{INK}" stroke-opacity=".5" stroke-width="1.200"/>
  <circle cx="113" cy="130" r="6" fill="#D9D9DF"/><path d="M109 127l4 5M112 126l4 5" stroke="{INK}" stroke-opacity=".4" stroke-width="1" stroke-linecap="round"/>
  <circle cx="112" cy="91" r="15" fill="#fff" fill-opacity=".22" stroke="#fff" stroke-width="4.500"/><circle cx="112" cy="91" r="12" fill="none" stroke="{INK}" stroke-opacity=".22" stroke-width=".8"/>
  <path d="M101 91q11-9 22 0q-11 9-22 0z" fill="none" stroke="#fff" stroke-width="2.200" stroke-linejoin="round"/><path d="M104 85l-1.500-2.500M112 83v-3M120 85l1.500-2.500" stroke="#fff" stroke-opacity=".55" stroke-width="1.300" stroke-linecap="round"/>
  <g class="look"><circle cx="112" cy="91" r="3.800" fill="#fff"/><circle cx="112" cy="91" r="1.700" fill="{INK}"/><circle cx="113.300" cy="89.700" r=".7" fill="#fff"/></g>
  <path d="M101 85a12 12 0 0 1 6.500-4.500" fill="none" stroke="#fff" stroke-width="2.300" stroke-linecap="round" stroke-opacity=".7"/><path d="M122 100a11 11 0 0 1-5.500 4" fill="none" stroke="#fff" stroke-width="1.800" stroke-linecap="round" stroke-opacity=".35"/><path class="tw" style="animation-delay:-1s" transform="translate(125 78) scale(1.100)" d="M0-4Q0 0 4 0Q0 0 0 4Q0 0-4 0Q0 0 0-4z" fill="#fff"/>
</svg>
