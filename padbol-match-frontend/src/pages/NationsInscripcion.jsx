import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Link, useLocation, useParams} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useSafeTranslation} from '../i18n/tSafe';
import {PAISES_TELEFONO_PRINCIPALES} from '../constants/paisesTelefono';
import './NationsInscripcion.css';

export const COPY = {
  es: {
    event: 'Nations Cup',
    eyebrow: 'Inscripción',
    title: 'Completa tus datos para la Nations Cup',
    intro: 'Inscríbete a la Nations Cup. Revisamos tu solicitud antes de activar tu participación.',
    introNaples: 'Inscríbete a la 5.ª Nations Cup. Elige tu nombre, completa tu ficha e inscríbete. El historial oficial que ya existe se conserva; si no hay historial, empiezas en 0. No necesitas vincular puntos FIPA.',
    verifyEmail: 'Verifica tu email antes de enviar la solicitud. Revisa tu correo.',
    signIn: 'Inicia sesión con tu cuenta verificada para continuar.',
    signInCta: 'Ingresar',
    name: 'Nombre y apellido',
    country: 'País',
    age: 'Edad',
    adult: 'Mayor de edad',
    minor: 'Menor de edad',
    unknown: 'Prefiero no informar',
    guardian: 'Declaro que soy responsable del jugador menor y autorizo su participación.',
    consent: 'Autorizo el uso de mis datos para la revisión de esta inscripción.',
    submit: 'Enviar solicitud',
    sending: 'Enviando…',
    pendingBadge: 'Pendiente',
    pendingBadgeNaples: 'Recibida',
    pending: 'Solicitud recibida. Queda pendiente de revisión de la organización.',
    pendingNaples: 'Registro recibido. Tu selección está guardada; no necesitas enviarla otra vez.',
    pendingNote: 'La organización está revisando tu solicitud. No necesitas enviarla otra vez.',
    pendingNoteNaples: 'Solicitud recibida. Tu selección está guardada; no necesitas enviarla otra vez.',
    profileIncomplete: 'Tu ficha oficial está incompleta. Completa estos campos antes de inscribirte; los datos guardados se reutilizan y puedes editarlos.',
    profileMissingFields: 'Campos faltantes:',
    completeProfileCta: 'Completar ficha',
    pointsNote: 'Si ya tienes historial oficial, se conserva; si no, cuentas desde 0. No tienes que reclamar ni vincular puntos.',
    selectorPublicNote: 'Elige tu nombre de la lista. Después inicia sesión para completar la ficha e inscribirte.',
    selectorNote: 'La lista muestra nombre y país. Elegir tu nombre no vincula tu cuenta ni da acceso al perfil, historial o puntos de otra persona; la edad se verifica después.',
    fipaPoints: 'Historial oficial:',
    noFipaHistory: 'Sin historial previo: 0 puntos.',
    historyAmbiguous: 'La organización revisará este historial; no se asignan puntos aquí.',
    historyUnavailable: 'El historial oficial no está disponible temporalmente.',
    approvedBadge: 'Aprobada',
    approved: 'Tu solicitud fue aprobada. Ya puedes entrar a tu perfil.',
    approvedCta: 'Ir a mi perfil',
    rejectedBadge: 'Rechazada',
    rejected: 'La solicitud no fue aprobada. Puedes corregir los datos y enviar una nueva.',
    newRequest: 'Enviar nueva solicitud',
    conflict: 'Ya tienes una solicitud activa para este evento. Revisa el estado o espera la revisión.',
    error: 'No pudimos enviar la solicitud. Reintenta en unos minutos.',
    restoreError: 'No pudimos consultar tu solicitud. Reintenta en unos minutos.',
    restore: 'Recuperando tu solicitud…',
    required: 'Completa los datos y las autorizaciones obligatorias.',
    countryList: 'Selecciona tu país',
    retry: 'Reintentar',
  },
  en: {
    event: 'Nations Cup',
    eyebrow: 'Registration',
    title: 'Complete your details for the Nations Cup',
    titleNaples: 'Complete your details for the 5th Nations Cup',
    subtitleNaples: 'Naples · Mostra d’Oltremare · November 20–22, 2026',
    intro: 'Register for the Nations Cup. We review your request before activating your participation.',
    introNaples: 'Register for the 5th Nations Cup. Choose your name, complete your player profile and register. Existing official history is preserved; if there is no history, you start at 0. You do not need to link FIPA points.',
    verifyEmail: 'Verify your email before sending the request. Check your inbox.',
    signIn: 'Sign in with your verified account to continue.',
    signInCta: 'Sign in',
    name: 'Full name',
    country: 'Country',
    age: 'Age',
    adult: 'Adult',
    minor: 'Minor',
    unknown: 'Prefer not to say',
    guardian: 'I declare I am the responsible adult for the minor and authorise participation.',
    consent: 'I authorise the use of my data to review this registration.',
    consentNaples: 'I agree to the use of my name, country, age confirmation and account details to process my Nations Cup registration.',
    adultConfirm: 'I confirm that I am 18 or older',
    selectorTitle: 'Find your name on the list',
    selectorCountry: 'Filter by country',
    selectorAllCountries: 'All countries',
    selectorName: 'Select your name',
    selectorPlaceholder: 'Choose your name',
    selectorSelected: 'Selected',
    selectorLoading: 'Loading the list of adult players...',
    selectorError: 'We could not load the player list. Try again.',
    selectorEmpty: 'No players are available in this list. Contact the organisation.',
    selectorRequired: 'Select your name from the list before submitting.',
    selectorReport: 'Report duplicate',
    selectorReported: 'Report received. The organisation will review it.',
    selectorReportError: 'We could not send the report. Try again.',
    selectorReportRetry: 'Retry report',
    selectorFallback: 'No adult-verified names are available. You can submit your name and country for individual age verification; the request stays pending and does not activate participation. Do not use another person\'s data.',
    selectorPublicNote: 'Choose your name from the list, then sign in to complete your profile and register.',
    selectorConflict: 'This name has more than one declaration. The organisation will reconcile it; no account or linked profile is assigned.',
    verificationPending: 'Registration received. Age verification is pending; your Nations participation is not active yet.',
    profileIncomplete: 'Your official player profile is incomplete. Complete these fields before registering; saved data is reused and editable.',
    profileMissingFields: 'Missing fields:',
    completeProfileCta: 'Complete player profile',
    selectorSearch: 'Search by name or country',
    pointsNote: 'Existing official history is preserved; if there is no history, you start at 0. You do not need to claim or link FIPA points.',
    fipaPoints: 'Official FIPA history:',
    noFipaHistory: 'No prior FIPA history: 0 points.',
    historyAmbiguous: 'The organisation will review this history; no points are assigned here.',
    historyUnavailable: 'Official history is temporarily unavailable.',
    selectorNote: 'The list shows name and country. Choosing your name does not link your account or give access to another person\'s profile, history or points; age is verified separately.',
    requiredNaples: 'Complete your name, country, confirm that you are 18 or older and consent to the use of your data.',
    adultOnlyError: 'Only players aged 18 or older can register for this event.',
    submitNaples: 'Submit registration',
    sendingNaples: 'Submitting…',
    submit: 'Send request',
    sending: 'Sending…',
    pendingBadge: 'Pending',
    pendingBadgeNaples: 'Received',
    pending: 'Request received. It is pending review by the organisation.',
    pendingNaples: 'Registration submitted. Your selection is saved; this does not activate your Nations participation.',
    pendingNoteNaples: 'Registration received. Your selection is saved; you do not need to send it again.',
    pendingNote: 'The organisation is reviewing your request. You do not need to send it again.',
    approvedBadge: 'Approved',
    approved: 'Your request was approved. You can open your profile.',
    approvedCta: 'Go to my profile',
    rejectedBadge: 'Rejected',
    rejected: 'The request was not approved. You can fix the details and send a new one.',
    newRequest: 'Send a new request',
    conflict: 'You already have an active request for this event. Check its status or wait for review.',
    error: 'We could not send the request. Try again in a few minutes.',
    restoreError: 'We could not check your request. Try again in a few minutes.',
    restore: 'Restoring your request…',
    required: 'Complete the details and required authorisations.',
    countryList: 'Select your country',
    retry: 'Try again',
  },
  it: {
    event: 'Nations Cup',
    eyebrow: 'Iscrizione',
    title: 'Completa i tuoi dati per la Nations Cup',
    intro: 'Iscriviti alla Nations Cup. Esaminiamo la tua richiesta prima di attivare la partecipazione.',
    introNaples: 'Iscriviti alla 5ª Nations Cup. Scegli il tuo nome, completa la scheda e iscriviti. Lo storico ufficiale esistente viene conservato; se non c\'è storico, parti da 0. Non devi collegare punti FIPA.',
    verifyEmail: 'Verifica la tua email prima di inviare la richiesta. Controlla la posta.',
    signIn: 'Accedi con il tuo account verificato per continuare.',
    signInCta: 'Accedi',
    name: 'Nome e cognome',
    country: 'Paese',
    age: 'Età',
    adult: 'Maggiorenne',
    minor: 'Minorenne',
    unknown: 'Preferisco non indicarlo',
    guardian: 'Dichiaro di essere il responsabile del minore e autorizzo la partecipazione.',
    consent: 'Autorizzo l’uso dei miei dati per la revisione di questa iscrizione.',
    submit: 'Invia richiesta',
    sending: 'Invio…',
    pendingBadge: 'In attesa',
    pendingBadgeNaples: 'Ricevuta',
    pending: 'Richiesta ricevuta. È in attesa di revisione da parte dell’organizzazione.',
    pendingNaples: 'Richiesta ricevuta. La tua selezione è salvata; non devi inviarla di nuovo.',
    pendingNote: 'L’organizzazione sta esaminando la tua richiesta. Non devi inviarla di nuovo.',
    pendingNoteNaples: 'Richiesta ricevuta. La tua selezione è salvata; non devi inviarla di nuovo.',
    profileIncomplete: 'La tua scheda ufficiale è incompleta. Completa questi campi prima di iscriverti; i dati salvati vengono riutilizzati e puoi modificarli.',
    profileMissingFields: 'Campi mancanti:',
    completeProfileCta: 'Completa la scheda',
    pointsNote: 'Lo storico ufficiale esistente viene conservato; se non c\'è storico, parti da 0. Non devi richiedere o collegare punti FIPA.',
    selectorPublicNote: 'Scegli il tuo nome dalla lista, poi accedi per completare la scheda e iscriverti.',
    selectorNote: 'La lista mostra nome e paese. Scegliere il tuo nome non collega l\'account né dà accesso al profilo, storico o punti di un\'altra persona; l\'età viene verificata separatamente.',
    fipaPoints: 'Storico ufficiale:',
    noFipaHistory: 'Nessuno storico precedente: 0 punti.',
    historyAmbiguous: 'L’organizzazione esaminerà questo storico; qui non vengono assegnati punti.',
    historyUnavailable: 'Lo storico ufficiale non è temporaneamente disponibile.',
    approvedBadge: 'Approvata',
    approved: 'La richiesta è stata approvata. Puoi aprire il tuo profilo.',
    approvedCta: 'Vai al mio profilo',
    rejectedBadge: 'Rifiutata',
    rejected: 'La richiesta non è stata approvata. Puoi correggere i dati e inviarne una nuova.',
    newRequest: 'Invia una nuova richiesta',
    conflict: 'Hai già una richiesta attiva per questo evento. Controlla lo stato o attendi la revisione.',
    error: 'Non siamo riusciti a inviare la richiesta. Riprova tra qualche minuto.',
    restoreError: 'Non siamo riusciti a controllare la tua richiesta. Riprova tra qualche minuto.',
    restore: 'Recupero della richiesta…',
    required: 'Completa i dati e le autorizzazioni obbligatorie.',
    countryList: 'Seleziona il tuo paese',
    retry: 'Riprova',
  },
};

