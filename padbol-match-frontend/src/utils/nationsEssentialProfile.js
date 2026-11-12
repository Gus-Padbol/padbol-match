import {countryFlagFromIso} from './countryRankingDisplay';
export const NATIONS_NAPOLI_SLUG='nations-cup-napoli-2026';
export const NATIONS_RETURN_PATH=`/nations-cup/${NATIONS_NAPOLI_SLUG}/inscripcion`;
export const NATIONS_PROFILE_PATH=`/mi-perfil?purpose=nations&redirect=${encodeURIComponent(NATIONS_RETURN_PATH)}`;
export function isNationsEssentialPurpose(params) {
 return params.get('redirect')===NATIONS_RETURN_PATH && (!params.get('purpose')||params.get('purpose')==='nations');
}
export const nationsSelectionKey=`nationsSelector:${NATIONS_NAPOLI_SLUG}`;
export const nationsRequestKey=actor=>`nationsProfileRequest:${actor}:${NATIONS_NAPOLI_SLUG}`;
const requestMemory=new Map();
let selectionMemory=null;
const sessionStore=storage=>{if(storage!==undefined)return storage;try{return typeof sessionStorage==='undefined'?null:sessionStorage;}catch{return null;}};
export function storedNationsSelection(storage) {
 try {const row=JSON.parse(sessionStore(storage)?.getItem(nationsSelectionKey)||'null');return typeof row?.selectionId==='string'?row.selectionId:selectionMemory;}catch{return selectionMemory;}
}
export function storeNationsSelection(row,storage) {
 selectionMemory=row?.selectionId||null;
 try {if(row)sessionStore(storage)?.setItem(nationsSelectionKey,JSON.stringify({selectionId:row.selectionId,name:row.name,country:row.country}));else sessionStore(storage)?.removeItem(nationsSelectionKey);}catch{}
}
export function nationsRequestId(actor,{rejectedRequestId,storage}={}) {
 const key=nationsRequestKey(actor);let persisted=null;
 try {persisted=sessionStore(storage)?.getItem(key);}catch{}
 let value=persisted||requestMemory.get(key);
 if(rejectedRequestId&&value===rejectedRequestId)value=null;
 if(!value){try{value=crypto.randomUUID();}catch{value=`req-${Date.now()}-${Math.random().toString(36).slice(2)}`;}}
 requestMemory.set(key,value);
 try {sessionStore(storage)?.setItem(key,value);}catch{}
 return value;
}
export function nationsCountryOptions(codes,language='en') {
 let names;try{names=new Intl.DisplayNames([language],{type:'region'});}catch{}
 return [...new Set(codes.filter(code=>typeof code==='string'&&/^[A-Z]{2}$/.test(code)))].map(code=>({code,name:names?.of(code)||code,flag:countryFlagFromIso(code)})).sort((a,b)=>a.name.localeCompare(b.name,language));
}
export function nationsProfileDraft(profile={},selected) {
 const parts=String(selected?.name||'').trim().split(/\s+/).filter(Boolean);
 const ownName=String(profile.nombre||'').trim()&&String(profile.apellido||'').trim();
 return {nombre:ownName?profile.nombre:parts[0]||profile.nombre||'',apellido:ownName?profile.apellido:parts.slice(1).join(' ')||profile.apellido||'',pais:selected?.country||profile.pais||'',genero:['masculino','femenino'].includes(profile.genero)?profile.genero:'',telefono:profile.telefono||profile.whatsapp||''};
}
export const activeNationsRequest=request=>['pendiente','en_revision','aprobada'].includes(request?.status);
