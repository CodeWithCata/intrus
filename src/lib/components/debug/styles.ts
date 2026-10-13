/**
 * CSS of the debugger UI. It lives in the lazy debug chunk (injected by initDebug), not in styles/,
 * so players never download it. Every class starts with "dbg" so nothing here can match app markup.
 */
export const DEBUG_CSS = `
.dbgroot,.dbgroot *{box-sizing:border-box}
.dbgroot{--ink:#111114;--mut:#5C5C66;--line:#E4E4E9;--red:#D8002B;--ok:#16863f;--warn:#b86e00;--bad:#d8002b;font:13px/1.35 system-ui,-apple-system,sans-serif;color:var(--ink)}
.dbgf{position:fixed;left:6px;top:50%;z-index:200;min-width:46px;height:46px;margin-top:-23px;padding:0 8px;border-radius:23px;border:2px solid #3a3a42;background:rgba(17,17,20,.92);color:#fff;font:700 11px/1 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
.dbgf b{font-size:15px;font-variant-numeric:tabular-nums}
.dbgf.ok{border-color:#2fbf5f}.dbgf.warn{border-color:#f0a400}.dbgf.bad{border-color:#ff3b5c}
.dbgf.hit{background:#7a0018}
.dbgf.rec{border-color:#ff3b5c;box-shadow:0 0 0 3px rgba(255,59,92,.35)}
.dbgpre{margin:6px 0 0;max-height:240px;overflow:auto;font:11px/1.35 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#F4F4F6;border-radius:8px;padding:6px}
.dbgp{position:fixed;left:0;right:0;bottom:0;z-index:201;max-height:min(80dvh,680px);width:100%;max-width:600px;margin:0 auto;display:flex;flex-direction:column;background:#fff;border-radius:16px 16px 0 0;border-top:3px solid var(--red);padding-bottom:env(safe-area-inset-bottom,0px)}
.dbgp[hidden],.dbgf[hidden],.dbgrun[hidden],.dbgq[hidden]{display:none}
.dbgquiet .dbgp,.dbgquiet .dbgf{display:none}
.dbgh,.dbgtabs,.dbgfoot,.dbgnote,.dbgq{flex:none}
.dbgh{display:flex;align-items:center;gap:8px;padding:10px 12px 4px}
.dbgh h3{margin:0;font:800 15px/1.2 system-ui,sans-serif;flex:1}
.dbgh small{color:var(--mut);font-weight:600}
.dbgtabs{display:flex;gap:4px;padding:4px 10px;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid var(--line)}
.dbgtabs::-webkit-scrollbar{display:none}
.dbgtab{flex:none;min-height:40px;padding:0 12px;border:0;border-radius:10px;background:transparent;color:var(--mut);font:700 13px/1 system-ui,sans-serif;touch-action:manipulation}
.dbgtab[aria-selected=true]{background:var(--ink);color:#fff}
.dbgb{min-height:44px;padding:0 14px;border:0;border-radius:11px;background:var(--ink);color:#fff;font:700 13px/1.1 system-ui,sans-serif;touch-action:manipulation}
.dbgb.alt{background:#E9E9EF;color:var(--ink)}
.dbgb.red{background:var(--red)}
.dbgb.sm{min-height:36px;padding:0 10px;font-size:12px}
.dbgb:disabled{opacity:.4}
.dbgb[aria-pressed=true]{background:var(--red);color:#fff}
.dbgbody{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:8px 12px 12px}
.dbgp .dbgnote{margin:0 12px;color:var(--mut);min-height:0}
.dbgnote:not(:empty){padding:6px 0 0}
.dbgq{background:#FFF3C4;border-radius:10px;padding:8px 10px;margin:8px 12px 0;font-weight:700}
.dbgq p{margin:0 0 6px}
.dbgrow{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.dbgrow>.dbgb{flex:1 1 auto}
.dbgfoot{display:flex;gap:6px;padding:8px 12px;border-top:1px solid var(--line)}
.dbgfoot .dbgb{flex:1;padding:0 6px}
.dbgg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0}
.dbgs{border:1px solid var(--line);border-radius:10px;padding:6px 8px;min-width:0}
.dbgs b{display:block;font:800 16px/1.2 system-ui,sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap}
.dbgs small{display:block;color:var(--mut);font-size:11px}
.dbgs.ok b{color:var(--ok)}.dbgs.warn b{color:var(--warn)}.dbgs.bad b{color:var(--bad)}
.dbgcv{display:block;width:100%;height:64px;border:1px solid var(--line);border-radius:10px;background:#FAFAFC}
.dbgh4{margin:12px 0 4px;font:800 12px/1.2 system-ui,sans-serif;text-transform:uppercase;letter-spacing:.04em;color:var(--mut)}
.dbgfind{border-left:4px solid var(--line);padding:6px 8px;margin:6px 0;background:#FAFAFC;border-radius:0 8px 8px 0}
.dbgfind.ok{border-color:var(--ok)}.dbgfind.warn{border-color:#f0a400}.dbgfind.bad{border-color:var(--bad)}.dbgfind.info{border-color:#6a7bd8}
.dbgfind b{display:block}
.dbgfind span{color:var(--mut);display:block;margin-top:2px;overflow-wrap:anywhere}
.dbgr{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line);min-height:48px}
.dbgr input{width:24px;height:24px;margin:0;flex:none;accent-color:var(--red)}
.dbgr>span{flex:1;min-width:0;overflow-wrap:anywhere}
.dbgr small{display:block;color:var(--mut)}
.dbgbar{height:6px;border-radius:3px;background:var(--red);margin-top:4px;min-width:2px}
.dbgbar.neg{background:#999}
.dbgtag{display:inline-block;padding:1px 6px;border-radius:6px;font-size:11px;font-weight:800;background:#E9E9EF;color:var(--ink);margin-right:4px}
.dbgtag.layout,.dbgtag.bad{background:var(--bad);color:#fff}.dbgtag.paint,.dbgtag.warn{background:#f0a400;color:#111}.dbgtag.gpu{background:#6a7bd8;color:#fff}.dbgtag.cheap,.dbgtag.ok{background:#2fbf5f;color:#fff}
.dbgev{padding:6px 0;border-top:1px solid var(--line);overflow-wrap:anywhere}
.dbgev small{color:var(--mut);display:block}
.dbgt{width:100%;border-collapse:collapse;font-size:12px}
.dbgt td,.dbgt th{padding:4px 4px;border-top:1px solid var(--line);text-align:right;white-space:nowrap}
.dbgt td:first-child,.dbgt th:first-child{text-align:left;white-space:normal;overflow-wrap:anywhere}
.dbgt th{color:var(--mut);font-weight:700}
.dbgp textarea{width:100%;height:140px;font:11px/1.3 ui-monospace,monospace;border:1px solid var(--line);border-radius:8px;padding:6px}
.dbgp p{margin:4px 0}
.dbgp .dbgmut{color:var(--mut)}
.dbgrun{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 8px);transform:translateX(-50%);z-index:202;max-width:92vw;padding:10px 16px;border:0;border-radius:22px;background:rgba(17,17,20,.92);color:#fff;font:700 12px/1.2 system-ui,sans-serif;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;
