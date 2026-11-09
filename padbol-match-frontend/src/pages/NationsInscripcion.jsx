import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useSafeTranslation} from '../i18n/tSafe';
import {PAISES_TELEFONO_PRINCIPALES} from '../constants/paisesTelefono';
import './NationsInscripcion.css';

const COPY = {
  es: {
    event: 'Nations Cup',
    eyebrow: 'Inscripción',
    title: 'Completa tus datos para la Nations Cup',
    intro: 'Inscríbete a la Nations Cup. Revisamos tu solicitud antes de activar tu participación.',
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
    pending: 'Solicitud recibida. Queda pendiente de revisión de la organización.',
    pendingNote: 'La organización está revisando tu solicitud. No necesitas enviarla otra vez.',
    approvedBadge: 'Aprobada',
    approved: 'Tu solicitud fue aprobada. Ya puedes entrar a tu perfil.',
    approvedCta: 'Ir a mi perfil',
    rejectedBadge: 'Rechazada',
    rejected: 'La solicitud no fue aprobada. Puedes corregir los datos y enviar una nueva.',
    newRequest: 'Enviar nueva solicitud',
    conflict: 'Ya tienes una solicitud activa para este evento. Revisa el estado o espera la revisión.',
    error: 'No pudimos enviar la solicitud. Reintenta en unos minutos.',
    restore: 'Recuperando tu solicitud…',
    required: 'Completa nombre, país y edad.',
    countryList: 'Selecciona tu país',
    retry: 'Reintentar',
  },
  en: {
    event: 'Nations Cup',
    eyebrow: 'Registration',
    title: 'Complete your details for the Nations Cup',
    intro: 'Register for the Nations Cup. We review your request before activating your participation.',
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
    submit: 'Send request',
    sending: 'Sending…',
    pendingBadge: 'Pending',
    pending: 'Request received. It is pending review by the organisation.',
    pendingNote: 'The organisation is reviewing your request. You do not need to send it again.',
    approvedBadge: 'Approved',
    approved: 'Your request was approved. You can open your profile.',
    approvedCta: 'Go to my profile',
    rejectedBadge: 'Rejected',
    rejected: 'The request was not approved. You can fix the details and send a new one.',
    newRequest: 'Send a new request',
    conflict: 'You already have an active request for this event. Check its status or wait for review.',
    error: 'We could not send the request. Try again in a few minutes.',
    restore: 'Restoring your request…',
    required: 'Complete name, country and age.',
    countryList: 'Select your country',
    retry: 'Try again',
  },
  it: {
    event: 'Nations Cup',
    eyebrow: 'Iscrizione',
    title: 'Completa i tuoi dati per la Nations Cup',
    intro: 'Iscriviti alla Nations Cup. Esaminiamo la tua richiesta prima di attivare la partecipazione.',
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
    pending: 'Richiesta ricevuta. È in attesa di revisione da parte dell’organizzazione.',
    pendingNote: 'L’organizzazione sta esaminando la tua richiesta. Non devi inviarla di nuovo.',
    approvedBadge: 'Approvata',
    approved: 'La richiesta è stata approvata. Puoi aprire il tuo profilo.',
    approvedCta: 'Vai al mio profilo',
    rejectedBadge: 'Rifiutata',
    rejected: 'La richiesta non è stata approvata. Puoi correggere i dati e inviarne una nuova.',
    newRequest: 'Invia una nuova richiesta',
    conflict: 'Hai già una richiesta attiva per questo evento. Controlla lo stato o attendi la revisione.',
    error: 'Non siamo riusciti a inviare la richiesta. Riprova tra qualche minuto.',
    restore: 'Recupero della richiesta…',
    required: 'Completa nome, paese ed età.',
    countryList: 'Seleziona il tuo paese',
    retry: 'Riprova',
  },
};

