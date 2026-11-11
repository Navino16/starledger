// AGENTS.md §1.7: normal-flow blocks only, no fixed/absolute positioning, no overlap with monetization entries
export const UI_CSS = `
.starledger-box{margin:8px 0;padding:6px;box-sizing:border-box;max-width:100%;font-size:12px;color:#ccc;background:#111}
.starledger-box button,.starledger-box input{max-width:100%;box-sizing:border-box}
.starledger-box label{display:block;margin:6px 0}
.starledger-box input[type=text],.starledger-box input[type=password]{width:100%}
.starledger-box ul{margin:6px 0;padding-left:18px}
.starledger-status{margin:6px 0}
`;
