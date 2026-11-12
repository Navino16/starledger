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
.starledger-dialog-content button:hover,.starledger-periods [aria-pressed=true]{background:linear-gradient(to bottom,#6e87a0 0%,#5d7ea2 17%,#7897b1 50%,#57799c 54%,#56789e 59%,#6a89ac 82%,#89a4bd 100%)}
.starledger-dialog table{border-collapse:collapse;width:100%}
.starledger-dialog td,.starledger-dialog th{padding:3px 6px;text-align:left;border-bottom:1px solid #1f2833}
.starledger-note{color:#5a6b7a}
.starledger-periods{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 6px}
.starledger-monthnav{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 0 6px}
.starledger-month{min-width:110px;text-align:center;color:#6f9fc8;font-weight:700;text-transform:capitalize}
.starledger-dialog-content .starledger-monthnav button{min-width:28px}
.starledger-calendar{display:flex;align-items:flex-end;gap:2px;height:64px;margin:0 0 8px;overflow-x:auto}
.starledger-dialog-content .starledger-calendar button{display:flex;flex-direction:column;justify-content:flex-end;flex:1 0 14px;min-width:14px;height:100%;padding:0;background:none;border:1px solid transparent;border-radius:2px;color:#757ba6;font-size:9px;text-shadow:none}
.starledger-dialog-content .starledger-calendar button:hover{background:#1f2833}
.starledger-dialog-content .starledger-calendar button[aria-pressed=true]{background:#1f2833;border-color:#6f9fc8}
.starledger-bar{display:block;width:100%;background:#64a69b}
.is-negative .starledger-bar{background:#e2574c}
.starledger-daynum{display:block;line-height:11px}
.starledger-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:0 12px}
.starledger-donut{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.starledger-donut-wrap{position:relative;width:110px;height:110px;flex:none}
.starledger-donut-chart{display:block;width:100%;height:100%}
.starledger-donut-total{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#e7e8eb}
.starledger-legend{margin:0;padding:0;list-style:none}
.starledger-dialog .starledger-legend li{display:flex;align-items:center;gap:5px}
.starledger-swatch{display:inline-block;width:9px;height:9px;border-radius:2px}
.starledger-shipgrid{display:flex;flex-wrap:wrap;gap:4px}
.starledger-shiptile{display:flex;flex-direction:column;align-items:center;gap:1px;min-width:40px;padding:2px;background:#11161d;border-radius:3px}
.starledger-found{color:#e7e8eb}
.starledger-lost{color:#e2574c}
.starledger-tablewrap{overflow-x:auto}
.starledger-dialog .starledger-balance{min-width:520px}
.starledger-dialog .starledger-balance th:first-child,.starledger-dialog .starledger-balance td:first-child{position:sticky;left:0;background:#0d1014}
.starledger-dialog .starledger-balance td:not(:first-child),.starledger-dialog .starledger-balance th:not(:first-child){text-align:right}
.starledger-dialog .starledger-balance tr[data-category=total] td{border-top:1px solid #6f9fc8;font-weight:bold}
.starledger-dialog td.is-negative .starledger-amount{color:#e2574c}
@media (max-width:560px){.starledger-split{grid-template-columns:minmax(0,1fr)}}
`;