COPY.pt = {
  ...COPY.es,
  eyebrow: 'Inscrição',
  title: 'Complete seus dados para a Nations Cup',
  intro: 'Inscreva-se na Nations Cup. Revisamos sua solicitação antes de ativar sua participação.',
  introNaples: 'Inscreva-se na 5ª Nations Cup. Escolha seu nome, complete sua ficha e inscreva-se. O histórico oficial existente é preservado; se não houver histórico, você começa em 0. Você não precisa vincular pontos FIPA.',
  verifyEmail: 'Verifique seu email antes de enviar a solicitação. Confira sua caixa de entrada.',
  signIn: 'Entre com sua conta verificada para continuar.',
  signInCta: 'Entrar',
  name: 'Nome e sobrenome',
  country: 'País',
  age: 'Idade',
  adult: 'Maior de idade',
  minor: 'Menor de idade',
  unknown: 'Prefiro não informar',
  guardian: 'Declaro que sou responsável pelo menor e autorizo sua participação.',
  consent: 'Autorizo o uso dos meus dados para revisar esta inscrição.',
  submit: 'Enviar solicitação',
  sending: 'Enviando…',
  pendingBadge: 'Pendente',
  pendingBadgeNaples: 'Recebida',
  pending: 'Solicitação recebida. Está pendente de revisão pela organização.',
  pendingNaples: 'Solicitação recebida. Sua seleção está salva; você não precisa enviar novamente.',
  pendingNote: 'A organização está revisando sua solicitação. Você não precisa enviar novamente.',
  pendingNoteNaples: 'Solicitação recebida. Sua seleção está salva; você não precisa enviar novamente.',
  profileIncomplete: 'Sua ficha oficial está incompleta. Complete estes campos antes de se inscrever; os dados salvos são reutilizados e você pode editar.',
  profileMissingFields: 'Campos faltantes:',
  completeProfileCta: 'Completar ficha',
  pointsNote: 'Se você já tem histórico oficial, ele é preservado; se não tiver, começa em 0. Você não precisa reivindicar nem vincular pontos FIPA.',
  selectorPublicNote: 'Escolha seu nome na lista e depois entre para completar a ficha e se inscrever.',
  selectorNote: 'A lista mostra nome e país. Escolher seu nome não vincula sua conta nem dá acesso ao perfil, histórico ou pontos de outra pessoa; a idade é verificada depois.',
  fipaPoints: 'Histórico oficial:',
  noFipaHistory: 'Sem histórico anterior: 0 pontos.',
  historyAmbiguous: 'A organização revisará este histórico; nenhum ponto é atribuído aqui.',
  historyUnavailable: 'O histórico oficial está temporariamente indisponível.',
  approvedBadge: 'Aprovada',
  approved: 'Sua solicitação foi aprovada. Você pode abrir seu perfil.',
  approvedCta: 'Ir para meu perfil',
  rejectedBadge: 'Rejeitada',
  rejected: 'A solicitação não foi aprovada. Você pode corrigir os dados e enviar uma nova.',
  newRequest: 'Enviar nova solicitação',
  conflict: 'Você já tem uma solicitação ativa para este evento. Confira o status ou aguarde a revisão.',
  error: 'Não foi possível enviar a solicitação. Tente novamente em alguns minutos.',
  restoreError: 'Não foi possível consultar sua solicitação. Tente novamente em alguns minutos.',
  restore: 'Recuperando sua solicitação…',
  required: 'Complete os dados e as autorizações obrigatórias.',
  countryList: 'Selecione seu país',
  retry: 'Tentar novamente',
};

