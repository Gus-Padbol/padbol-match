import { useMemo, useState } from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import './AdminSedeConfiguracionGuiada.css';

const STEPS = [
  { id: 'sede', label: 'Tu sede' },
  { id: 'cancha', label: 'Primera cancha' },
  { id: 'operacion', label: 'Horarios y precios' },
  { id: 'confirmar', label: 'Confirmar' },
];

const SPORTS = [
  { id: 'padbol', label: 'Padbol' },
  { id: 'padel', label: 'Pádel' },
  { id: 'pickleball', label: 'Pickleball' },
  { id: 'tenis', label: 'Tenis' },
];

function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function money(value, currency) {
  const amount = Number(String(value || '').replace(/\D/g, ''));
  if (!amount) return 'Sin definir';
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency || 'ARS',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency || 'ARS'} ${amount.toLocaleString('es-AR')}`;
  }
}

function initialDraft(venue) {
  return {
    nombre: venue?.nombre || '',
    ciudad: venue?.ciudad || '',
    pais: venue?.pais || '',
    moneda: venue?.moneda || 'ARS',
    horario_apertura: venue?.horario_apertura || '08:00',
    horario_cierre: venue?.horario_cierre || '23:00',
    precio_60min: digits(venue?.precio_60min),
    precio_90min: digits(venue?.precio_90min),
    precio_120min: digits(venue?.precio_120min),
    canchaNombre: '',
    canchaDeporte: 'padbol',
  };
}

export default function AdminSedeConfiguracionGuiada({ venue, existingCourts = [], onSave, busy = false }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => initialDraft(venue));
  const [message, setMessage] = useState('');

  const hasCourt = existingCourts.length > 0;
  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;
  const canContinue = useMemo(() => {
    if (current.id === 'sede') return Boolean(draft.nombre.trim() && draft.ciudad.trim() && draft.pais.trim());
    if (current.id === 'cancha') return hasCourt || Boolean(draft.canchaNombre.trim());
    if (current.id === 'operacion') {
      return Boolean(draft.horario_apertura && draft.horario_cierre && draft.precio_60min);
    }
    return true;
  }, [current.id, draft, hasCourt]);

  const start = () => {
    setDraft(initialDraft(venue));
    setStep(0);
    setMessage('');
    setOpen(true);
  };

  const close = () => {
    if (!busy) setOpen(false);
  };

  const update = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const next = () => {
    if (!canContinue) {
      setMessage('Completá los datos marcados para que Chivi pueda continuar.');
      return;
    }
    setMessage('');
    setStep((currentStep) => Math.min(STEPS.length - 1, currentStep + 1));
  };

  const save = async () => {
    setMessage('');
    const result = await onSave({
      venue: {
        nombre: draft.nombre.trim(),
        ciudad: draft.ciudad.trim(),
        pais: draft.pais.trim(),
        moneda: draft.moneda,
        horario_apertura: draft.horario_apertura,
        horario_cierre: draft.horario_cierre,
        precio_60min: draft.precio_60min,
        precio_90min: draft.precio_90min,
        precio_120min: draft.precio_120min,
      },
      court: hasCourt || !draft.canchaNombre.trim()
        ? null
        : { nombre: draft.canchaNombre.trim(), deporte: draft.canchaDeporte },
    });
    if (!result?.ok) {
      setMessage(result?.message || 'No se pudo guardar. Revisá la conexión e intentá de nuevo.');
      return;
    }
    setMessage('✅ Configuración guardada. Chivi dejó lista la base operativa de tu sede.');
    window.setTimeout(() => setOpen(false), 1300);
  };

  return (
    <section className="guided-setup" aria-labelledby="guided-setup-title">
      <div className="guided-setup__copy">
        <p className="guided-setup__eyebrow">{t('admin.sedes.guidedSetup.eyebrow', 'CHIVI OPERATIONS')}</p>
        <h3 id="guided-setup-title">{t('admin.sedes.guidedSetup.title', 'Set up your venue without getting lost in forms')}</h3>
        <p>
          {t('admin.sedes.guidedSetup.intro', 'Chivi organizes your setup: venue details, first court, hours and prices. At the end, you review a summary and only then are the real changes saved.')}
        </p>
      </div>
      <button type="button" className="guided-setup__start" onClick={start}>
        {t('admin.sedes.guidedSetup.start', 'Start guided setup')}
        <span aria-hidden="true">→</span>
      </button>

      {open ? (
        <div className="guided-setup__backdrop" role="presentation" onMouseDown={close}>
          <div
            className="guided-setup__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guided-setup-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="guided-setup__dialog-header">
              <div>
                <p>CHIVI · CONFIGURACIÓN GUIADA</p>
                <h2 id="guided-setup-dialog-title">{current.label}</h2>
              </div>
              <button type="button" className="guided-setup__close" aria-label="Cerrar" onClick={close} disabled={busy}>×</button>
            </header>

            <div className="guided-setup__progress" aria-label={`Paso ${step + 1} de ${STEPS.length}`}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <ol className="guided-setup__steps">
              {STEPS.map((item, index) => (
                <li key={item.id} className={index === step ? 'is-current' : index < step ? 'is-done' : ''}>
                  <span>{index + 1}</span>{item.label}
                </li>
              ))}
            </ol>

            <main className="guided-setup__body">
              {current.id === 'sede' ? (
                <>
                  <p className="guided-setup__lead">Empecemos por lo esencial. Estos datos identifican a tu sede y determinan la moneda que verá cada jugador.</p>
                  <div className="guided-setup__fields">
                    <label>Nombre de la sede<input value={draft.nombre} onChange={(e) => update('nombre', e.target.value)} placeholder="Ej. La Meca Padbol Club" autoFocus /></label>
                    <label>Ciudad<input value={draft.ciudad} onChange={(e) => update('ciudad', e.target.value)} placeholder="Ej. La Plata" /></label>
                    <label>País<input value={draft.pais} onChange={(e) => update('pais', e.target.value)} placeholder="Ej. Argentina" /></label>
                    <label>Moneda<select value={draft.moneda} onChange={(e) => update('moneda', e.target.value)}><option value="ARS">ARS · Peso argentino</option><option value="USD">USD · Dólar estadounidense</option><option value="EUR">EUR · Euro</option><option value="BRL">BRL · Real brasileño</option><option value="CLP">CLP · Peso chileno</option><option value="UYU">UY · Peso uruguayo</option></select></label>
                  </div>
                </>
              ) : null}

              {current.id === 'cancha' ? (
                <>
                  <p className="guided-setup__lead">
                    {hasCourt ? `Ya tenés ${existingCourts.length} cancha${existingCourts.length === 1 ? '' : 's'} cargada${existingCourts.length === 1 ? '' : 's'}. Chivi conservará esa información.` : 'Cargá tu primera cancha. Después podés sumar o editar todas las que necesites desde “Canchas”.'}
                  </p>
                  {!hasCourt ? (
                    <div className="guided-setup__fields">
                      <label>Nombre de la cancha<input value={draft.canchaNombre} onChange={(e) => update('canchaNombre', e.target.value)} placeholder="Ej. Cancha 1" autoFocus /></label>
                      <fieldset><legend>Deporte de esta cancha</legend><div className="guided-setup__choices">{SPORTS.map((sport) => <label key={sport.id} className={draft.canchaDeporte === sport.id ? 'is-selected' : ''}><input type="radio" name="guided-court-sport" value={sport.id} checked={draft.canchaDeporte === sport.id} onChange={() => update('canchaDeporte', sport.id)} />{sport.label}</label>)}</div></fieldset>
                    </div>
                  ) : null}
                </>
              ) : null}

              {current.id === 'operacion' ? (
                <>
                  <p className="guided-setup__lead">Definí el horario general y un precio base. Podés agregar franjas especiales, medios de pago y reglas avanzadas en los módulos de la sede cuando termines.</p>
                  <div className="guided-setup__fields guided-setup__fields--operation">
                    <label>Apertura<input type="time" value={draft.horario_apertura} onChange={(e) => update('horario_apertura', e.target.value)} /></label>
                    <label>Cierre<input type="time" value={draft.horario_cierre} onChange={(e) => update('horario_cierre', e.target.value)} /></label>
                    <label>Precio base · 60 min<input inputMode="numeric" value={draft.precio_60min} onChange={(e) => update('precio_60min', digits(e.target.value))} placeholder="0" /></label>
                    <label>Precio base · 90 min <small>Opcional</small><input inputMode="numeric" value={draft.precio_90min} onChange={(e) => update('precio_90min', digits(e.target.value))} placeholder="0" /></label>
                    <label>Precio base · 120 min <small>Opcional</small><input inputMode="numeric" value={draft.precio_120min} onChange={(e) => update('precio_120min', digits(e.target.value))} placeholder="0" /></label>
                  </div>
                  <aside className="guided-setup__notice"><strong>Regla operativa vigente</strong><br />Los partidos abiertos que no completan el grupo liberan la reserva 8 horas antes. Chivi la muestra como regla común: la política configurable por sede se agregará al módulo de reservas cuando la API la exponga.</aside>
                </>
              ) : null}

              {current.id === 'confirmar' ? (
                <>
                  <p className="guided-setup__lead">Revisá el resumen. Nada se guarda hasta que confirmes.</p>
                  <dl className="guided-setup__summary">
                    <div><dt>Sede</dt><dd>{draft.nombre || '—'}</dd></div>
                    <div><dt>Ubicación</dt><dd>{[draft.ciudad, draft.pais].filter(Boolean).join(', ') || '—'}</dd></div>
                    <div><dt>Cancha</dt><dd>{hasCourt ? `${existingCourts.length} existente${existingCourts.length === 1 ? '' : 's'}` : `${draft.canchaNombre || '—'} · ${SPORTS.find((sport) => sport.id === draft.canchaDeporte)?.label}`}</dd></div>
                    <div><dt>Horario</dt><dd>{draft.horario_apertura} a {draft.horario_cierre}</dd></div>
                    <div><dt>Precio 60 min</dt><dd>{money(draft.precio_60min, draft.moneda)}</dd></div>
                    {draft.precio_90min ? <div><dt>Precio 90 min</dt><dd>{money(draft.precio_90min, draft.moneda)}</dd></div> : null}
                    {draft.precio_120min ? <div><dt>Precio 120 min</dt><dd>{money(draft.precio_120min, draft.moneda)}</dd></div> : null}
                  </dl>
                </>
              ) : null}
              {message ? <p className={message.startsWith('✅') ? 'guided-setup__message is-success' : 'guided-setup__message'} role="status">{message}</p> : null}
            </main>

            <footer className="guided-setup__actions">
              <button type="button" className="guided-setup__secondary" onClick={() => step === 0 ? close() : setStep((value) => value - 1)} disabled={busy}>{step === 0 ? 'Cancelar' : 'Volver'}</button>
              {current.id === 'confirmar' ? <button type="button" className="guided-setup__primary" onClick={() => void save()} disabled={busy}>{busy ? 'Guardando…' : 'Confirmar y guardar'}</button> : <button type="button" className="guided-setup__primary" onClick={next}>Continuar</button>}
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}
