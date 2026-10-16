import React from 'react';

export const canDeleteAdminTournament = torneo => torneo?.plan_nations == null;
export function nationsTournamentDeletionNotice(language) {
  return String(language || 'es').startsWith('en')
    ? 'This Nations Cup keeps its event record and cannot be deleted. If appropriate, use the authorized state edit to cancel it.'
    : 'Este Nations Cup conserva su expediente y no se puede eliminar. Si corresponde, utiliza la edición autorizada del estado para cancelarlo.';
}
export default function AdminTournamentDeleteAction({torneo,language,onDelete,title}) {
  const allowed=canDeleteAdminTournament(torneo);
  const notice=nationsTournamentDeletionNotice(language);
  return <>{allowed?<button disabled={!allowed} onClick={()=>{if(allowed)onDelete(torneo.id,torneo.nombre);}}
    className="admin-torneo-action admin-torneo-action--danger"
    style={{padding:'6px 10px',background:'#dc2626',color:'white',border:'none',borderRadius:'5px',cursor:allowed?'pointer':'not-allowed',fontSize:'12px'}}
    title={allowed?title:notice}>{String(language||'es').startsWith('en')?'Delete':'Eliminar'}</button>:null}
    {!allowed?<span>{notice}</span>:null}</>;
}