const JOURNEY_COPY = {
 es: {step2: 'Paso 2 de 3 · Completa tu ficha de jugador', step3: 'Paso 3 de 3 · Confirma tu inscripción', profile: 'Completar mi ficha de jugador', change: 'Cambiar nombre elegido'},
 en: {step2: 'Step 2 of 3 · Complete your player profile', step3: 'Step 3 of 3 · Confirm your registration', profile: 'Complete my player profile', change: 'Change selected name'},
 pt: {step2: 'Etapa 2 de 3 · Complete sua ficha de jogador', step3: 'Etapa 3 de 3 · Confirme sua inscrição', profile: 'Completar minha ficha de jogador', change: 'Alterar nome escolhido'},
 it: {step2: 'Passaggio 2 di 3 · Completa la tua scheda giocatore', step3: 'Passaggio 3 di 3 · Conferma la tua iscrizione', profile: 'Completa la mia scheda giocatore', change: 'Cambia il nome scelto'},
};

// Catálogo mundial estático da app (40 países), NO la nómina del torneo.
const ISO = {
  Argentina:'AR', España:'ES', Italia:'IT', Francia:'FR', Alemania:'DE', Rumania:'RO', Austria:'AT',
  'Estados Unidos':'US', Brasil:'BR', Uruguay:'UY', Chile:'CL', Colombia:'CO', Perú:'PE', México:'MX',
  Paraguay:'PY', Bolivia:'BO', Ecuador:'EC', Venezuela:'VE', Canadá:'CA', Portugal:'PT',
  'Reino Unido':'GB', Irlanda:'IE', 'Países Bajos':'NL', Bélgica:'BE', Suiza:'CH', Suecia:'SE',
  Noruega:'NO', Dinamarca:'DK', Finlandia:'FI', Polonia:'PL', 'República Checa':'CZ', Hungría:'HU',
  Grecia:'GR', Turquía:'TR', Ucrania:'UA', Rusia:'RU', Egipto:'EG', Marruecos:'MA', Sudáfrica:'ZA',
  Australia:'AU', Japón:'JP', China:'CN', India:'IN', 'Corea del Sur':'KR', 'Emiratos Árabes Unidos':'AE',
  Catar:'QA', 'Arabia Saudita':'SA', Israel:'IL', Tailandia:'TH', Indonesia:'ID', Filipinas:'PH',
  'Nueva Zelanda':'NZ', Singapur:'SG',
};
const COUNTRIES = PAISES_TELEFONO_PRINCIPALES
  .map(({nombre, bandera}) => [ISO[nombre], `${bandera || ''} ${nombre}`.trim()])
  .filter(([code]) => Boolean(code));

/**
 * Nations Cup Nápoles 2026: la nómina del evento son 15 selecciones (PDF
 * Draw & Group Match Scheduling p.1; contraste en
 * task-4/NATIONS-PDF-contraste-20261108.txt). Este catálogo se aplica sólo al
 * slug exacto; el resto de los eventos conserva el catálogo mundial de la app.
 */
const MISSING_FIELD_LABELS = {
  es: {nombre:'Nombre',apellido:'Apellido',telefono:'Teléfono',email:'Email',pais:'País',ciudad:'Ciudad',nivel:'Nivel',lateralidad:'Lateralidad',posicion_cancha:'Posición en cancha',fecha_nacimiento:'Fecha de nacimiento',tipo_documento:'Tipo de documento',numero_documento:'Número de documento',nacionalidad:'Nacionalidad',genero:'Género',pais_documento:'País del documento',categoria_deportiva:'Categoría deportiva'},
  en: {nombre:'Name',apellido:'Surname',telefono:'Phone',email:'Email',pais:'Country',ciudad:'City',nivel:'Level',lateralidad:'Laterality',posicion_cancha:'Court position',fecha_nacimiento:'Date of birth',tipo_documento:'Document type',numero_documento:'Document number',nacionalidad:'Nationality',genero:'Gender',pais_documento:'Document country',categoria_deportiva:'Sports category'},
  pt: {nombre:'Nome',apellido:'Sobrenome',telefono:'Telefone',email:'Email',pais:'País',ciudad:'Cidade',nivel:'Nível',lateralidad:'Lateralidade',posicion_cancha:'Posição em quadra',fecha_nacimiento:'Data de nascimento',tipo_documento:'Tipo de documento',numero_documento:'Número do documento',nacionalidad:'Nacionalidade',genero:'Gênero',pais_documento:'País do documento',categoria_deportiva:'Categoria esportiva'},
  it: {nombre:'Nome',apellido:'Cognome',telefono:'Telefono',email:'Email',pais:'Paese',ciudad:'Città',nivel:'Livello',lateralidad:'Lateralità',posicion_cancha:'Posizione in campo',fecha_nacimiento:'Data di nascita',tipo_documento:'Tipo di documento',numero_documento:'Numero del documento',nacionalidad:'Nazionalità',genero:'Genere',pais_documento:'Paese del documento',categoria_deportiva:'Categoria sportiva'},
};
const missingFieldLabels = (keys, lang) => (Array.isArray(keys) ? keys : []).map((key) => MISSING_FIELD_LABELS[lang]?.[key] || MISSING_FIELD_LABELS.es[key] || key).join(', ');

