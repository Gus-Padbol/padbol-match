import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGooglePlaces } from '../hooks/useGooglePlaces';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';

const PAISES_SEDE_OPTIONS = [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS]
  .map((p) => ({ value: `${p.bandera} ${p.nombre}`.trim(), label: `${p.bandera} ${p.nombre}`.trim(), codigo: p.codigo }))
  .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));

const DEPORTES_CATALOGO = DEPORTES_CANCHA_SEDE_OPTIONS;

const inputBase = {
  minHeight: 48,
  fontSize: 16,
  padding: '12px 14px',
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box',
  borderRadius: 10,
  border: '1px solid #cbd5e1',
  WebkitAppearance: 'none',
};

function normalizeText(v) {
  const { t } = useTranslation();
  return String(v || '')
    .replace(/^[\p{Emoji_Presentation}\s]+/u, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const TZ_SEDE_DEFAULT = 'America/Argentina/Buenos_Aires';

/** Opciones IANA según país (etiqueta del select de país incluye bandera + nombre). */
function timezoneOptionsForPais(paisLabel) {
  const key = normalizeText(paisLabel);
  if (!key) return [{ value: TZ_SEDE_DEFAULT, label: 'Argentina (ART)' }];
  if (key.includes('argentina')) {
    return [{ value: TZ_SEDE_DEFAULT, label: 'Argentina — America/Argentina/Buenos_Aires' }];
  }
  if (key.includes('estados unidos') || key.includes('united states') || /\busa\b/.test(key)) {
    return [
      { value: 'America/New_York', label: 'Este (Miami, NY) — America/New_York' },
      { value: 'America/Chicago', label: 'Centro — America/Chicago' },
      { value: 'America/Denver', label: 'Montaña — America/Denver' },
      { value: 'America/Los_Angeles', label: 'Pacífico — America/Los_Angeles' },
    ];
  }
  if (key.includes('espana') || key.includes('spain')) {
    return [{ value: 'Europe/Madrid', label: 'España peninsular — Europe/Madrid' }];
  }
  if (key.includes('uruguay')) return [{ value: 'America/Montevideo', label: 'Uruguay — America/Montevideo' }];
  if (key.includes('chile')) return [{ value: 'America/Santiago', label: 'Chile — America/Santiago' }];
  if (key.includes('brasil') || key.includes('brazil')) {
    return [{ value: 'America/Sao_Paulo', label: 'Brasil (este) — America/Sao_Paulo' }];
  }
  if (key.includes('colombia')) return [{ value: 'America/Bogota', label: 'Colombia — America/Bogota' }];
  if (key.includes('mexico')) return [{ value: 'America/Mexico_City', label: 'México central — America/Mexico_City' }];
  if (key.includes('paraguay')) return [{ value: 'America/Asuncion', label: 'Paraguay — America/Asuncion' }];
  return [{ value: 'Etc/UTC', label: 'UTC (configura la zona en el panel si no aplica)' }];
}

function mapCountryToPaisOption(countryName) {
  const cn = normalizeText(countryName);
  if (!cn) return '';
  const hit = PAISES_SEDE_OPTIONS.find((opt) => {
    const labelNorm = normalizeText(opt.label);
    if (!labelNorm) return false;
    return labelNorm.includes(cn) || cn.includes(labelNorm);
  });
  return hit?.value || '';
}

function componentByType(parts, type) {
  return (parts || []).find((p) => Array.isArray(p.types) && p.types.includes(type)) || null;
}

function matchPlanForTotal(planes, total) {
  const n = Math.max(0, Math.floor(Number(total) || 0));
  const list = [...(planes || [])].sort((a, b) => Number(a.canchas_min) - Number(b.canchas_min));
  for (const p of list) {
    const min = Number(p.canchas_min);
    const maxRaw = p.canchas_max;
    const max = maxRaw == null || maxRaw === '' ? null : Number(maxRaw);
    if (!Number.isFinite(min) || min < 0) continue;
    if (n < min) continue;
    if (max != null && Number.isFinite(max) && n > max) continue;
    return p;
  }
  return null;
}

function formatRangoCanchasPlan(p) {
  if (!p) return '';
  const maxV = p.canchas_max;
  if (maxV == null || maxV === '') return `${p.canchas_min}+`;
  if (Number(p.canchas_min) === Number(maxV)) return `${p.canchas_min}`;
  return `${p.canchas_min}–${maxV}`;
}

const initialState = () => ({
  step: 1,
  nombre: '',
  pais: '',
  /** IANA TZ para reservas (default AR). */
  timezone: TZ_SEDE_DEFAULT,
  provincia: '',
  ciudad: '',
  direccion: '',
  codigo_postal: '',
  latitud: null,
  longitud: null,
  /** dep key -> string count */
  canchasPorDeporte: {},
  email_contacto: '',
  telefonoCodigo: '+54',
  telefonoLocal: '',
});

export default function NuevaSedeSuperBottomSheet({
  open,
  onClose,
  apiBaseUrl,
  accessToken,
  onSuccess,
  /** Si está definido, el guardado usa POST /api/invitacion/:token/completar (sin JWT). */
  inviteToken = null,
  /** { email, pais, nombre_club } desde GET /api/invitacion/:token */
  invitePrefill = null,
}) {
  const [st, setSt] = useState(initialState);
  const [planPricing, setPlanPricing] = useState([]);
  const [planPricingLoading, setPlanPricingLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [placesInputValue, setPlacesInputValue] = useState('');
  /** Input DOM al que se adjunta `google.maps.places.Autocomplete`. */
  const direccionInputRef = useRef(null);
  /** Instancia devuelta por `new google.maps.places.Autocomplete(...)` (cleanup de listeners). */
  const googlePlacesAutocompleteRef = useRef(null);
  const { isLoaded: placesLoaded, placesEnabled } = useGooglePlaces();
  const invitePrefillKey = inviteToken
    ? `${invitePrefill?.email || ''}|${invitePrefill?.pais || ''}|${invitePrefill?.nombre_club || ''}`
    : '';

  useEffect(() => {
    if (!open) return;
    const base = initialState();
    if (inviteToken && invitePrefill) {
      setSt({
        ...base,
        nombre: String(invitePrefill.nombre_club || '').trim() || base.nombre,
        pais: String(invitePrefill.pais || '').trim() || base.pais,
        email_contacto: String(invitePrefill.email || '').trim().toLowerCase() || base.email_contacto,
      });
    } else {
      setSt(base);
    }
    setPlacesInputValue('');
    setPlanPricingLoading(true);
    fetch(`${apiBaseUrl}/api/plan-pricing`)
      .then((r) => r.json())
      .then((data) => setPlanPricing(Array.isArray(data) ? data : []))
      .catch(() => setPlanPricing([]))
      .finally(() => setPlanPricingLoading(false));
  }, [open, apiBaseUrl, inviteToken, invitePrefillKey]);

  useEffect(() => {
    setPlacesInputValue(String(st.direccion || ''));
  }, [st.direccion]);

  const setField = useCallback((key, val) => {
    setSt((prev) => ({ ...prev, [key]: val }));
  }, []);

  const totalCanchas = useMemo(() => {
    let s = 0;
    for (const d of DEPORTES_CATALOGO) {
      const raw = st.canchasPorDeporte[d.key];
      if (!raw || String(raw).trim() === '') continue;
      const n = parseInt(String(raw), 10);
      if (Number.isFinite(n) && n > 0) s += n;
    }
    return s;
  }, [st.canchasPorDeporte]);

  const planMatch = useMemo(() => matchPlanForTotal(planPricing, totalCanchas), [planPricing, totalCanchas]);

  const timezoneOpts = useMemo(() => timezoneOptionsForPais(st.pais), [st.pais]);

  useEffect(() => {
    if (!timezoneOpts.length) return;
    const valid = timezoneOpts.some((o) => o.value === st.timezone);
    if (!valid) setSt((p) => ({ ...p, timezone: timezoneOpts[0].value }));
  }, [timezoneOpts, st.timezone]);

  const goNext = useCallback(() => {
    if (st.step === 1) {
      if (!String(st.nombre || '').trim()) {
        alert('Completa el nombre de la sede.');
        return;
      }
      if (!String(st.direccion || '').trim()) {
        alert('Completa la dirección.');
        return;
      }
      if (!String(st.pais || '').trim()) {
        alert('Selecciona el país.');
        return;
      }
      if (!String(st.ciudad || '').trim()) {
        alert('Completa la ciudad.');
        return;
      }
      setSt((p) => ({ ...p, step: 2 }));
      return;
    }
    if (st.step === 2) {
      if (totalCanchas <= 0) {
        alert('Selecciona al menos un deporte e indica la cantidad de canchas (mayor a 0).');
        return;
      }
      setSt((p) => ({ ...p, step: 3 }));
    }
  }, [st, totalCanchas]);

  const goPrev = useCallback(() => {
    setSt((p) => ({ ...p, step: Math.max(1, p.step - 1) }));
  }, []);

  const crearSede = useCallback(async () => {
    if (!String(st.email_contacto || '').trim()) {
      alert('El email de contacto es obligatorio.');
      return;
    }
    if (!String(st.telefonoLocal || '').trim()) {
      alert('El teléfono / WhatsApp es obligatorio.');
      return;
    }
    const telefonoFull = `${String(st.telefonoCodigo || '').trim()} ${String(st.telefonoLocal || '').trim()}`.trim();
    setSaving(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const body = {
        nombre: String(st.nombre || '').trim(),
        pais: String(st.pais || '').trim(),
        timezone: String(st.timezone || TZ_SEDE_DEFAULT).trim() || TZ_SEDE_DEFAULT,
        provincia: String(st.provincia || '').trim() || null,
        ciudad: String(st.ciudad || '').trim(),
        direccion: String(st.direccion || '').trim() || null,
        email_contacto: String(st.email_contacto || '').trim().toLowerCase(),
        telefono: telefonoFull,
        metodo_pago: 'mercadopago',
        precio_turno: null,
        moneda: 'ARS',
        google_maps_url: null,
        latitud: st.latitud != null ? Number(st.latitud) : null,
        longitud: st.longitud != null ? Number(st.longitud) : null,
        horario_apertura: null,
        horario_cierre: null,
        cantidad_canchas: totalCanchas,
        skip_autogen_canchas: true,
      };

      const deportesPayload = [];
      for (const d of DEPORTES_CATALOGO) {
        const raw = st.canchasPorDeporte[d.key];
        const n = parseInt(String(raw || ''), 10);
        if (Number.isFinite(n) && n > 0) deportesPayload.push({ deporte: d.key, cantidad: n });
      }

      if (inviteToken) {
        const res = await fetch(`${apiBaseUrl}/api/invitacion/${encodeURIComponent(inviteToken)}/completar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...body,
            deportes: deportesPayload,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || 'No se pudo completar el alta');
        onSuccess?.(j.sede || j, j.deportes || deportesPayload);
        onClose?.();
        return;
      }

      const res = await fetch(`${apiBaseUrl}/api/sedes`, { method: 'POST', headers, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'No se pudo crear la sede');

      const res2 = await fetch(`${apiBaseUrl}/api/sedes/${j.id}/deportes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ deportes: deportesPayload }),
      });
      const j2 = await res2.json().catch(() => ({}));
      if (!res2.ok) {
        throw new Error(j2?.error || 'La sede se creó pero no se guardaron los deportes. Revisa la tabla canchas_por_deporte en Supabase.');
      }

      onSuccess?.(j, j2.deportes || []);
      onClose?.();
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }, [apiBaseUrl, accessToken, inviteToken, onClose, onSuccess, st, totalCanchas]);

  const applyPlaceFromGoogle = useCallback((place) => {
    try {
      if (!place) return;
      const comps = Array.isArray(place.address_components) ? place.address_components : [];
      const route = componentByType(comps, 'route')?.long_name || '';
      const streetNumber = componentByType(comps, 'street_number')?.long_name || '';
      const city =
        componentByType(comps, 'locality')?.long_name ||
        componentByType(comps, 'postal_town')?.long_name ||
        componentByType(comps, 'administrative_area_level_2')?.long_name ||
        '';
      const province = componentByType(comps, 'administrative_area_level_1')?.long_name || '';
      const countryLong = componentByType(comps, 'country')?.long_name || '';
      const postalCode = componentByType(comps, 'postal_code')?.long_name || '';
      const formattedAddress = String(place.formatted_address || '').trim();
      const direccionCompuesta = [route, streetNumber].filter(Boolean).join(' ').trim();
      const typedFallback = String(direccionInputRef.current?.value || '').trim();
      const direccionFinal = direccionCompuesta || formattedAddress || typedFallback;
      const lat = typeof place.geometry?.location?.lat === 'function' ? place.geometry.location.lat() : null;
      const lng = typeof place.geometry?.location?.lng === 'function' ? place.geometry.location.lng() : null;
      const mappedCountry = mapCountryToPaisOption(countryLong);

      setPlacesInputValue(direccionFinal);
      setSt((prev) => ({
        ...prev,
        direccion: direccionFinal || prev.direccion,
        ciudad: city || prev.ciudad,
        provincia: province || prev.provincia,
        pais: mappedCountry || prev.pais,
        codigo_postal: postalCode || prev.codigo_postal || '',
        latitud: Number.isFinite(lat) ? lat : prev.latitud,
        longitud: Number.isFinite(lng) ? lng : prev.longitud,
      }));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!placesEnabled || !placesLoaded || !open || st.step !== 1) {
      const ac = googlePlacesAutocompleteRef.current;
      if (ac && typeof window !== 'undefined' && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(ac);
      }
      googlePlacesAutocompleteRef.current = null;
      return undefined;
    }

    const input = direccionInputRef.current;
    const Places = window.google?.maps?.places;
    if (!input || !Places?.Autocomplete) return undefined;

    const ac = new Places.Autocomplete(input, {
      fields: ['address_components', 'formatted_address', 'geometry'],
      types: ['address'],
    });
    googlePlacesAutocompleteRef.current = ac;

    const listener = ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place) return;
      applyPlaceFromGoogle(place);
    });

    return () => {
      listener?.remove();
      if (googlePlacesAutocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(googlePlacesAutocompleteRef.current);
      }
      googlePlacesAutocompleteRef.current = null;
    };
  }, [placesEnabled, placesLoaded, open, st.step, applyPlaceFromGoogle]);

  if (!open) return null;

  const sheetInner = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nueva-sede-sheet-title"
      onClick={(ev) => ev.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: 560,
        margin: '0 auto',
        height: 'min(95vh, calc(100dvh - 8px))',
        maxHeight: 'min(95vh, calc(100dvh - 8px))',
        background: 'var(--bg-card)',
        borderRadius: '16px 16px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: '14px 16px 10px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 id="nueva-sede-sheet-title" style={{ margin: 0, fontSize: 18, color: '#0f172a', fontWeight: 800 }}>
            {inviteToken ? 'Completar alta de tu sede' : 'Nueva sede'}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b', fontWeight: 600 }}>
            Paso {st.step} de 3
            {inviteToken ? ' · invitación Padbol Match' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => !saving && onClose?.()}
          disabled={saving}
          aria-label={t('general.close')}
          style={{
            flexShrink: 0,
            width: 44,
            height: 44,
            borderRadius: 12,
            border: 'none',
            background: '#f1f5f9',
            fontSize: 22,
            lineHeight: 1,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ flexShrink: 0, padding: '10px 16px 12px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 999,
                background: st.step >= n ? '#E11B22' : '#e2e8f0',
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 16px 20px', WebkitOverflowScrolling: 'touch' }}>
        {st.step === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ fontWeight: 700, fontSize: 14, color: '#334155' }}>
              Nombre de la sede *
              <input
                type="text"
                value={st.nombre}
                onChange={(e) => setField('nombre', e.target.value)}
                placeholder="Ej: Club Padbol Norte"
                style={{ ...inputBase, marginTop: 8 }}
                autoComplete="organization"
              />
            </label>
            <label style={{ fontWeight: 700, fontSize: 14, color: '#334155' }}>
              País *
              <select
                value={st.pais}
                onChange={(e) => setField('pais', e.target.value)}
                style={{ ...inputBase, marginTop: 8 }}
              >
                <option value="">Seleccionar país</option>
                {PAISES_SEDE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {st.pais ? (
              <label style={{ fontWeight: 700, fontSize: 14, color: '#334155' }}>
                Zona horaria (reservas) *
                <select
                  value={st.timezone}
                  onChange={(e) => setField('timezone', e.target.value)}
                  style={{ ...inputBase, marginTop: 8 }}
                >
                  {timezoneOpts.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label style={{ fontWeight: 700, fontSize: 14, color: '#334155' }}>
              Provincia / Estado
              <input
                type="text"
                value={st.provincia}
                onChange={(e) => setField('provincia', e.target.value)}
                placeholder="Provincia o estado"
                style={{ ...inputBase, marginTop: 8 }}
              />
            </label>
            <label style={{ fontWeight: 700, fontSize: 14, color: '#334155' }}>
              Ciudad *
              <input
                type="text"
                value={st.ciudad}
                onChange={(e) => setField('ciudad', e.target.value)}
                placeholder="Ciudad"
                style={{ ...inputBase, marginTop: 8 }}
              />
            </label>
            <label style={{ fontWeight: 700, fontSize: 14, color: '#334155' }}>
              Dirección *
              {placesEnabled && placesLoaded ? (
                <input
                  ref={direccionInputRef}
                  type="text"
                  value={placesInputValue}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPlacesInputValue(v);
                    setField('direccion', v);
                  }}
                  placeholder="Busca una dirección real"
                  style={{ ...inputBase, marginTop: 8 }}
                  autoComplete="off"
                />
              ) : (
                <input
                  type="text"
                  value={st.direccion}
                  onChange={(e) => setField('direccion', e.target.value)}
                  placeholder={
                    placesEnabled ? 'Cargando Google Places…' : 'Configura REACT_APP_GOOGLE_PLACES_KEY'
                  }
                  style={{ ...inputBase, marginTop: 8 }}
                  autoComplete="street-address"
                />
              )}
            </label>
          </div>
        ) : null}

        {st.step === 2 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.45 }}>
              Marca los deportes que ofrece el club e indica cuántas canchas tiene de cada uno.
            </p>
            {DEPORTES_CATALOGO.map((d) => {
              const checked = Object.prototype.hasOwnProperty.call(st.canchasPorDeporte, d.key);
              const count = st.canchasPorDeporte[d.key] ?? '';
              return (
                <div
                  key={d.key}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 12,
                    background: checked ? '#f8fafc' : '#fff',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSt((prev) => {
                          const next = { ...prev.canchasPorDeporte };
                          if (e.target.checked) next[d.key] = '1';
                          else delete next[d.key];
                          return { ...prev, canchasPorDeporte: next };
                        });
                      }}
                      style={{ width: 22, height: 22 }}
                    />
                    {d.label}
                  </label>
                  {checked ? (
                    <label style={{ display: 'block', marginTop: 10, fontWeight: 600, fontSize: 14, color: '#475569' }}>
                      Cantidad de canchas de {d.label}
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={count}
                        onChange={(e) =>
                          setSt((prev) => ({
                            ...prev,
                            canchasPorDeporte: { ...prev.canchasPorDeporte, [d.key]: e.target.value },
                          }))
                        }
                        style={{ ...inputBase, marginTop: 8 }}
                      />
                    </label>
                  ) : null}
                </div>
              );
            })}
            <div
              style={{
                marginTop: 4,
                padding: 14,
                borderRadius: 12,
                background: '#eef2ff',
                border: '1px solid #c7d2fe',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 800, color: '#312e81' }}>
                Total de canchas declaradas: {totalCanchas}
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: '#b91c1c', lineHeight: 1.45 }}>
                {planPricingLoading ? (
                  'Cargando planes…'
                ) : planMatch ? (
                  <>
                    Plan sugerido: <strong>{planMatch.nombre}</strong> ({formatRangoCanchasPlan(planMatch)} canchas) —{' '}
                    <strong>US$ {Number(planMatch.precio_usd).toFixed(2)}</strong> / mes
                  </>
                ) : totalCanchas > 0 ? (
                  'No hay un plan configurado para esta cantidad. Revisa plan_pricing en Supabase.'
                ) : (
                  'Elige deportes y cantidades para ver el plan.'
                )}
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#64748b' }}>
                Este total se guarda como límite máximo de canchas activas del club.
              </p>
            </div>
          </div>
        ) : null}

        {st.step === 3 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.45 }}>
              {inviteToken
                ? 'El email debe ser el mismo que recibió la invitación. Después del alta podrás ingresar al panel como admin del club (revisa tu correo para definir la contraseña).'
                : 'Precio, mapa, método de pago y el resto los configura el admin del club desde su panel después del alta.'}
            </p>
            <label style={{ fontWeight: 700, fontSize: 14, color: '#334155' }}>
              Email de contacto *
              <input
                type="email"
                inputMode="email"
                value={st.email_contacto}
                onChange={(e) => setField('email_contacto', e.target.value)}
                placeholder="contacto@club.com"
                readOnly={Boolean(inviteToken)}
                style={{
                  ...inputBase,
                  marginTop: 8,
                  ...(inviteToken ? { background: '#f1f5f9', color: '#475569' } : {}),
                }}
                autoComplete="email"
              />
            </label>
            <div>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#334155' }}>Teléfono / WhatsApp *</span>
              <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                <select
                  value={st.telefonoCodigo}
                  onChange={(e) => setField('telefonoCodigo', e.target.value)}
                  style={{ ...inputBase, width: 'auto', minWidth: 120, flex: '0 0 auto' }}
                >
                  {[...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS].map((p) => (
                    <option key={`${p.codigo}-${p.nombre}`} value={p.codigo}>
                      {p.bandera} {p.codigo}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="tel"
                  value={st.telefonoLocal}
                  onChange={(e) => setField('telefonoLocal', e.target.value)}
                  placeholder="9 11 2345-6789"
                  style={{ ...inputBase, flex: '1 1 200px', minWidth: 0 }}
                  autoComplete="tel-national"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          flexShrink: 0,
          padding: '12px 16px calc(14px + env(safe-area-inset-bottom, 0px))',
          borderTop: '1px solid #e2e8f0',
          background: 'var(--bg-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {st.step > 1 ? (
            <button
              type="button"
              disabled={saving}
              onClick={goPrev}
              style={{
                flex: '1 1 140px',
                minHeight: 52,
                fontSize: 16,
                fontWeight: 800,
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: 'var(--bg-card)',
                color: '#334155',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              Anterior
            </button>
          ) : (
            <div style={{ flex: '1 1 140px' }} />
          )}
          {st.step < 3 ? (
            <button
              type="button"
              disabled={saving}
              onClick={goNext}
              style={{
                flex: '2 1 200px',
                minHeight: 52,
                fontSize: 16,
                fontWeight: 800,
                borderRadius: 12,
                border: 'none',
                background: saving ? '#94a3b8' : '#E11B22',
                color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              Siguiente
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void crearSede()}
              style={{
                flex: '2 1 200px',
                minHeight: 52,
                fontSize: 16,
                fontWeight: 800,
                borderRadius: 12,
                border: 'none',
                background: saving ? '#94a3b8' : '#E11B22',
                color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Guardando…' : inviteToken ? 'Guardar sede y activar mi rol' : 'Crear sede'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20000,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'stretch',
        padding: 0,
        boxSizing: 'border-box',
      }}
      onClick={() => !saving && onClose?.()}
    >
      {sheetInner}
    </div>
  );
}
