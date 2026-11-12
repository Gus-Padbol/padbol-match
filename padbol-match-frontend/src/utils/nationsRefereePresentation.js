// Presentation only for the isolated demonstration. IDs and command payloads stay untouched.
const DEMO_BOARD = '60ccb50a-7556-4920-9fd9-dd7ccb6244e9';
const DEMO_NAMES = Object.freeze({
 'QA AE 01':'Marco Rossi','QA AE 02':'Luca Bianchi',
 'QA AE 03':'Paolo Conti','QA AE 04':'Andrea Ricci',
 'QA AT 01':'Carlos Martín','QA AT 02':'Javier López',
 'QA AT 03':'Pablo García','QA AT 04':'Diego Ruiz',
});
export function nationsRefereePresentation(snapshot,{variant=process.env.REACT_APP_APP_VARIANT}={}) {
 const isDemo=variant==='qa'&&snapshot?.mode==='nations'&&snapshot?.board?.id===DEMO_BOARD;
 return {
  isDemo,
  title:isDemo?'V Padbol Nations Cup · Naples 2026':snapshot?.board?.torneo_nombre,
  venue:isDemo?'Court 1 · Demo':null,
  teamName:side=>isDemo?(side==='A'?'Italy':'Spain'):snapshot?.board?.[`equipo_${side.toLowerCase()}_nombre`],
  playerName:player=>isDemo?(DEMO_NAMES[player?.name??player?.nombre]||player?.name||player?.nombre):player?.name,
 };
}


/** The public demo uses the same names as the referee; roles always remain server-owned. */
export function nationsDemoPublicBoard(board, options) {
 const isNations=['current','unavailable'].includes(board?.nations_lineup_status);
 const presentation=nationsRefereePresentation({mode:isNations?'nations':'legacy',board},options);
 if(!presentation.isDemo)return board;
 const next={...board,torneo_nombre:presentation.title,equipo_a_nombre:presentation.teamName('A'),equipo_b_nombre:presentation.teamName('B'),sede_nombre:'Naples 2026 · Demo',cancha_nombre:'Court 1'};
 for(const side of ['a','b'])next[`equipo_${side}_jugadores`]=(board[`equipo_${side}_jugadores`]||[]).map(player=>{
  const raw=player.nombre??player.name;
  return {...player,nombre:presentation.playerName({name:raw}),name:presentation.playerName({name:raw}),demoPortraitIndex:Object.keys(DEMO_NAMES).indexOf(raw)};
 });
 return next;
}
