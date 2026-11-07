import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useSafeTranslation} from '../i18n/tSafe';

const COPY = {
  es: {
    title: 'Completá tus datos para la Nations Cup',
    intro: 'Enviás una solicitud privada. La organización revisa tu identidad antes de habilitarte.',
    signIn: 'Iniciá sesión con tu cuenta verificada para continuar.',
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
    pending: 'Solicitud recibida. Queda pendiente de revisión de la organización.',
    pendingNote: 'No se habilita automáticamente por nombre y país.',
    approved: 'Tu solicitud fue aprobada. Ya podés entrar a tu perfil.',
    approvedCta: 'Ir a mi perfil',
    rejected: 'La solicitud no fue aprobada. Podés corregir los datos y enviar una nueva.',
    newRequest: 'Enviar nueva solicitud',
    conflict: 'Ya tenés una solicitud activa para este evento. Revisá el estado o esperá la revisión.',
    error: 'No pudimos enviar la solicitud. Reintentá en unos minutos.',
    restore: 'Recuperando tu solicitud…',
    required: 'Completá nombre, país y edad.',
    countryList: 'Seleccioná tu país',
  },
  en: {
    title: 'Complete your details for the Nations Cup',
    intro: 'You are sending a private request. The organisation reviews your identity before activation.',
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
    pending: 'Request received. It is pending review by the organisation.',
    pendingNote: 'It is not activated automatically by name and country.',
    approved: 'Your request was approved. You can open your profile.',
    approvedCta: 'Go to my profile',
    rejected: 'The request was not approved. You can fix the details and send a new one.',
    newRequest: 'Send a new request',
    conflict: 'You already have an active request for this event. Check its status or wait for review.',
    error: 'We could not send the request. Try again in a few minutes.',
    restore: 'Restoring your request…',
    required: 'Complete name, country and age.',
    countryList: 'Select your country',
  },
  it: {
    title: 'Completa i tuoi dati per la Nations Cup',
    intro: 'Invii una richiesta privata. L’organizzazione verifica la tua identità prima di attivarti.',
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
    pending: 'Richiesta ricevuta. È in attesa di revisione da parte dell’organizzazione.',
    pendingNote: 'Non viene attivata automaticamente per nome e paese.',
    approved: 'La richiesta è stata approvata. Puoi aprire il tuo profilo.',
    approvedCta: 'Vai al mio profilo',
    rejected: 'La richiesta non è stata approvata. Puoi correggere i dati e inviarne una nuova.',
    newRequest: 'Invia una nuova richiesta',
    conflict: 'Hai già una richiesta attiva per questo evento. Controlla lo stato o attendi la revisione.',
    error: 'Non siamo riusciti a inviare la richiesta. Riprova tra qualche minuto.',
    restore: 'Recupero della richiesta…',
    required: 'Completa nome, paese ed età.',
    countryList: 'Seleziona il tuo paese',
  },
};

const COUNTRIES = [
  ['IT', 'Italia'], ['ES', 'España'], ['FR', 'France'], ['DE', 'Deutschland'], ['PT', 'Portugal'],
  ['RO', 'România'], ['BE', 'België'], ['SE', 'Sverige'], ['DK', 'Danmark'], ['UA', 'Україна'],
  ['MX', 'México'], ['EG', 'مصر'], ['QA', 'قطر'], ['AE', 'الإمارات'], ['AR', 'Argentina'],
];

