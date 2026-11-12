//! AGENTS.md §1.7: the box stays in normal flow; only the player-opened dialog uses a fixed backdrop (see ui/panel.ts)
export const UI_CSS = `
.starledger-box,.starledger-dialog{box-sizing:border-box;max-width:100%;margin:8px 0;padding:4px;font:11px Verdana,Arial,sans-serif;color:#757ba6;background:#0d131b;border-radius:6px}
.starledger-box{width:168px;margin:10px 0 0}
.starledger-backdrop{position:fixed;inset:0;z-index:100000;display:flex;align-items:flex-start;justify-content:center;padding:8vh 8px 8px;box-sizing:border-box;overflow-y:auto;background:rgba(0,0,0,.72)}
.starledger-dialog{width:720px;margin:0;padding:10px;overflow-x:auto;color:#c0c0c2;border:1px solid #2a3240;box-shadow:0 6px 24px rgba(0,0,0,.8)}
.starledger-box strong,.starledger-dialog strong,.starledger-dialog h4{color:#b4c8f7;font-weight:bold}
.starledger-dialog h4{margin:10px 0 4px;padding:4px 6px;font-size:11px;background:linear-gradient(#2a3240,#191c25);border-radius:5px}
.starledger-box button,.starledger-dialog button,.starledger-dialog input{max-width:100%;box-sizing:border-box;font:inherit}
.starledger-box button:not(.starledger-tiles):not(.starledger-cta),.starledger-dialog button{padding:3px 8px;margin:2px 0;color:#b4c8f7;font-weight:bold;background:linear-gradient(#2d3645,#191c25);border:1px solid #0a0f16;border-radius:5px;cursor:pointer}
.starledger-box button:not(.starledger-tiles):not(.starledger-cta):hover,.starledger-dialog button:hover{background:linear-gradient(#3a4558,#20242f);color:#e7e8eb}
.starledger-dialog input[type=text],.starledger-dialog input[type=password]{display:block;width:100%;max-width:420px;margin-top:3px;padding:3px 4px;color:#e7e8eb;background:#0a0f16;border:1px solid #2a3240;border-radius:4px}
.starledger-dialog label{display:block;margin:8px 0;color:#c0c0c2}
.starledger-dialog ul{margin:6px 0;padding-left:18px;line-height:1.5;list-style:disc}
.starledger-dialog li{display:list-item}
.starledger-dialog p{margin:6px 0;line-height:1.4}
.starledger-dialog-head strong{font-size:12px}
.starledger-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.starledger-warning{color:#e0a030}
.starledger-head,.starledger-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px;padding:5px 7px;background:linear-gradient(#2a3240,#181c23);border-radius:5px}
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
.starledger-fuel{grid-column:1/-1;flex-direction:row;justify-content:space-between;padding:4px 7px}
.starledger-label{font-size:9px;color:#757ba6}
.starledger-fuel .starledger-label{font-size:11px}
.starledger-value{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:bold;color:#e7e8eb}
.starledger-tile[data-tile=metal] .starledger-value,.starledger-dialog .starledger-amount[data-res=metal]{color:#9899be}
.starledger-tile[data-tile=crystal] .starledger-value,.starledger-dialog .starledger-amount[data-res=crystal]{color:#95c1dd}
.starledger-tile[data-tile=deuterium] .starledger-value,.starledger-dialog .starledger-amount[data-res=deuterium]{color:#64a69b}
.starledger-tile[data-tile=darkMatter] .starledger-value{color:#b88ce8}
.starledger-tile[data-tile=artefacts] .starledger-value{color:#e3b955}
.starledger-tile[data-tile=msu] .starledger-value,.starledger-dialog .starledger-amount[data-res=msu]{color:#e7e8eb}
.starledger-cta{display:block;width:100%;padding:7px;color:#64a69b;font-weight:bold;background:linear-gradient(#2d3645,#191c25);border:0;border-radius:5px;cursor:pointer}
.starledger-cta:hover{background:linear-gradient(#3a4558,#20242f);color:#8fd4c7}
.starledger-dialog table{border-collapse:collapse;width:100%}
.starledger-dialog td,.starledger-dialog th{padding:3px 6px;text-align:left;border-bottom:1px solid #191c25}
.starledger-dialog th{color:#757ba6}
.starledger-note{color:#585a71}
.starledger-periods{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
.starledger-periods [aria-pressed=true]{background:linear-gradient(#5867b8,#3a3f8a);color:#fff}
`;
