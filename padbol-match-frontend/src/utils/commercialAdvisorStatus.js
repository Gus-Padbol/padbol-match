export const ADVISOR_REQUEST_STATUS={pending:'Pendiente de habilitación',pending_verification:'Pendiente de verificación de cuenta',approved:'Habilitado',rejected:'Rechazado'};
export function advisorOperationNotice(result,decision){
 const status=result?.status||result?.request?.status;
 if(decision==='rejected')return 'Solicitud rechazada. No se habilitó el acceso.';
 if(status==='approved')return 'Asesor habilitado. Ya puede acceder con su cuenta.';
 if(status==='pending_verification')return 'El acceso queda pendiente de verificación. El asesor debe crear su cuenta y confirmar el correo.';
 if(status==='pending')return 'Solicitud registrada. El acceso queda pendiente de habilitación por Administración central.';
 return 'Operación registrada. Revisá el estado actualizado del acceso.';
}
