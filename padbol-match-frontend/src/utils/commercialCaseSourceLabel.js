const labels=new Set(['Correo electrónico','Formulario web','WhatsApp','Consulta comercial']);
// channel=form is an internal compatibility bucket, not proof of a web form.
export function commercialCaseSourceLabel(item={}) {
 return labels.has(item.sourceLabel)?item.sourceLabel:item.channel==='whatsapp'?'WhatsApp':'Consulta comercial';
}