const NAPOLI_2026_SLUG = 'nations-cup-napoli-2026';
const NAPOLI_2026_COUNTRIES = [
  {code: 'RO', flag: '🇷🇴', names: {pt: 'Romênia', es: 'Rumania', en: 'Romania', it: 'Romania'}},
  {code: 'ES', flag: '🇪🇸', names: {pt: 'Espanha', es: 'España', en: 'Spain', it: 'Spagna'}},
  {code: 'PT', flag: '🇵🇹', names: {pt: 'Portugal', es: 'Portugal', en: 'Portugal', it: 'Portogallo'}},
  {code: 'QA', flag: '🇶🇦', names: {pt: 'Catar', es: 'Catar', en: 'Qatar', it: 'Qatar'}},
  {code: 'IT', flag: '🇮🇹', names: {pt: 'Itália', es: 'Italia', en: 'Italy', it: 'Italia'}},
  {code: 'DE', flag: '🇩🇪', names: {pt: 'Alemanha', es: 'Alemania', en: 'Germany', it: 'Germania'}},
  {code: 'FR', flag: '🇫🇷', names: {pt: 'França', es: 'Francia', en: 'France', it: 'Francia'}},
  {code: 'BE', flag: '🇧🇪', names: {pt: 'Bélgica', es: 'Bélgica', en: 'Belgium', it: 'Belgio'}},
  {code: 'AT', flag: '🇦🇹', names: {pt: 'Áustria', es: 'Austria', en: 'Austria', it: 'Austria'}},
  {code: 'EG', flag: '🇪🇬', names: {pt: 'Egito', es: 'Egipto', en: 'Egypt', it: 'Egitto'}},
  {code: 'AE', flag: '🇦🇪', names: {pt: 'Emirados Árabes Unidos', es: 'Emiratos Árabes Unidos', en: 'United Arab Emirates', it: 'Emirati Arabi Uniti'}},
  {code: 'MX', flag: '🇲🇽', names: {pt: 'México', es: 'México', en: 'Mexico', it: 'Messico'}},
  {code: 'SE', flag: '🇸🇪', names: {pt: 'Suécia', es: 'Suecia', en: 'Sweden', it: 'Svezia'}},
  {code: 'UA', flag: '🇺🇦', names: {pt: 'Ucrânia', es: 'Ucrania', en: 'Ukraine', it: 'Ucraina'}},
  {code: 'DK', flag: '🇩🇰', names: {pt: 'Dinamarca', es: 'Dinamarca', en: 'Denmark', it: 'Danimarca'}},
];

const keyFor = (actor, slug) => `nationsProfileRequest:${actor}:${slug}`;
function newRequestId() {
  try { return crypto.randomUUID(); } catch { return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
}

/** Iconos locales, sin dependencias: refuerzan cada estado sin sumar copy. */
function NationsIcon({name}) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  };
  switch (name) {
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case 'check':
      return <svg {...common}><path d="m5 12 4.2 4.2L19 6.5" /></svg>;
    case 'x':
      return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case 'alert':
      return <svg {...common}><path d="M12 8v5" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>;
    case 'lock':
      return <svg {...common}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
    case 'arrow':
      return <svg {...common}><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></svg>;
    default:
      return null;
  }
}

/** Marco común: marca, evento y tarjeta central con ancho contenido. */
function NationsPageShell({eventLabel, children}) {
  return (
    <main className="nations-page">
      <div className="nations-shell">
        <header className="nations-topbar">
          <div className="nations-brand">
            <img
              className="nations-brand__logo nations-brand__logo--light"
              src="/brand/oficial-2026/padbol-internacional-light.svg"
              alt="Padbol Match"
              decoding="async"
            />
            <img
              className="nations-brand__logo nations-brand__logo--dark"
              src="/brand/oficial-2026/padbol-internacional-dark.svg"
              alt="Padbol Match"
              decoding="async"
            />
          </div>
          <span className="nations-event-chip">{eventLabel}</span>
        </header>
        {children}
      </div>
    </main>
  );
}

