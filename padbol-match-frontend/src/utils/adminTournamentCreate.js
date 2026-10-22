import {getAuthHeaders} from './scoreboardApi';
const oneRow=value=>Array.isArray(value)&&value.length===1?value[0]:value;
const validId=id=>Number.isSafeInteger(Number(id))&&Number(id)>0;
export async function createConfirmedAdminTournament({apiBaseUrl},payload,receiptRef={current:null}) {
 const headers=await getAuthHeaders();
 if(!headers.Authorization)throw new Error('La sesión no está disponible. Ingresa nuevamente antes de crear el torneo.');
 const body={...payload,estado:'planificacion'};delete body.created_by;
 const fingerprint=JSON.stringify(body),base=String(apiBaseUrl).replace(/\/+$/,'');
 if(receiptRef.current&&receiptRef.current.fingerprint!==fingerprint)throw new Error('Hay un alta pendiente de comprobación. Revisa el torneo anterior antes de crear otro.');
 if(receiptRef.current?.uncertain)throw new Error('El resultado del alta es incierto. Consulta la lista de torneos antes de repetir; no se envió otra creación.');
 if(!receiptRef.current){
  receiptRef.current={fingerprint,uncertain:true};
  let response;
  try{response=await fetch(`${base}/api/torneos`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});}catch(err){throw new Error('No se pudo confirmar el alta. Puede haber quedado creada; consulta los torneos antes de repetir.');}
  const result=await response.json().catch(()=>null);
  if(!response.ok){if(response.status<500)receiptRef.current=null;throw new Error(result?.error||'El servidor no confirmó la creación del torneo.');}
  const saved=oneRow(result);
  if(!validId(saved?.id))throw new Error('El alta no devolvió un identificador verificable. Consulta los torneos antes de repetir.');
  receiptRef.current={fingerprint,id:saved.id};
 }
 const id=receiptRef.current.id;
 let response;
 try{response=await fetch(`${base}/api/torneos/${id}`,{headers});}catch(err){throw new Error(`El torneo puede haber quedado creado (${id}), pero no se confirmó su lectura. Reintentar comprueba este mismo torneo sin crear otro.`);}
 const row=oneRow(await response.json().catch(()=>null));
 const matches=String(row?.id)===String(id)&&['nombre','deporte','nivel_torneo','tipo_torneo'].every(key=>body[key]==null||String(row?.[key]||'').trim()===String(body[key]).trim())
  && (body.sede_id==null?row?.sede_id==null:String(row?.sede_id)===String(body.sede_id))
  && ['fecha_inicio','fecha_fin'].every(key=>body[key]==null||String(row?.[key]||'').slice(0,10)===String(body[key]).slice(0,10))
  && (body.estado==null||String(row?.estado)===String(body.estado))
  && (body.modalidad_plantel!=='selecciones'||row?.modalidad_plantel==='selecciones');
 if(!response.ok||!matches)throw new Error(`El torneo puede haber quedado creado (${id}), pero no se confirmó su lectura. Reintentar comprueba este mismo torneo sin crear otro.`);
 receiptRef.current=null;return row;
}
