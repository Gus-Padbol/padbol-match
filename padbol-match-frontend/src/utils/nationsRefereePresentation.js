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
  title:isDemo?'Nations Cup · Demo':snapshot?.board?.torneo_nombre,
  venue:isDemo?'Naples · Court 1':null,
  teamName:side=>isDemo?(side==='A'?'Italy':'Spain'):snapshot?.board?.[`equipo_${side.toLowerCase()}_nombre`],
  playerName:player=>isDemo?(DEMO_NAMES[player?.name]||player?.name):player?.name,
 };
}