const keyFor = (actor, slug) => `nationsProfileRequest:${actor}:${slug}`;
function newRequestId() {
  try { return crypto.randomUUID(); } catch { return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
}

export default function NationsInscripcion() {
  const {slug = ''} = useParams();
  const {session, loading, getAccessToken} = useAuth();
  const {i18n} = useSafeTranslation();
  const lang = (i18n?.language || 'es').slice(0, 2);
  const t = COPY[lang] || COPY.es;
  const actorId = session?.user?.id || null;

  const [restoring, setRestoring] = useState(false);
  const [status, setStatus] = useState(null); // pendiente | aprobada | rechazada | en_revision
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [age, setAge] = useState('desconocido');
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const epoch = useRef(0);

  const requestId = useMemo(() => {
    if (!actorId || !slug) return null;
    const existing = sessionStorage.getItem(keyFor(actorId, slug));
    if (existing) return existing;
    const fresh = newRequestId();
    sessionStorage.setItem(keyFor(actorId, slug), fresh);
    return fresh;
  }, [actorId, slug]);

  // Cambio de actor o de evento: se limpia todo el estado local y se ignoran respuestas viejas.
  useEffect(() => {
    epoch.current += 1;
    setStatus(null); setError(null); setName(''); setCountry(''); setAge('desconocido');
    setGuardianConsent(false); setConsent(false); setSending(false);
  }, [actorId, slug]);

  const apiBase = process.env.REACT_APP_API_URL || '';
  const token = typeof getAccessToken === 'function' ? getAccessToken() : session?.access_token;

  const loadStatus = useCallback(async () => {
    if (!actorId || !slug) return;
    const ticket = epoch.current;
    setRestoring(true);
    try {
      const res = await fetch(`${apiBase}/api/nations-activation/events/${encodeURIComponent(slug)}/profile-request`, {
        headers: token ? {Authorization: `Bearer ${token}`} : {},
      });
      if (ticket !== epoch.current) return;
      if (!res.ok) return;
      const body = await res.json().catch(() => null);
      if (ticket !== epoch.current) return;
      const latest = Array.isArray(body?.requests) ? body.requests[0] : null;
      if (latest) { setStatus(latest.status); if (latest.age_status) setAge(latest.age_status); }
    } finally {
      if (ticket === epoch.current) setRestoring(false);
    }
  }, [actorId, slug, apiBase, token]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const submit = async (event) => {
    event.preventDefault();
    if (sending || !requestId) return;
    setError(null);
    if (!name.trim() || !country) { setError(t.required); return; }
    if (age === 'menor' && !guardianConsent) { setError(t.required); return; }
    if (!consent) { setError(t.required); return; }
    setSending(true);
    const ticket = epoch.current;
    try {
      const res = await fetch(`${apiBase}/api/nations-activation/events/${encodeURIComponent(slug)}/profile-request`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
        body: JSON.stringify({
          request_id: requestId,
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
      if (ticket === epoch.current) setSending(false);
    }
  };

  const startNew = () => {
    if (!actorId) return;
    sessionStorage.removeItem(keyFor(actorId, slug));
    setStatus(null); setError(null);
    window.location.reload();
  };

  if (loading) return <main className="nations-form"><p>{t.restore}</p></main>;

  if (!session?.user) {
    const back = encodeURIComponent(`/nations-cup/${slug}/inscripcion`);
    return (
      <main className="nations-form">
        <h1>{t.title}</h1>
        <p>{t.signIn}</p>
        <Link to={`/login?redirect=${back}`}>{t.signInCta}</Link>
      </main>
    );
  }

  return (
    <main className="nations-form">
      <h1>{t.title}</h1>
      <p>{t.intro}</p>

      {restoring ? <p role="status">{t.restore}</p> : null}

      {status === 'pendiente' || status === 'en_revision' ? (
        <section role="status">
          <p>{t.pending}</p>
          <p className="nations-form__note">{t.pendingNote}</p>
        </section>
      ) : status === 'aprobada' ? (
        <section role="status">
          <p>{t.approved}</p>
          <Link to="/mi-perfil">{t.approvedCta}</Link>
        </section>
      ) : status === 'rechazada' ? (
        <section role="alert">
          <p>{t.rejected}</p>
          <button type="button" onClick={startNew}>{t.newRequest}</button>
        </section>
      ) : (
        <form onSubmit={submit}>
          {error ? <p role="alert">{error}</p> : null}
          <label>{t.name}
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={100} />
          </label>
          <label>{t.country}
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">{t.countryList}</option>
              {COUNTRIES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </label>
          <fieldset>
            <legend>{t.age}</legend>
            {[['adulto', t.adult], ['menor', t.minor], ['desconocido', t.unknown]].map(([value, label]) => (
              <label key={value}>
                <input type="radio" name="age" value={value} checked={age === value} onChange={() => setAge(value)} />
                {label}
              </label>
            ))}
          </fieldset>
          {age === 'menor' ? (
            <label>
              <input type="checkbox" checked={guardianConsent} onChange={(e) => setGuardianConsent(e.target.checked)} />
              {t.guardian}
            </label>
          ) : null}
          <label>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            {t.consent}
          </label>
          <button type="submit" disabled={sending}>{sending ? t.sending : t.submit}</button>
        </form>
      )}
    </main>
  );
}