export default function NationsInscripcion() {
  const {slug = ''} = useParams();
  const {session, loading} = useAuth();
  const {i18n} = useSafeTranslation();
  const isNaples2026 = slug === NAPOLI_2026_SLUG;
  const location = useLocation();
  const requestedLanguage = new URLSearchParams(location.search).get('lang');
  const lang = isNaples2026 ? (['es', 'en', 'it', 'pt'].includes(requestedLanguage) ? requestedLanguage : 'en') : (i18n?.language || 'es').slice(0, 2);
  const registrationReturn = `/nations-cup/${slug}/inscripcion${isNaples2026 && requestedLanguage === lang ? `?lang=${lang}` : ''}`;
  const t = COPY[lang] || COPY.es;
  const journey = JOURNEY_COPY[lang] || JOURNEY_COPY.en;
  const actorId = session?.user?.id || null;
  const title = isNaples2026 ? t.titleNaples : t.title;
  const intro = isNaples2026 ? t.introNaples : t.intro;
  const consentCopy = isNaples2026 ? t.consentNaples : t.consent;
  const submitLabel = isNaples2026 ? t.submitNaples : t.submit;
  const sendingLabel = isNaples2026 ? t.sendingNaples : t.sending;


  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(false);
  const [ignoreServerStatus, setIgnoreServerStatus] = useState(false);
  const [status, setStatus] = useState(null); // pendiente | aprobada | rechazada | en_revision
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [age, setAge] = useState('desconocido');
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [selector, setSelector] = useState([]);
  const canonicalCountryOptions = slug === NAPOLI_2026_SLUG
    ? NAPOLI_2026_COUNTRIES.map(({code, flag, names}) => [code, `${flag} ${names[lang] || names.es}`.trim()]).sort((a, b) => a[1].replace(/^[^\p{L}]+/u, '').localeCompare(b[1].replace(/^[^\p{L}]+/u, ''), lang, {sensitivity: 'base'}))
    : COUNTRIES;
  // QA-only nominations may include additional vetted countries; production stays canonical 15.
  const countryOptions = isNaples2026 && process.env.REACT_APP_APP_VARIANT === 'qa'
    ? [...canonicalCountryOptions, ...COUNTRIES.filter(([code]) => selector.some(p => p.country === code) && !canonicalCountryOptions.some(([existing]) => existing === code))].sort((a,b) => a[1].replace(/^[^\p{L}]+/u,'').localeCompare(b[1].replace(/^[^\p{L}]+/u,''),lang,{sensitivity:'base'}))
    : canonicalCountryOptions;
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [selectorError, setSelectorError] = useState(false);
  const [selectorAttempt, setSelectorAttempt] = useState(0);
  const [selectorReady, setSelectorReady] = useState(false);
  const [selectorCountry, setSelectorCountry] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectionStatus, setSelectionStatus] = useState(null);
  const [reported, setReported] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [profileReadiness, setProfileReadiness] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const historySeq = useRef(0);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState(false);
  const reportToken = useRef('');
  const reportSeq = useRef(0);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const epoch = useRef(0);
  // Guarda síncrona: React puede no haber aplicado `sending` cuando llega el segundo click.
  // Evita un segundo POST con el mismo request_id mientras el primero sigue en vuelo.
  const sendingRef = useRef(false);

  // El id vive en estado: al pedir una nueva solicitud DESPUES de un rechazo debe cambiar en
  // memoria, no solo en sessionStorage (bug real: se reenviaba el id rechazado => 409).
  const [requestId, setRequestId] = useState(() => {
    if (!actorId || !slug) return null;
    const existing = sessionStorage.getItem(keyFor(actorId, slug));
    if (existing) return existing;
    const fresh = newRequestId();
    sessionStorage.setItem(keyFor(actorId, slug), fresh);
    return fresh;
  });
  useEffect(() => {
    if (!actorId || !slug) { setRequestId(null); return; }
    const existing = sessionStorage.getItem(keyFor(actorId, slug));
    if (existing) { setRequestId(existing); return; }
    const fresh = newRequestId();
    sessionStorage.setItem(keyFor(actorId, slug), fresh);
    setRequestId(fresh);
  }, [actorId, slug]);

  // Cambio de actor o de evento: se limpia todo el estado local y se ignoran respuestas viejas.
  useEffect(() => {
    epoch.current += 1;
    sendingRef.current = false;
    setStatus(null); setError(null); setRestoreError(false); setName(''); setCountry(''); setAge('desconocido');
    setGuardianConsent(false); setAdultConfirmed(false); setConsent(false); setSending(false);
    setSelected(null); setSelectionStatus(null); setProfileIncomplete(false); setProfileReadiness(null); setHistory(null); setHistoryError(false); setHistoryLoading(false); historySeq.current += 1; setSelectorReady(false); setSelectorCountry(''); setReported(false); setReportError(false); setReporting(false); reportToken.current = ''; setSelectorError(false);
  }, [actorId, slug]);

  const apiBase = process.env.REACT_APP_API_URL || '';
  const token = session?.access_token || null;
  const emailVerified = Boolean(session?.user?.email_confirmed_at || session?.user?.confirmed_at);
  const selectorStorageKey = isNaples2026 && slug ? `nationsSelector:${slug}` : null;

  const persistSelection = useCallback((participant) => {
    if (!selectorStorageKey) return;
    try {
      if (participant) sessionStorage.setItem(selectorStorageKey, JSON.stringify(participant));
      else sessionStorage.removeItem(selectorStorageKey);
    } catch { /* ignore */ }
  }, [selectorStorageKey]);

  const countryLabelFor = code => countryOptions.find(([c]) => c === code)?.[1] || code;
  const selectorMatches = (participant) => !selectorCountry || participant.country === selectorCountry;
  const orderedSelector = selector.filter(selectorMatches).sort((a, b) => String(a.name).localeCompare(String(b.name), lang, {sensitivity: 'base'}));

  const loadHistory = useCallback(async (selectionId) => {
    const seq = ++historySeq.current;
    if (!selectionId) { setHistory(null); setHistoryError(false); setHistoryLoading(false); return; }
    setHistoryLoading(true); setHistoryError(false);
    try {
      const res = await fetch(`${apiBase}/api/nations-activation/events/${encodeURIComponent(slug)}/selector/${encodeURIComponent(selectionId)}/history`);
      if (seq !== historySeq.current) return;
      const body = await res.json().catch(() => null);
      if (!res.ok) { setHistory(null); setHistoryError(true); return; }
      setHistory(body);
    } catch { if (seq === historySeq.current) { setHistory(null); setHistoryError(true); } }
    finally { if (seq === historySeq.current) setHistoryLoading(false); }
  }, [apiBase, slug]);

  useEffect(() => {
    if (selected?.selectionId) void loadHistory(selected.selectionId);
    else { setHistory(null); setHistoryError(false); setHistoryLoading(false); }
  }, [selected?.selectionId, loadHistory]);

  const chooseSelection = (selectionId) => {
    const found = selector.find((p) => p.selectionId === selectionId) || null;
    setSelected(found);
    if (found) { setName(found.name); setCountry(found.country); } else { setName(''); setCountry(''); }
    setReported(false); setReportError(false); setReporting(false); reportToken.current = '';
    persistSelection(found);
  };

  // La selección local pre-login no es un claim: se restaura al volver del login y el backend la valida al enviar.
  useEffect(() => {
    if (!selectorStorageKey) return;
    try {
      const raw = sessionStorage.getItem(selectorStorageKey);
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (stored?.selectionId) {
        setSelected(stored);
        setName(stored.name || '');
        setCountry(stored.country || '');
      }
    } catch { /* ignore */ }
  }, [selectorStorageKey, actorId]);

  // Si la lista cargó vacía/falló, la selección guardada ya no es válida: no enviar un id obsoleto.
  useEffect(() => {
    if (!isNaples2026 || !selectorReady || !selected) return;
    if (!selector.some((p) => p.selectionId === selected.selectionId)) {
      setSelected(null); setName(''); setCountry(''); persistSelection(null);
    }
  }, [isNaples2026, selectorReady, selector, selected, persistSelection]);

  useEffect(() => {
    if (!isNaples2026) { setSelector([]); return undefined; }
    let cancelled = false;
    setSelectorReady(false);
    setSelectorLoading(true);
    setSelectorError(false);
    fetch(`${apiBase}/api/nations-activation/events/${encodeURIComponent(slug)}/selector`, {
      headers: token ? {Authorization: `Bearer ${token}`} : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('SELECTOR_UNAVAILABLE');
        const body = await res.json().catch(() => null);
        if (!cancelled) { setSelector(Array.isArray(body?.participants) ? body.participants : []); setSelectorReady(true); }
      })
      .catch(() => { if (!cancelled) { setSelector([]); setSelectorError(true); setSelectorReady(true); } })
      .finally(() => { if (!cancelled) setSelectorLoading(false); });
    return () => { cancelled = true; };
  }, [isNaples2026, apiBase, slug, token, selectorAttempt]);

  const loadStatus = useCallback(async () => {
    if (!actorId || !slug) return;
    // Tras "nueva solicitud" no se re-restaura la rechazada (evita tapar el formulario).
    if (ignoreServerStatus) return;
    const ticket = epoch.current;
    setRestoreError(false);
    setRestoring(true);
    try {
      const res = await fetch(`${apiBase}/api/nations-activation/events/${encodeURIComponent(slug)}/profile-request`, {
        headers: token ? {Authorization: `Bearer ${token}`} : {},
      });
      if (ticket !== epoch.current) return;
      if (!res.ok) {
        // 5xx: el estado no se pudo verificar. Se ofrece reintentar el GET, nunca reenviar el POST.
        if (res.status >= 500) setRestoreError(true);
        return;
      }
      const body = await res.json().catch(() => null);
      if (ticket !== epoch.current) return;
      const latest = Array.isArray(body?.requests) ? body.requests[0] : null;
      if (body?.profile_readiness) setProfileReadiness(body.profile_readiness);
      if (latest && !ignoreServerStatus) { setStatus(latest.status); setSelectionStatus(latest.selection_status || null); if (latest.age_status) setAge(latest.age_status); }
    } catch {
      if (ticket === epoch.current) setRestoreError(true);
    } finally {
      if (ticket === epoch.current) setRestoring(false);
    }
  }, [actorId, slug, apiBase, token, ignoreServerStatus]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const submit = async (event) => {
    event.preventDefault();
    const idActual = (actorId && slug && sessionStorage.getItem(keyFor(actorId, slug))) || requestId;
    if (sending || sendingRef.current || !idActual || restoring) return;
    setError(null);
    setRestoreError(false);
    if (isNaples2026 && selected && profileReadiness?.complete !== true) return;
    if (isNaples2026 && selector.length > 0 && !selected) { setError(t.selectorRequired); return; }
    if (!name.trim() || !country) { setError(isNaples2026 ? t.requiredNaples : t.required); return; }
    if (isNaples2026) {
      if (!adultConfirmed) { setError(t.requiredNaples); return; }
    } else if (age === 'menor' && !guardianConsent) {
      setError(t.required); return;
    }
    if (!consent) { setError(isNaples2026 ? t.requiredNaples : t.required); return; }
    sendingRef.current = true;
    setSending(true);
    const ticket = epoch.current;
    try {
      const res = await fetch(`${apiBase}/api/nations-activation/events/${encodeURIComponent(slug)}/profile-request`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
        body: JSON.stringify({
          request_id: idActual,
          declared_name: name.trim(),
          declared_country: country,
          age_status: isNaples2026 ? 'adulto' : age,
          guardian_consent: isNaples2026 ? false : (age === 'menor' ? guardianConsent : false),
          profile_consent: consent,
          ...(isNaples2026 && selected ? {selection_id: selected.selectionId} : {}),
        }),
      });
      if (ticket !== epoch.current) return;
      const body = await res.json().catch(() => null);
      if (ticket !== epoch.current) return;
      if (res.status === 409 && body?.code === 'PLAYER_PROFILE_INCOMPLETE') { setProfileReadiness({complete: false, missing: body?.missing || body?.profile_readiness?.missing || []}); setProfileIncomplete(true); setError(t.profileIncomplete); return; }
      if (res.status === 409) { setError(t.conflict); return; }
      if (!res.ok) { setError(isNaples2026 && body?.code === 'ADULT_ONLY' ? t.adultOnlyError : t.error); return; }
      setStatus(body?.status || 'pendiente');
      setSelectionStatus(body?.selectionStatus || null);
      if (isNaples2026) persistSelection(null);
    } catch {
      if (ticket === epoch.current) setError(t.error);
    } finally {
      if (ticket === epoch.current) {
        sendingRef.current = false;
        setSending(false);
      }
    }
  };

  const startNew = () => {
    if (!actorId) return;
    const fresh = newRequestId();
    sessionStorage.setItem(keyFor(actorId, slug), fresh);
    setRequestId(fresh);
    setIgnoreServerStatus(true);
    setStatus(null); setError(null); setRestoreError(false);
  };

  // Reintento manual sólo del GET de restauración. No toca request_id, edad, consentimiento ni payload.
  const retryRestore = () => {
    if (restoring) return;
    loadStatus();
  };

  if (loading) {
    return (
      <NationsPageShell eventLabel={t.event}>
        <section className="nations-card nations-card--loading" aria-busy="true">
          <span className="nations-spinner nations-spinner--brand" aria-hidden="true" />
          <p className="nations-loading-text" role="status">{t.restore}</p>
          <div className="nations-skeleton" aria-hidden="true">
            <span /><span /><span />
          </div>
        </section>
      </NationsPageShell>
    );
  }

  if (!session?.user) {
    const back = encodeURIComponent(registrationReturn);
    return (
      <NationsPageShell eventLabel={t.event}>
        <section className="nations-card nations-card--center" aria-labelledby="nations-title">
          <span className="nations-icon-badge" aria-hidden="true"><NationsIcon name="lock" /></span>
          <h1 className="nations-title" id="nations-title">{title}</h1>
          {isNaples2026 ? <p className="nations-intro">{t.subtitleNaples}</p> : null}
          {isNaples2026 ? (
            <section className="nations-selector" aria-labelledby="nations-public-selector-title">
              <h2 className="nations-label" id="nations-public-selector-title">{t.selectorTitle}</h2>
              <p className="nations-status__note">{t.selectorPublicNote}</p>
              <p className="nations-status__note">{t.pointsNote}</p>
              {selectorError ? <p role="alert">{t.selectorError}</p> : null}
              {selectorLoading ? <p role="status">{t.selectorLoading}</p> : null}
              {!selectorLoading && !selectorError && !selector.length ? <p role="status">{t.selectorEmpty}</p> : null}
              <div className="nations-field">
                <label className="nations-label" htmlFor="nations-public-selector-country">{t.selectorCountry}</label>
                <div className="nations-select-wrap">
                  <select className="nations-select" id="nations-public-selector-country" value={selectorCountry} onChange={(e) => { setSelectorCountry(e.target.value); chooseSelection(''); }}>
                    <option value="">{t.selectorAllCountries}</option>
                    {countryOptions.filter(([code]) => selector.some((p) => p.country === code)).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                  </select>
                  <span className="nations-select__chevron" aria-hidden="true" />
                </div>
              </div>
              <div className="nations-field">
                <label className="nations-label" htmlFor="nations-public-selector-name">{t.selectorName}</label>
                <div className="nations-select-wrap">
                  <select className="nations-select" id="nations-public-selector-name" value={selected?.selectionId || ''} onChange={(e) => chooseSelection(e.target.value)} disabled={selectorLoading || selectorError}>
                    <option value="">{t.selectorPlaceholder}</option>
                    {orderedSelector.map((p) => <option key={p.selectionId} value={p.selectionId}>{p.name} · {process.env.REACT_APP_APP_VARIANT === 'qa' ? countryLabelFor(p.country) : p.country}</option>)}
                  </select>
                  <span className="nations-select__chevron" aria-hidden="true" />
                </div>
              </div>
              {selected ? <p role="status"><strong>{t.selectorSelected}:</strong> {selected.name} · {selected.country}</p> : null}
              {historyLoading ? <p role="status">{t.sending}</p> : null}
              {!historyLoading && history?.status === 'matched' ? <p>{t.fipaPoints} {history.puntos} pts</p> : null}
              {!historyLoading && history?.status === 'zero' ? <p>{t.noFipaHistory}</p> : null}
              {!historyLoading && history?.status === 'ambiguous' ? <p>{t.historyAmbiguous}</p> : null}
              {!historyLoading && historyError ? <p>{t.historyUnavailable}</p> : null}
            </section>
          ) : null}
          <p className="nations-intro">{t.signIn}</p>
          <Link className="nations-button" to={isNaples2026 ? `/login?redirect=${back}&lang=${lang}` : `/login?redirect=${back}`}>{t.signInCta}</Link>
        </section>
      </NationsPageShell>
    );
  }

  const statusView =
    status === 'pendiente' || status === 'en_revision'
      ? 'pending'
      : status === 'aprobada'
        ? 'approved'
        : status === 'rechazada'
          ? 'rejected'
          : null;

  return (
    <NationsPageShell eventLabel={t.event}>
      <section className="nations-card" aria-labelledby="nations-title">
        <span className="nations-eyebrow">{t.eyebrow}</span>
        <h1 className="nations-title" id="nations-title">{title}</h1>
        {isNaples2026 ? <p className="nations-intro nations-subtitle">{t.subtitleNaples}</p> : null}
        <p className="nations-intro">{intro}</p>

        <div className="nations-alerts">
          {!emailVerified ? (
            <div className="nations-alert nations-alert--warning" role="alert">
              <span className="nations-alert__icon" aria-hidden="true"><NationsIcon name="alert" /></span>
              <p>{t.verifyEmail}</p>
            </div>
          ) : null}
          {restoring ? (
            <div className="nations-alert nations-alert--info" role="status">
              <span className="nations-spinner nations-spinner--brand" aria-hidden="true" />
              <p>{t.restore}</p>
            </div>
          ) : null}
          {restoreError ? (
            <div className="nations-alert nations-alert--error" role="alert">
              <span className="nations-alert__icon" aria-hidden="true"><NationsIcon name="alert" /></span>
              <div className="nations-alert__body">
                <p>{t.restoreError}</p>
                <button className="nations-text-button" type="button" onClick={retryRestore} disabled={restoring}>
                  {t.retry}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {statusView === 'pending' ? (
          <section className="nations-status nations-status--pending" role="status">
            <div className="nations-status__head">
              <span className="nations-status__icon nations-status__icon--pending" aria-hidden="true"><NationsIcon name="clock" /></span>
              <h2>{isNaples2026 ? t.pendingBadgeNaples : t.pendingBadge}</h2>
            </div>
            <p>{isNaples2026 ? t.pendingNaples : t.pending}</p>
            <p className="nations-status__note">{isNaples2026 ? t.pendingNoteNaples : t.pendingNote}</p>
            {isNaples2026 && selectionStatus === 'verificacion_pendiente' ? (
              <div className="nations-alert nations-alert--warning" role="status">
                <span className="nations-alert__icon" aria-hidden="true"><NationsIcon name="alert" /></span>
                <p>{t.verificationPending}</p>
              </div>
            ) : null}
            {isNaples2026 && selectionStatus === 'en_conflicto' ? (
              <div className="nations-alert nations-alert--warning" role="status">
                <span className="nations-alert__icon" aria-hidden="true"><NationsIcon name="alert" /></span>
                <p>{t.selectorConflict}</p>
              </div>
            ) : null}
            {isNaples2026 && profileReadiness?.complete === false ? (
              <div className="nations-alert nations-alert--warning" role="alert">
                <span className="nations-alert__icon" aria-hidden="true"><NationsIcon name="alert" /></span>
                <div className="nations-alert__body">
                  <p>{t.profileIncomplete}</p>
                  <p><strong>{t.profileMissingFields}</strong> {missingFieldLabels(profileReadiness.missing, lang)}</p>
                  <Link className="nations-text-button" to={`/mi-perfil?redirect=${encodeURIComponent(registrationReturn)}`}>{t.completeProfileCta}</Link>
                </div>
              </div>
            ) : null}
            {isNaples2026 ? <Link className="nations-button" to={`/mi-perfil?redirect=${encodeURIComponent(registrationReturn)}`}>{t.approvedCta}</Link> : null}
          </section>
        ) : statusView === 'approved' ? (
          <section className="nations-status nations-status--approved" role="status">
            <div className="nations-status__head">
              <span className="nations-status__icon nations-status__icon--approved" aria-hidden="true"><NationsIcon name="check" /></span>
              <h2>{t.approvedBadge}</h2>
            </div>
            <p>{t.approved}</p>
            <Link className="nations-button nations-button--success" to={`/mi-perfil?redirect=${encodeURIComponent(registrationReturn)}`}>{t.approvedCta}</Link>
          </section>
        ) : statusView === 'rejected' ? (
          <section className="nations-status nations-status--rejected" role="alert">
            <div className="nations-status__head">
              <span className="nations-status__icon nations-status__icon--rejected" aria-hidden="true"><NationsIcon name="x" /></span>
              <h2>{t.rejectedBadge}</h2>
            </div>
            <p>{t.rejected}</p>
            <button className="nations-button nations-button--secondary" type="button" onClick={startNew}>
              {t.newRequest}
            </button>
          </section>
        ) : isNaples2026 && selected && profileReadiness?.complete !== true ? (
          <section className="nations-selector" aria-labelledby="nations-profile-step">
            <h2 className="nations-label" id="nations-profile-step">{journey.step2}</h2>
            <p className="nations-status__note"><strong>{t.selectorSelected}:</strong> {selected.name} · {countryOptions.find(([code]) => code === selected.country)?.[1] || selected.country}</p>
            {profileReadiness?.complete === false ? <><p>{t.profileIncomplete}</p>
            <p><strong>{t.profileMissingFields}</strong> {missingFieldLabels(profileReadiness.missing, lang)}</p>
            <Link className="nations-button" to={`/mi-perfil?redirect=${encodeURIComponent(registrationReturn)}`}>{journey.profile}</Link></> : <><p role="status">{restoring ? t.restore : t.restoreError}</p><button className="nations-button" type="button" onClick={retryRestore} disabled={restoring}>{t.retry}</button></>}
            <button className="nations-text-button" type="button" onClick={() => chooseSelection('')}>{journey.change}</button>
          </section>
        ) : (
          <form className="nations-form" onSubmit={submit} aria-busy={sending || restoring}>
            {isNaples2026 && selected && profileReadiness?.complete === true ? <><h2 className="nations-label">{journey.step3}</h2><button className="nations-text-button" type="button" onClick={() => chooseSelection('')}>{journey.change}</button></> : null}
            {isNaples2026 && selected && profileReadiness?.complete === false ? (
              <div className="nations-alert nations-alert--warning" role="alert">
                <span className="nations-alert__icon" aria-hidden="true"><NationsIcon name="alert" /></span>
                <div className="nations-alert__body">
                  <p>{t.profileIncomplete}</p>
                  <p><strong>{t.profileMissingFields}</strong> {missingFieldLabels(profileReadiness.missing, lang)}</p>
                  <Link className="nations-text-button" to={`/mi-perfil?redirect=${encodeURIComponent(registrationReturn)}`}>{t.completeProfileCta}</Link>
                </div>
              </div>
            ) : null}
            {error ? (
              <div className="nations-alert nations-alert--error" role="alert">
                <span className="nations-alert__icon" aria-hidden="true"><NationsIcon name="alert" /></span>
                <p>{error}</p>
              </div>
            ) : null}
            {profileIncomplete ? (
              <Link className="nations-button nations-button--secondary" to={`/mi-perfil?redirect=${encodeURIComponent(registrationReturn)}`}>
                {t.completeProfileCta}
              </Link>
            ) : null}

            {isNaples2026 && !selected ? (
              <section className="nations-selector" aria-labelledby="nations-selector-title">
                <h2 className="nations-label" id="nations-selector-title">{t.selectorTitle}</h2>
                <p className="nations-status__note">{t.selectorNote}</p>
                <p className="nations-status__note">{t.pointsNote}</p>
                {selectorError ? (
                  <div className="nations-alert nations-alert--error" role="alert">
                    <span className="nations-alert__icon" aria-hidden="true"><NationsIcon name="alert" /></span>
                    <div className="nations-alert__body">
                      <p>{t.selectorError}</p>
                      <button className="nations-text-button" type="button" onClick={() => setSelectorAttempt((n) => n + 1)}>{t.retry}</button>
                    </div>
                  </div>
                ) : null}
                {selectorLoading ? <p role="status">{t.selectorLoading}</p> : null}
                {!selectorLoading && !selectorError && !selector.length ? (<><p role="status">{t.selectorEmpty}</p><p className="nations-status__note">{t.selectorFallback}</p></>) : null}
                <div className="nations-field">
                  <label className="nations-label" htmlFor="nations-selector-country">{t.selectorCountry}</label>
                  <div className="nations-select-wrap">
                    <select className="nations-select" id="nations-selector-country" value={selectorCountry} onChange={(e) => { setSelectorCountry(e.target.value); chooseSelection(''); }}>
                      <option value="">{t.selectorAllCountries}</option>
                      {countryOptions.filter(([code]) => selector.some((p) => p.country === code)).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                    </select>
                    <span className="nations-select__chevron" aria-hidden="true" />
                  </div>
                </div>
                <div className="nations-field">
                  <label className="nations-label" htmlFor="nations-selector-name">{t.selectorName}</label>
                  <div className="nations-select-wrap">
                    <select
                      className="nations-select"
                      id="nations-selector-name"
                      value={selected?.selectionId || ''}
                      onChange={(e) => chooseSelection(e.target.value)}
                      disabled={selectorLoading || selectorError}
                    >
                      <option value="">{t.selectorPlaceholder}</option>
                      {orderedSelector.map((p) => (
                        <option key={p.selectionId} value={p.selectionId}>{p.name} · {process.env.REACT_APP_APP_VARIANT === 'qa' ? countryLabelFor(p.country) : p.country}</option>
                      ))}
                    </select>
                    <span className="nations-select__chevron" aria-hidden="true" />
                  </div>
                </div>

              </section>
            ) : null}

                {selected ? (
                  <div className="nations-status__note" role="status">
                    <strong>{t.selectorSelected}:</strong> {selected.name} · {selected.country}
                    {historyLoading ? <span> {t.sending}</span> : null}
                    {!historyLoading && history?.status === 'matched' ? <span> · {t.fipaPoints} {history.puntos} pts</span> : null}
                    {!historyLoading && history?.status === 'zero' ? <span> · {t.noFipaHistory}</span> : null}
                    {!historyLoading && history?.status === 'ambiguous' ? <span> · {t.historyAmbiguous}</span> : null}
                    {!historyLoading && historyError ? <span> · {t.historyUnavailable}</span> : null}
                    <button
                      className="nations-text-button"
                      type="button"
                      disabled={reported || reporting}
                      onClick={async () => {
                        if (reporting || !selected) return;
                        const tokenForReport = `${actorId}:${slug}:${selected.selectionId}:${++reportSeq.current}`;
                        reportToken.current = tokenForReport;
                        setReporting(true); setReportError(false);
                        try {
                          const res = await fetch(`${apiBase}/api/nations-activation/events/${encodeURIComponent(slug)}/selector/report`, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
                            body: JSON.stringify({selection_id: selected.selectionId}),
                          });
                          if (reportToken.current === tokenForReport) {
                            if (res.ok) setReported(true);
                            else setReportError(true);
                          }
                        } catch {
                          if (reportToken.current === tokenForReport) setReportError(true);
                        } finally {
                          if (reportToken.current === tokenForReport) setReporting(false);
                        }
                      }}
                    >
                      {reported ? t.selectorReported : reportError ? t.selectorReportRetry : reporting ? t.sendingNaples : t.selectorReport}
                    </button>
                    {reportError ? <span role="alert">{t.selectorReportError}</span> : null}
                  </div>
                ) : null}
            {(!isNaples2026 || selected || (!selector.length && !selectorLoading)) ? <>
            {!selected ? <>
                <div className="nations-field">
                  <label className="nations-label" htmlFor="nations-name">{t.name}</label>
                  <input className="nations-input" id="nations-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={100} readOnly={isNaples2026 && selector.length > 0} />
                </div>
                <div className="nations-field">
                  <label className="nations-label" htmlFor="nations-country">{t.country}</label>
                  <div className="nations-select-wrap">
                    <select className="nations-select" id="nations-country" value={country} onChange={(e) => setCountry(e.target.value)} disabled={isNaples2026 && selector.length > 0}>
                      <option value="">{t.countryList}</option>
                      {countryOptions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                    </select>
                    <span className="nations-select__chevron" aria-hidden="true" />
                  </div>
                </div>
            </> : null}

            {isNaples2026 ? (
              <label className="nations-check">
                <input type="checkbox" checked={adultConfirmed} onChange={(e) => setAdultConfirmed(e.target.checked)} />
                <span className="nations-check__box" aria-hidden="true" />
                <span className="nations-check__text">{t.adultConfirm}</span>
              </label>
            ) : (
              <>
                <fieldset className="nations-fieldset">
                  <legend className="nations-label">{t.age}</legend>
                  <div className="nations-options">
                    {[['adulto', t.adult], ['menor', t.minor], ['desconocido', t.unknown]].map(([value, label]) => (
                      <label className="nations-option" key={value}>
                        <input type="radio" name="age" value={value} checked={age === value} onChange={() => setAge(value)} />
                        <span className="nations-option__surface">
                          <span className="nations-option__dot" aria-hidden="true" />
                          <span className="nations-option__text">{label}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {age === 'menor' ? (
                  <label className="nations-check nations-check--guardian">
                    <input type="checkbox" checked={guardianConsent} onChange={(e) => setGuardianConsent(e.target.checked)} />
                    <span className="nations-check__box" aria-hidden="true" />
                    <span className="nations-check__text">{t.guardian}</span>
                  </label>
                ) : null}
              </>
            )}

            <label className="nations-check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="nations-check__box" aria-hidden="true" />
              <span className="nations-check__text">{consentCopy}</span>
            </label>

            <button
              className="nations-button"
              type="submit"
              disabled={sending || restoring || !emailVerified || (isNaples2026 && selectorLoading) || (isNaples2026 && profileReadiness?.complete === false)}
            >
              {sending ? (
                <>
                  <span className="nations-spinner nations-spinner--button" aria-hidden="true" />
                  {sendingLabel}
                </>
              ) : (
                <>
                  {submitLabel}
                  <span className="nations-button__arrow" aria-hidden="true"><NationsIcon name="arrow" /></span>
                </>
              )}
            </button>
            </> : null}
          </form>
        )}
      </section>
    </NationsPageShell>
  );
}
