//! AGENTS.md §1.7: normal-flow blocks only, no fixed/absolute positioning, no overlay, no opacity change
export const UI_CSS = `
.starledger-box{margin:8px 0;padding:6px;box-sizing:border-box;max-width:100%;font-size:12px;color:#ccc;background:#111}
.starledger-box button,.starledger-box input{max-width:100%;box-sizing:border-box}
.starledger-box label{display:block;margin:6px 0}
.starledger-box input[type=text],.starledger-box input[type=password]{width:100%}
.starledger-box ul{margin:6px 0;padding-left:18px}
.starledger-status{margin:6px 0}

.starledger-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;width:100%;margin:4px 0;padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.starledger-tile{display:flex;flex-direction:column;min-width:0;padding:2px 4px;background:#1c1c1c}
.starledger-fuel{grid-column:1/-1}
.starledger-label{font-size:10px;color:#888}
.starledger-value{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.starledger-stale{color:#c90}
.starledger-dialog{box-sizing:border-box;max-width:100%;margin:8px 0;padding:10px;overflow-x:auto;font-size:12px;color:#ccc;background:#111}
.starledger-dialog table{border-collapse:collapse;width:100%}
.starledger-dialog td,.starledger-dialog th{padding:2px 6px;text-align:left;border-bottom:1px solid #222}
.starledger-periods{margin:6px 0}
.starledger-periods [aria-pressed=true]{font-weight:bold}
@media (min-width:768px){.starledger-tile{padding:3px 6px}}
`;
