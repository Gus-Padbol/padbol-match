export const metaLevelLabels={campaign:'Campañas',adset:'Conjuntos de anuncios',ad:'Anuncios'};
export const UK_CAMPAIGN_ID='120244279664900660';
export const UK_ADSET_ID='120244279664960660';
export function formatMetaNumber(value,options={}){
 if(value===null||value===undefined||value==='')return 'No informado';
 const numeric=Number(value);
 if(!Number.isFinite(numeric))return 'No informado';
 return new Intl.NumberFormat('es',options).format(numeric);
}
export function formatMetaMoney(value,currency){
 if(!currency)return value===null||value===undefined||value===''?'No informado':`${formatMetaNumber(value,{maximumFractionDigits:2})} (moneda no indicada)`;
 try{return formatMetaNumber(value,{style:'currency',currency,maximumFractionDigits:2});}catch{return formatMetaNumber(value,{maximumFractionDigits:2});}
}
export function formatMetaDate(value){
 if(!value)return 'No informado';
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'No informado':date.toLocaleString('es');
}
