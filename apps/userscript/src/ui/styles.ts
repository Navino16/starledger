//! AGENTS.md §1.7: the box stays in normal flow; only the player-opened dialog uses a fixed backdrop (see ui/panel.ts)
// Dialog values copied from the game's own jQuery UI dialog, overlay and .btn_blue rules
export const UI_CSS = `
.starledger-box{box-sizing:border-box;width:168px;max-width:100%;margin:10px 0 0;padding:4px;font:11px Verdana,Arial,sans-serif;color:#757ba6;background:#0d131b;border-radius:6px}
.starledger-box strong{color:#b4c8f7;font-weight:bold}
.starledger-box button{max-width:100%;box-sizing:border-box;font:inherit}
.starledger-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:2px 6px;margin-bottom:4px;padding:5px 7px;background:linear-gradient(#2a3240,#181c23);border-radius:5px}
.starledger-state{display:inline-flex;align-items:center;gap:4px;font-size:10px;white-space:nowrap;color:#757ba6}
.starledger-dot{display:inline-block;width:7px;height:7px;border-radius:50%}
.starledger-dot.is-ok{background:#64a69b}
.starledger-dot.is-pending{background:#e0a030}
.starledger-dot.is-error{background:#e2574c}
.starledger-stale{color:#e0a030;font-style:normal;margin-left:4px}
.starledger-status{margin:0}
div.starledger-status{margin:6px 0}
.starledger-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;width:100%;margin:0;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:center;cursor:pointer}
.starledger-tile{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;padding:5px 2px;background:linear-gradient(#2d3645,#191c25);border-radius:5px}
.starledger-tiles:hover .starledger-tile{background:linear-gradient(#3a4558,#20242f)}
.starledger-wide{grid-column:1/-1;flex-direction:row;justify-content:space-between;padding:4px 7px}
.starledger-label{font-size:9px;color:#757ba6}
.starledger-wide .starledger-label{font-size:11px}
.starledger-value{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:bold;color:#e7e8eb}
.starledger-tile[data-tile=metal] .starledger-value,.starledger-dialog .starledger-amount[data-res=metal]{color:#9899be}
.starledger-tile[data-tile=crystal] .starledger-value,.starledger-dialog .starledger-amount[data-res=crystal]{color:#95c1dd}
.starledger-tile[data-tile=deuterium] .starledger-value,.starledger-dialog .starledger-amount[data-res=deuterium]{color:#64a69b}
.starledger-tile[data-tile=darkMatter] .starledger-value{color:#b88ce8}
.starledger-tile[data-tile=artefacts] .starledger-value{color:#e3b955}
.starledger-tile[data-tile=msu] .starledger-value,.starledger-dialog .starledger-amount[data-res=msu]{color:#e7e8eb}
.starledger-cta{display:block;width:100%;padding:7px;color:#64a69b;font-weight:bold;background:linear-gradient(#2d3645,#191c25);border:0;border-radius:5px;cursor:pointer}
.starledger-cta:hover{background:linear-gradient(#3a4558,#20242f);color:#8fd4c7}
.starledger-warning{color:#e0a030}
.starledger-backdrop{position:fixed;inset:0;z-index:100000;display:flex;align-items:flex-start;justify-content:center;padding:8vh 8px 8px;box-sizing:border-box;overflow-y:auto;background:rgba(20,26,30,.8)}
.starledger-dialog{box-sizing:border-box;width:720px;max-width:100%;font:11px/14px Verdana,Arial,Helvetica,sans-serif;color:#848484;box-shadow:5px 8px 15px #000}
.starledger-dialog-head{position:relative;padding:.4em 2.5em .4em 1em;background:linear-gradient(to bottom,#3d4b5b 0%,#2b343f 49%,#1f262d 50%,#1f2934 100%);border:1px solid #111a22;color:#6f9fc8;font-weight:700}
.starledger-close{position:absolute;right:.3em;top:50%;width:19px;height:18px;margin:-10px 0 0;padding:1px;min-width:0;background:transparent;border:0;cursor:pointer}
.starledger-close:hover .ui-icon-closethick{background-position:-208px -18px}
.starledger-dialog-content{padding:10px;overflow-x:auto;background:#0d1014;border:1px solid #1f2833;border-top:0}
.starledger-dialog strong,.starledger-dialog label,.starledger-dialog th{color:#6f9fc8;font-weight:700}
.starledger-dialog h4{margin:12px 0 4px;padding:3px 6px;font-size:11px;color:#6f9fc8;background:linear-gradient(to bottom,#2b343f,#1f262d);border:1px solid #111a22}
.starledger-dialog label{display:block;margin:10px 0}
.starledger-dialog label input[type=checkbox]{vertical-align:middle;margin:0 4px 0 0}
.starledger-dialog input[type=text],.starledger-dialog input[type=password]{display:block;box-sizing:border-box;width:100%;max-width:420px;height:26px;margin-top:4px;font-weight:normal}
.starledger-dialog ul{margin:6px 0;padding-left:18px;list-style:disc}
.starledger-dialog li{display:list-item;margin:2px 0}
.starledger-dialog p{margin:6px 0}
.starledger-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.starledger-dialog-content button{min-width:70px;margin:0;padding:5px 10px;font:700 11px/16px Verdana,Arial,Helvetica,sans-serif;color:#fff;text-align:center;text-shadow:0 1px 2px #2d4052;cursor:pointer;background:linear-gradient(to bottom,#526e86 0%,#577596 17%,#627f9b 51%,#445b75 53%,#3d5e7e 85%,#607994 100%);border:1px solid #354a5d;border-color:#7088a3 #577696 #546a7e #6282a2;border-radius:3px}
.starledger-dialog-content button:hover{background:linear-gradient(to bottom,#6e87a0 0%,#5d7ea2 17%,#7897b1 50%,#57799c 54%,#56789e 59%,#6a89ac 82%,#89a4bd 100%)}
.starledger-dialog table{border-collapse:collapse;width:100%}
.starledger-dialog td,.starledger-dialog th{padding:3px 6px;text-align:left;border-bottom:1px solid #1f2833}
#starledger-details{width:880px}
#starledger-details .starledger-dialog-content{padding:12px;color:#c9cdd6;font-size:12px;font-variant-numeric:tabular-nums}
.starledger-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.starledger-periods,.starledger-monthnav{display:flex;align-items:center;gap:4px}
.starledger-month{min-width:112px;text-align:center;color:#e7e8eb;text-transform:capitalize}
#starledger-details .starledger-toolbar button{min-width:0;height:28px;padding:0 8px;font:11px/26px Verdana,Arial,Helvetica,sans-serif;color:#c9cdd6;text-shadow:none;background:#1b212b;border:1px solid #2a3240;border-radius:4px;transition:background-color .15s,border-color .15s}
#starledger-details .starledger-toolbar button:hover{background:#252d3a}
#starledger-details .starledger-toolbar button[aria-pressed=true]{background:#252d3a;border-color:#e3b955;color:#fff}
.starledger-calendar{display:grid;grid-auto-columns:minmax(0,1fr);gap:2px;margin:12px 0 0;padding:8px;overflow-x:auto;background:#161b23;border-radius:8px;touch-action:pan-y;user-select:none;-webkit-user-select:none}
#starledger-details .starledger-calendar button{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;padding:0;font:8px/12px Verdana,Arial,Helvetica,sans-serif;color:#858b98;text-shadow:none;background:none;border:0;border-radius:0}
.starledger-slot{position:relative;display:block;width:100%;height:40px;overflow:hidden;background:#232a35;border-radius:2px;transition:background-color .15s}
#starledger-details .starledger-calendar button:hover .starledger-slot{background:#2c3442}
.starledger-bar{position:absolute;left:0;right:0;bottom:0;background:#4f8f7a}
.is-negative .starledger-bar{background:#8a3b37}
.starledger-period{align-self:start;height:40px;outline:2px solid #e3b955;outline-offset:2px;border-radius:2px;pointer-events:none}
#starledger-details .starledger-calendar button[aria-pressed=true] .starledger-daynum{color:#fff}
.starledger-daynum{display:block}
.starledger-dateline{margin:16px 0 12px}
#starledger-details .starledger-dateline strong{font-size:13px;font-weight:normal;color:#e7e8eb}
.starledger-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
.starledger-card{padding:12px;background:#161b23;border-radius:8px}
.starledger-donut{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:16px 24px;height:100%}
.starledger-donut-wrap{position:relative;width:152px;height:152px;flex:none}
.starledger-donut-chart{display:block;width:100%;height:100%}
.starledger-donut-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
.starledger-donut-total{font-size:20px;line-height:24px;font-weight:600;color:#fff}
.starledger-donut-center small{font-size:11px;color:#858b98}
#starledger-details .starledger-legend{flex:0 1 200px;min-width:0;margin:0;padding:0;list-style:none}
#starledger-details .starledger-legend li{display:grid;grid-template-columns:8px minmax(0,1fr) auto 44px;align-items:center;gap:8px;margin:0;padding:2px 0}
.starledger-swatch{display:block;width:8px;height:8px;border-radius:2px}
.starledger-legend-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.starledger-legend b{font-weight:normal;color:#e7e8eb;text-align:right}
.starledger-legend small{font-size:11px;color:#858b98;text-align:right}
.starledger-shipgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;align-content:start}
.starledger-shiptile{display:flex;align-items:center;gap:8px;min-width:0;padding:4px 8px 4px 4px;background:#161b23;border-radius:6px}
.starledger-icon{display:inline-block;flex:none;vertical-align:middle;background-repeat:no-repeat;border-radius:2px}
/* The game's own icon-blue filter on its grey lithium image */
.starledger-icon.is-lithium{filter:invert(66%) sepia(63%) saturate(277%) hue-rotate(169deg) brightness(120%) contrast(94%)}
.starledger-shipcounts{display:flex;flex-direction:column;align-items:flex-end;min-width:0;margin-left:auto;line-height:16px}
.starledger-found{color:#e7e8eb}
.starledger-shiptile.is-idle .starledger-found{color:#5b6270}
.starledger-lost{font-size:11px;line-height:12px;color:#e2574c}
.starledger-balancewrap{margin-top:16px}
.starledger-tablewrap{overflow-x:auto;padding:4px 0;background:#161b23;border-radius:8px}
#starledger-details .starledger-balance{min-width:620px;border-collapse:collapse}
#starledger-details .starledger-balance th{height:32px;padding:0 12px;font-size:11px;font-weight:normal;color:#858b98;text-align:right;vertical-align:middle;border:0}
#starledger-details .starledger-balance td{height:32px;padding:0 12px;text-align:right;white-space:nowrap;background:none;border:0;border-top:1px solid rgba(231,232,235,.06)}
#starledger-details .starledger-balance th:first-child,#starledger-details .starledger-balance td:first-child{position:sticky;left:0;text-align:left;background:#161b23}
#starledger-details .starledger-balance td:first-child{color:#c9cdd6}
#starledger-details .starledger-balance tr[data-category=total] td{font-weight:600;color:#e7e8eb;background:#1b212b;border-top:1px solid rgba(231,232,235,.16)}
#starledger-details .starledger-balance td[data-col=count]{color:#c9cdd6}
.starledger-amount[data-res=darkMatter]{color:#b88ce8}
.starledger-amount[data-res=artefacts]{color:#e3b955}
.starledger-amount[data-res=lithium]{color:#e58fb1}
#starledger-details td.is-negative .starledger-amount{color:#e2574c}
#starledger-details .starledger-balance td.is-empty,#starledger-details .starledger-balance td.is-zero,#starledger-details .starledger-balance td.is-zero .starledger-amount{color:#5b6270}
.starledger-unit{margin-left:1px;font-size:10px;opacity:.8}
.starledger-legend:empty{display:none}
@media (max-width:560px){.starledger-split{grid-template-columns:minmax(0,1fr)}#starledger-details .starledger-calendar button:not([aria-pressed=true]):not(:nth-child(5n)) .starledger-daynum{visibility:hidden}#starledger-details .starledger-balance td:first-child{min-width:80px;max-width:110px;white-space:normal}}
`;
