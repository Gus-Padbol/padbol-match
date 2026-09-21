import { useMemo, useState } from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { padbolLangToIntlLocale } from '../utils/padbolLang';
import './AdminSedeConfiguracionGuiada.css';

const STEPS = ['sede', 'cancha', 'operacion', 'confirmar'];
const SPORTS = ['padbol', 'padel', 'pickleball', 'tenis'];
const CURRENCIES = ['ARS', 'USD', 'EUR', 'BRL', 'CLP', 'UYU'];

function digits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function money(value, currency, locale, undefinedLabel) {
  const amount = Number(String(value || '').replace(/\D/g, ''));
  if (!amount) return undefinedLabel;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'ARS',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency || 'ARS'} ${amount.toLocaleString(locale)}`;
  }
}

function currencyLabel(code, locale) {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'currency' }).of(code);
    return `${code} · ${name}`;
  } catch {
    return code;
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
  const { t, i18n } = useTranslation();
  const locale = padbolLangToIntlLocale(i18n.language);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => initialDraft(venue));
  const [message, setMessage] = useState('');

  const hasCourt = existingCourts.length > 0;
  const current = STEPS[step];
  const stepLabel = (id) => t(`admin.sedes.guidedSetup.step.${id}`);
  const sportLabel = (id) => t(`torneos.deporte.${id}`);
  const progress = ((step + 1) / STEPS.length) * 100;
  const canContinue = useMemo(() => {
    if (current === 'sede') return Boolean(draft.nombre.trim() && draft.ciudad.trim() && draft.pais.trim());
    if (current === 'cancha') return hasCourt || Boolean(draft.canchaNombre.trim());
    if (current === 'operacion') {
      return Boolean(draft.horario_apertura && draft.horario_cierre && draft.precio_60min);
    }
    return true;
  }, [current, draft, hasCourt]);

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
      setMessage(t('admin.sedes.guidedSetup.missingRequired'));
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
      setMessage(result?.message || t('admin.sedes.guidedSetup.saveFailed'));
      return;
    }
    setMessage(t('admin.sedes.guidedSetup.saveSuccess'));
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
                <p>{t('admin.sedes.guidedSetup.dialogEyebrow')}</p>
                <h2 id="guided-setup-dialog-title">{stepLabel(current)}</h2>
              </div>
              <button type="button" className="guided-setup__close" aria-label={t('admin.sedes.guidedSetup.close')} onClick={close} disabled={busy}>×</button>
            </header>

            <div className="guided-setup__progress" aria-label={t('admin.sedes.guidedSetup.progress', { current: step + 1, total: STEPS.length })}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <ol className="guided-setup__steps">
              {STEPS.map((item, index) => (
                <li key={item} className={index === step ? 'is-current' : index < step ? 'is-done' : ''}>
                  <span>{index + 1}</span>{stepLabel(item)}
                </li>
              ))}
            </ol>

            <main className="guided-setup__body">
              {current === 'sede' ? (
                <>
                  <p className="guided-setup__lead">{t('admin.sedes.guidedSetup.venueLead')}</p>
                  <div className="guided-setup__fields">
                    <label>{t('admin.sedes.guidedSetup.venueName')}<input value={draft.nombre} onChange={(e) => update('nombre', e.target.value)} placeholder={t('admin.sedes.guidedSetup.venueNamePlaceholder')} autoFocus /></label>
                    <label>{t('admin.sedes.guidedSetup.city')}<input value={draft.ciudad} onChange={(e) => update('ciudad', e.target.value)} placeholder={t('admin.sedes.guidedSetup.cityPlaceholder')} /></label>
                    <label>{t('admin.sedes.guidedSetup.country')}<input value={draft.pais} onChange={(e) => update('pais', e.target.value)} placeholder={t('admin.sedes.guidedSetup.countryPlaceholder')} /></label>
                    <label>{t('admin.sedes.guidedSetup.currency')}<select value={draft.moneda} onChange={(e) => update('moneda', e.target.value)}>{CURRENCIES.map((code) => <option key={code} value={code}>{currencyLabel(code, locale)}</option>)}</select></label>
                  </div>
                </>
              ) : null}

              {current === 'cancha' ? (
                <>
                  <p className="guided-setup__lead">
                    {hasCourt
                      ? t('admin.sedes.guidedSetup.existingCourts', { count: existingCourts.length })
                      : t('admin.sedes.guidedSetup.firstCourtLead')}
                  </p>
                  {!hasCourt ? (
                    <div className="guided-setup__fields">
                      <label>{t('admin.sedes.guidedSetup.courtName')}<input value={draft.canchaNombre} onChange={(e) => update('canchaNombre', e.target.value)} placeholder={t('admin.sedes.guidedSetup.courtNamePlaceholder')} autoFocus /></label>
                      <fieldset><legend>{t('admin.sedes.guidedSetup.courtSport')}</legend><div className="guided-setup__choices">{SPORTS.map((sport) => <label key={sport} className={draft.canchaDeporte === sport ? 'is-selected' : ''}><input type="radio" name="guided-court-sport" value={sport} checked={draft.canchaDeporte === sport} onChange={() => update('canchaDeporte', sport)} />{sportLabel(sport)}</label>)}</div></fieldset>
                    </div>
                  ) : null}
                </>
              ) : null}

              {current === 'operacion' ? (
                <>
                  <p className="guided-setup__lead">{t('admin.sedes.guidedSetup.operationLead')}</p>
                  <div className="guided-setup__fields guided-setup__fields--operation">
                    <label>{t('admin.sedes.guidedSetup.opening')}<input type="time" value={draft.horario_apertura} onChange={(e) => update('horario_apertura', e.target.value)} /></label>
                    <label>{t('admin.sedes.guidedSetup.closing')}<input type="time" value={draft.horario_cierre} onChange={(e) => update('horario_cierre', e.target.value)} /></label>
                    <label>{t('admin.sedes.guidedSetup.basePrice', { min: 60 })}<input inputMode="numeric" value={draft.precio_60min} onChange={(e) => update('precio_60min', digits(e.target.value))} placeholder="0" /></label>
                    <label>{t('admin.sedes.guidedSetup.basePrice', { min: 90 })} <small>{t('admin.sedes.guidedSetup.optional')}</small><input inputMode="numeric" value={draft.precio_90min} onChange={(e) => update('precio_90min', digits(e.target.value))} placeholder="0" /></label>
                    <label>{t('admin.sedes.guidedSetup.basePrice', { min: 120 })} <small>{t('admin.sedes.guidedSetup.optional')}</small><input inputMode="numeric" value={draft.precio_120min} onChange={(e) => update('precio_120min', digits(e.target.value))} placeholder="0" /></label>
                  </div>
                  <aside className="guided-setup__notice"><strong>{t('admin.sedes.guidedSetup.currentRuleTitle')}</strong><br />{t('admin.sedes.guidedSetup.currentRuleBody')}</aside>
                </>
              ) : null}

              {current === 'confirmar' ? (
                <>
                  <p className="guided-setup__lead">{t('admin.sedes.guidedSetup.reviewLead')}</p>
                  <dl className="guided-setup__summary">
                    <div><dt>{t('admin.sedes.guidedSetup.summaryVenue')}</dt><dd>{draft.nombre || '—'}</dd></div>
                    <div><dt>{t('admin.sedes.guidedSetup.summaryLocation')}</dt><dd>{[draft.ciudad, draft.pais].filter(Boolean).join(', ') || '—'}</dd></div>
                    <div><dt>{t('admin.sedes.guidedSetup.summaryCourt')}</dt><dd>{hasCourt ? t('admin.sedes.guidedSetup.existingCourtsShort', { count: existingCourts.length }) : `${draft.canchaNombre || '—'} · ${sportLabel(draft.canchaDeporte)}`}</dd></div>
                    <div><dt>{t('admin.sedes.guidedSetup.summaryHours')}</dt><dd>{t('admin.sedes.guidedSetup.hoursRange', { open: draft.horario_apertura, close: draft.horario_cierre })}</dd></div>
                    <div><dt>{t('admin.sedes.guidedSetup.summaryPrice', { min: 60 })}</dt><dd>{money(draft.precio_60min, draft.moneda, locale, t('admin.sedes.guidedSetup.undefinedMoney'))}</dd></div>
                    {draft.precio_90min ? <div><dt>{t('admin.sedes.guidedSetup.summaryPrice', { min: 90 })}</dt><dd>{money(draft.precio_90min, draft.moneda, locale, t('admin.sedes.guidedSetup.undefinedMoney'))}</dd></div> : null}
                    {draft.precio_120min ? <div><dt>{t('admin.sedes.guidedSetup.summaryPrice', { min: 120 })}</dt><dd>{money(draft.precio_120min, draft.moneda, locale, t('admin.sedes.guidedSetup.undefinedMoney'))}</dd></div> : null}
                  </dl>
                </>
              ) : null}
              {message ? <p className={message.startsWith('✅') ? 'guided-setup__message is-success' : 'guided-setup__message'} role="status">{message}</p> : null}
            </main>

            <footer className="guided-setup__actions">
              <button type="button" className="guided-setup__secondary" onClick={() => step === 0 ? close() : setStep((value) => value - 1)} disabled={busy}>{step === 0 ? t('admin.sedes.guidedSetup.cancel') : t('admin.sedes.guidedSetup.back')}</button>
              {current === 'confirmar' ? <button type="button" className="guided-setup__primary" onClick={() => void save()} disabled={busy}>{busy ? t('admin.sedes.guidedSetup.saving') : t('admin.sedes.guidedSetup.confirmSave')}</button> : <button type="button" className="guided-setup__primary" onClick={next}>{t('admin.sedes.guidedSetup.continue')}</button>}
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}
