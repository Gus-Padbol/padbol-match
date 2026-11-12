// Presentation only: scoring decisions and phase selection belong to the server.
export function hasGroupsSuperTiebreakPolicy(board) {
 const p=board?.scoring_policy;
 return p?.id==='napoli_groups_super_tiebreak_10_v1' && p.phase==='groups' && p.best_of===3 && p.deciding_set==='super_tiebreak' && p.target===10 && p.win_by===1;
}
export function isActiveSuperTiebreak(board) {
 return hasGroupsSuperTiebreakPolicy(board) && board?.display?.mode==='super_tiebreak';
}
export function superTiebreakSetPoints(entry) {
 if(entry?.set!==3 || entry.type!=='super_tiebreak' || entry.target!==10 || entry.win_by!==1) return null;
 const a=entry.points_a,b=entry.points_b;
 if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0||Math.max(a,b)!==10||Math.min(a,b)>=10) return null;
 if(entry.a!==(a>b?1:0)||entry.b!==(b>a?1:0))return null;
 return {a,b};
}
export function visualSetScore(entry) {
 return superTiebreakSetPoints(entry) || {a:entry?.a,b:entry?.b};
}
export const SUPER_TIEBREAK_LABEL='Super tie-break · First to 10';
