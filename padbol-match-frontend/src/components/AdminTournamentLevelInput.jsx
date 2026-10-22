import React from 'react';
export default function AdminTournamentLevelInput({torneo,value,onChange,language,...props}) {
 const frozen=torneo?.plan_nations!=null;
 return <><input {...props} value={value} disabled={frozen} onChange={event=>{if(!frozen)onChange(event.target.value);}}/>
 {frozen?<p>{String(language||'es').startsWith('en')?'Choose the level before configuring Nations Cup. It is retained with the event points policy.':'El nivel se elige antes de configurar Nations Cup y se conserva con su política de puntos.'}</p>:null}</>;
}
