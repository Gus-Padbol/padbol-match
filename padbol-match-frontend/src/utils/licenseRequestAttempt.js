/** A per-form attempt token, not an authentication credential. */
export function createLicenseRequestAttemptId(){
 if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')return crypto.randomUUID();
 if(typeof crypto!=='undefined'&&typeof crypto.getRandomValues==='function')return 'license-'+Array.from(crypto.getRandomValues(new Uint8Array(16)),value=>value.toString(16).padStart(2,'0')).join('');
 // Older browsers still submit: this nonce only distinguishes attempts, never authorizes access.
 return `license-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
const feedback={
 en:{unavailable:'Registration is temporarily unavailable. Your details remain in the form. Please try again in a few minutes.',invalid:'Please check the required details and the format of your email address.',limited:'Please wait a few minutes before sending the request again.'},
 es:{unavailable:'El registro no está disponible temporalmente. Tus datos siguen en el formulario. Inténtalo de nuevo en unos minutos.',invalid:'Revisa los datos obligatorios y el formato del correo electrónico.',limited:'Espera unos minutos antes de volver a enviar la solicitud.'},
 sv:{unavailable:'Registreringen är tillfälligt otillgänglig. Dina uppgifter finns kvar i formuläret. Försök igen om några minuter.',invalid:'Kontrollera de obligatoriska uppgifterna och e-postadressens format.',limited:'Vänta några minuter innan du skickar förfrågan igen.'},
 ro:{unavailable:'Înregistrarea este temporar indisponibilă. Datele tale rămân în formular. Încearcă din nou peste câteva minute.',invalid:'Verifică datele obligatorii și formatul adresei de e-mail.',limited:'Așteaptă câteva minute înainte de a trimite din nou cererea.'},
 cs:{unavailable:'Registrace je dočasně nedostupná. Vaše údaje zůstávají ve formuláři. Zkuste to znovu za několik minut.',invalid:'Zkontrolujte povinné údaje a formát e-mailové adresy.',limited:'Před dalším odesláním žádosti několik minut počkejte.'},
};
export function licenseRequestFailureCopy(language,error,fallback){
 const copy=feedback[String(language||'').toLowerCase().split('-')[0]];
 if(!copy)return fallback;
 if(error?.status===503)return copy.unavailable;
 if(error?.status===400)return copy.invalid;
 if(error?.status===429)return copy.limited;
 return fallback;
}
