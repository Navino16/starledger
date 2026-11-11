//! AGENTS.md §1.7: normal-flow blocks only, no fixed/absolute positioning, no overlay, no opacity change
export const UI_CSS = `
.starledger-box,.starledger-dialog{box-sizing:border-box;max-width:100%;margin:8px 0;padding:6px;font:11px Verdana,Arial,sans-serif;color:#848484;background:#0c1218;border:1px solid #23313f;border-radius:4px}
.starledger-dialog{padding:10px;overflow-x:auto;color:#c9c9c9}
.starledger-box strong,.starledger-dialog strong,.starledger-dialog h4{color:#6f9fc8}
.starledger-dialog h4{margin:10px 0 4px;font-size:11px}
.starledger-box button,.starledger-box input,.starledger-dialog button{max-width:100%;box-sizing:border-box;font:inherit}
.starledger-box button:not(.starledger-tiles):not(.starledger-cta),.starledger-dialog button{padding:3px 8px;margin:2px 0;color:#d6dde3;font-weight:bold;background:linear-gradient(#3a5468,#22323f);border:1px solid #000;border-radius:3px;cursor:pointer}
.starledger-box button:not(.starledger-tiles):not(.starledger-cta):hover,.starledger-dialog button:hover{background:linear-gradient(#4a6a84,#2c4152)}
.starledger-box input[type=text],.starledger-box input[type=password]{width:100%;padding:3px 4px;color:#d6dde3;background:#0f151b;border:1px solid #23313f;border-radius:3px}
.starledger-box label{display:block;margin:6px 0;color:#c9c9c9}
.starledger-box ul{margin:6px 0;padding-left:18px}
.starledger-warning{color:#e0a030}
.starledger-head{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:5px}
.starledger-head strong{font-weight:bold}
.starledger-state{display:inline-flex;align-items:center;gap:4px;color:#848484}
.starledger-dot{display:inline-block;width:7px;height:7px;border-radius:50%}
.starledger-dot.is-ok{background:#9c0}
.starledger-dot.is-pending{background:#e0a030}
.starledger-dot.is-error{background:#d9534f}
.starledger-stale{color:#e0a030;font-style:normal;margin-left:4px}
.starledger-status{margin:0}
div.starledger-status{margin:6px 0}
.starledger-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;width:100%;margin:0;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:center;cursor:pointer}
.starledger-tile{display:flex;flex-direction:column;align-items:center;min-width:0;padding:4px 2px;background:linear-gradient(#18222c,#0f161d);border:1px solid #1d2a36;border-radius:3px}
.starledger-tiles:hover .starledger-tile{border-color:#2f4458}
.starledger-fuel{grid-column:1/-1;flex-direction:row;justify-content:space-between;padding:2px 6px;background:none;border:0}
.starledger-label{font-size:8px;text-transform:uppercase;color:#5a6b7a}
.starledger-fuel .starledger-label{font-size:11px;text-transform:none;color:#848484}
.starledger-value{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:bold;color:#c9c9c9}
.starledger-tile[data-tile=metal] .starledger-value{color:#c9c9c9}
.starledger-tile[data-tile=crystal] .starledger-value{color:#79c6e8}
.starledger-tile[data-tile=deuterium] .starledger-value{color:#6fd29b}
.starledger-tile[data-tile=darkMatter] .starledger-value{color:#c48bff}
.starledger-tile[data-tile=artefacts] .starledger-value{color:#e3b955}
.starledger-tile[data-tile=msu] .starledger-value{color:#fff}
.starledger-tile[data-tile=fuel] .starledger-value{color:#c9c9c9}
.starledger-cta{display:block;width:100%;padding:6px;color:#9c0;font-weight:bold;background:none;border:1px dashed #2b3a4a;border-radius:3px;cursor:pointer}
.starledger-cta:hover{border-color:#9c0}
.starledger-dialog .starledger-amount[data-res=metal]{color:#c9c9c9}
.starledger-dialog .starledger-amount[data-res=crystal]{color:#79c6e8}
.starledger-dialog .starledger-amount[data-res=deuterium]{color:#6fd29b}
.starledger-dialog .starledger-amount[data-res=msu]{color:#fff}
.starledger-dialog table{border-collapse:collapse;width:100%}
.starledger-dialog td,.starledger-dialog th{padding:2px 6px;text-align:left;border-bottom:1px solid #1d2a36}
.starledger-dialog th{color:#6f9fc8}
.starledger-note{color:#5a6b7a}
.starledger-periods{margin:6px 0}
.starledger-periods [aria-pressed=true]{background:linear-gradient(#6f9fc8,#3a6a94);color:#fff}
@media (min-width:768px){.starledger-tile{padding:5px 4px}}
`;