// Catálogo mundial estático de la app (40 países), NO la nómina del torneo.
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
const NAPOLI_2026_SLUG = 'nations-cup-napoli-2026';
const NAPOLI_2026_COUNTRIES = [
  {code: 'RO', flag: '🇷🇴', names: {es: 'Rumania', en: 'Romania', it: 'Romania'}},
  {code: 'ES', flag: '🇪🇸', names: {es: 'España', en: 'Spain', it: 'Spagna'}},
  {code: 'PT', flag: '🇵🇹', names: {es: 'Portugal', en: 'Portugal', it: 'Portogallo'}},
  {code: 'QA', flag: '🇶🇦', names: {es: 'Catar', en: 'Qatar', it: 'Qatar'}},
  {code: 'IT', flag: '🇮🇹', names: {es: 'Italia', en: 'Italy', it: 'Italia'}},
  {code: 'DE', flag: '🇩🇪', names: {es: 'Alemania', en: 'Germany', it: 'Germania'}},
  {code: 'FR', flag: '🇫🇷', names: {es: 'Francia', en: 'France', it: 'Francia'}},
  {code: 'BE', flag: '🇧🇪', names: {es: 'Bélgica', en: 'Belgium', it: 'Belgio'}},
  {code: 'AT', flag: '🇦🇹', names: {es: 'Austria', en: 'Austria', it: 'Austria'}},
  {code: 'EG', flag: '🇪🇬', names: {es: 'Egipto', en: 'Egypt', it: 'Egitto'}},
  {code: 'AE', flag: '🇦🇪', names: {es: 'Emiratos Árabes Unidos', en: 'United Arab Emirates', it: 'Emirati Arabi Uniti'}},
  {code: 'MX', flag: '🇲🇽', names: {es: 'México', en: 'Mexico', it: 'Messico'}},
  {code: 'SE', flag: '🇸🇪', names: {es: 'Suecia', en: 'Sweden', it: 'Svezia'}},
  {code: 'UA', flag: '🇺🇦', names: {es: 'Ucrania', en: 'Ukraine', it: 'Ucraina'}},
  {code: 'DK', flag: '🇩🇰', names: {es: 'Dinamarca', en: 'Denmark', it: 'Danimarca'}},
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
  const lang = (i18n?.language || 'es').slice(0, 2);
  const t = COPY[lang] || COPY.es;
  const actorId = session?.user?.id || null;
  const countryOptions = slug === NAPOLI_2026_SLUG
    ? NAPOLI_2026_COUNTRIES.map(({code, flag, names}) => [code, `${flag} ${names[lang] || names.es}`.trim()])
    : COUNTRIES;

  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(false);
  const [ignoreServerStatus, setIgnoreServerStatus] = useState(false);
  const [status, setStatus] = useState(null); // pendiente | aprobada | rechazada | en_revision
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [age, setAge] = useState('desconocido');
  const [guardianConsent, setGuardianConsent] = useState(false);
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
    setGuardianConsent(false); setConsent(false); setSending(false);
  }, [actorId, slug]);

  const apiBase = process.env.REACT_APP_API_URL || '';
  const token = session?.access_token || null;
  const emailVerified = Boolean(session?.user?.email_confirmed_at || session?.user?.confirmed_at);

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
      if (latest && !ignoreServerStatus) { setStatus(latest.status); if (latest.age_status) setAge(latest.age_status); }
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
    if (!name.trim() || !country) { setError(t.required); return; }
    if (age === 'menor' && !guardianConsent) { setError(t.required); return; }
    if (!consent) { setError(t.required); return; }
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
          age_status: age,
          guardian_consent: age === 'menor' ? guardianConsent : false,
          profile_consent: consent,
        }),
      });
      if (ticket !== epoch.current) return;
      const body = await res.json().catch(() => null);
      if (ticket !== epoch.current) return;
      if (res.status === 409) { setError(t.conflict); return; }
      if (!res.ok) { setError(t.error); return; }
      setStatus(body?.status || 'pendiente');
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
    const back = encodeURIComponent(`/nations-cup/${slug}/inscripcion`);
    return (
      <NationsPageShell eventLabel={t.event}>
        <section className="nations-card nations-card--center" aria-labelledby="nations-title">
          <span className="nations-icon-badge" aria-hidden="true"><NationsIcon name="lock" /></span>
          <h1 className="nations-title" id="nations-title">{t.title}</h1>
          <p className="nations-intro">{t.signIn}</p>
          <Link className="nations-button" to={`/login?redirect=${back}`}>{t.signInCta}</Link>
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
        <h1 className="nations-title" id="nations-title">{t.title}</h1>
        <p className="nations-intro">{t.intro}</p>

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
                <p>{t.error}</p>
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
              <h2>{t.pendingBadge}</h2>
            </div>
            <p>{t.pending}</p>
            <p className="nations-status__note">{t.pendingNote}</p>
          </section>
        ) : statusView === 'approved' ? (
          <section className="nations-status nations-status--approved" role="status">
            <div className="nations-status__head">
              <span className="nations-status__icon nations-status__icon--approved" aria-hidden="true"><NationsIcon name="check" /></span>
              <h2>{t.approvedBadge}</h2>
            </div>
            <p>{t.approved}</p>
            <Link className="nations-button nations-button--success" to="/mi-perfil">{t.approvedCta}</Link>
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
        ) : (
          <form className="nations-form" onSubmit={submit} aria-busy={sending || restoring}>
            {error ? (
              <div className="nations-alert nations-alert--error" role="alert">
                <span className="nations-alert__icon" aria-hidden="true"><NationsIcon name="alert" /></span>
                <p>{error}</p>
              </div>
            ) : null}

            <div className="nations-field">
              <label className="nations-label" htmlFor="nations-name">{t.name}</label>
              <input
                className="nations-input"
                id="nations-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={100}
              />
            </div>

            <div className="nations-field">
              <label className="nations-label" htmlFor="nations-country">{t.country}</label>
              <div className="nations-select-wrap">
                <select
                  className="nations-select"
                  id="nations-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="">{t.countryList}</option>
                  {countryOptions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                </select>
                <span className="nations-select__chevron" aria-hidden="true" />
              </div>
            </div>

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

            <label className="nations-check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span className="nations-check__box" aria-hidden="true" />
              <span className="nations-check__text">{t.consent}</span>
            </label>

            <button
              className="nations-button"
              type="submit"
              disabled={sending || restoring || !emailVerified}
            >
              {sending ? (
                <>
                  <span className="nations-spinner nations-spinner--button" aria-hidden="true" />
                  {t.sending}
                </>
              ) : (
                <>
                  {t.submit}
                  <span className="nations-button__arrow" aria-hidden="true"><NationsIcon name="arrow" /></span>
                </>
              )}
            </button>
          </form>
        )}
      </section>
    </NationsPageShell>
  );
}
