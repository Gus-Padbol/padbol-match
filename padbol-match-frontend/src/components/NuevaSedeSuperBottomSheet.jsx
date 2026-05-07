import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PAISES_TELEFONO_PRINCIPALES, PAISES_TELEFONO_OTROS } from '../constants/paisesTelefono';

const PAISES_SEDE_OPTIONS = [...PAISES_TELEFONO_PRINCIPALES, ...PAISES_TELEFONO_OTROS]
  .map((p) => ({ value: `${p.bandera} ${p.nombre}`.trim(), label: `${p.bandera} ${p.nombre}`.trim(), codigo: p.codigo }))
  .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));

const DEPORTES_CATALOGO = [
  { key: 'padbol', label: 'Padbol' },
  { key: 'padel', label: 'Pádel' },
  { key: 'pickleball', label: 'Pickleball' },
  { key: 'futbol', label: 'Fútbol' },
  { key: 'tenis', label: 'Tenis' },
  { key: 'basquet', label: 'Básquet' },
  { key: 'otro', label: 'Otro' },
];

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
  provincia: '',
  ciudad: '',
  direccion: '',
  /** dep key -> string count */
  canchasPorDeporte: {},
  email_contacto: '',
  telefonoCodigo: '+54',
  telefonoLocal: '',
  metodo_pago: 'mercadopago',
  precio_turno: '',
  moneda: 'ARS',
  google_maps_url: '',
  latitud: '',
  longitud: '',
});

export default function NuevaSedeSuperBottomSheet({ open, onClose, apiBaseUrl, accessToken, onSuccess }) {
  const [st, setSt] = useState(initialState);
  const [planPricing, setPlanPricing] = useState([]);
  const [planPricingLoading, setPlanPricingLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSt(initialState());
    setPlanPricingLoading(true);
    fetch(`${apiBaseUrl}/api/plan-pricing`)
      .then((r) => r.json())
      .then((data) => setPlanPricing(Array.isArray(data) ? data : []))
      .catch(() => setPlanPricing([]))
      .finally(() => setPlanPricingLoading(false));
  }, [open, apiBaseUrl]);

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

  const goNext = useCallback(() => {
    if (st.step === 1) {
      if (!String(st.nombre || '').trim()) {
        alert('Completá el nombre de la sede.');
        return;
      }
      if (!String(st.pais || '').trim()) {
        alert('Seleccioná el país.');
        return;
      }
      if (!String(st.ciudad || '').trim()) {
        alert('Completá la ciudad.');
        return;
      }
      setSt((p) => ({ ...p, step: 2 }));
      return;
    }
    if (st.step === 2) {
      if (totalCanchas <= 0) {
        alert('Seleccioná al menos un deporte e indicá la cantidad de canchas (mayor a 0).');
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
      const precioNum =
        st.precio_turno != null && String(st.precio_turno).trim() !== '' ? Number(String(st.precio_turno).replace(',', '.')) : null;
      const lat = st.latitud != null && String(st.latitud).trim() !== '' ? Number(st.latitud) : null;
      const lng = st.longitud != null && String(st.longitud).trim() !== '' ? Number(st.longitud) : null;

      const body = {
        nombre: String(st.nombre || '').trim(),
        pais: String(st.pais || '').trim(),
        provincia: String(st.provincia || '').trim() || null,
        ciudad: String(st.ciudad || '').trim(),
        direccion: String(st.direccion || '').trim() || null,
        email_contacto: String(st.email_contacto || '').trim().toLowerCase(),
        telefono: telefonoFull,
        metodo_pago: st.metodo_pago,
        precio_turno: Number.isFinite(precioNum) ? precioNum : null,
        moneda: String(st.moneda || 'ARS').trim().toUpperCase() || 'ARS',
        google_maps_url: String(st.google_maps_url || '').trim() || null,
        latitud: Number.isFinite(lat) ? lat : null,
        longitud: Number.isFinite(lng) ? lng : null,
        horario_apertura: null,
        horario_cierre: null,
        cantidad_canchas: totalCanchas,
        skip_autogen_canchas: true,
      };

      const res = await fetch(`${apiBaseUrl}/api/sedes`, { method: 'POST', headers, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || 'No se pudo crear la sede');

      const deportesPayload = [];
      for (const d of DEPORTES_CATALOGO) {
        const raw = st.canchasPorDeporte[d.key];
        const n = parseInt(String(raw || ''), 10);
        if (Number.isFinite(n) && n > 0) deportesPayload.push({ deporte: d.key, cantidad: n });
      }

      const res2 = await fetch(`${apiBaseUrl}/api/sedes/${j.id}/deportes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ deportes: deportesPayload }),
      });
      const j2 = await res2.json().catch(() => ({}));
      if (!res2.ok) {
        throw new Error(j2?.error || 'La sede se creó pero no se guardaron los deportes. Revisá la tabla canchas_por_deporte en Supabase.');
      }

      onSuccess?.(j, j2.deportes || []);
      onClose?.();
    } catch (e) {
      alert(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }, [apiBaseUrl, accessToken, onClose, onSuccess, st, totalCanchas]);

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
        background: '#fff',
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
            Nueva sede
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b', fontWeight: 600 }}>
            Paso {st.step} de 3
          </p>
        </div>
        <button
          type="button"
          onClick={() => !saving && onClose?.()}
          disabled={saving}
          aria-label="Cerrar"
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
                background: st.step >= n ? '#4f46e5' : '#e2e8f0',
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
              Dirección
              <input
                type="text"
                value={st.direccion}
                onChange={(e) => setField('direccion', e.target.value)}
                placeholder="Calle y número"
                style={{ ...inputBase, marginTop: 8 }}
              />
            </label>
          </div>
        ) : null}

        {st.step === 2 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.45 }}>
              Marcá los deportes que ofrece el club e indicá cuántas canchas tiene de cada uno.
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
              <div style={{ marginTop: 8, fontSize: 14, color: '#4338ca', lineHeight: 1.45 }}>
                {planPricingLoading ? (
                  'Cargando planes…'
                ) : planMatch ? (
                  <>
                    Plan sugerido: <strong>{planMatch.nombre}</strong> ({formatRangoCanchasPlan(planMatch)} canchas) —{' '}
                    <strong>US$ {Number(planMatch.precio_usd).toFixed(2)}</strong> / mes
                  </>
                ) : totalCanchas > 0 ? (
                  'No hay un plan configurado para esta cantidad. Revisá plan_pricing en Supabase.'
                ) : (
                  'Elegí deportes y cantidades para ver el plan.'
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
            <label style={{ fontWeight: 700, fontSize: 14, color: '#334155' }}>
              Email de contacto *
              <input
                type="email"
                inputMode="email"
                value={st.email_contacto}
                onChange={(e) => setField('email_contacto', e.target.value)}
                placeholder="contacto@club.com"
                style={{ ...inputBase, marginTop: 8 }}
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
            <label style={{ fontWeight: 700, fontSize: 14, color: '#334155' }}>
              Método de pago
              <select
                value={st.metodo_pago}
                onChange={(e) => setField('metodo_pago', e.target.value)}
                style={{ ...inputBase, marginTop: 8 }}
              >
                <option value="mercadopago">Mercado Pago</option>
                <option value="stripe">Stripe</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ fontWeight: 700, fontSize: 14, color: '#334155', flex: '2 1 200px', minWidth: 0 }}>
                Precio por turno
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={st.precio_turno}
                  onChange={(e) => setField('precio_turno', e.target.value)}
                  placeholder="Opcional"
                  style={{ ...inputBase, marginTop: 8 }}
                />
              </label>
              <label style={{ fontWeight: 700, fontSize: 14, color: '#334155', flex: '1 1 120px', minWidth: 0 }}>
                Moneda
                <select
                  value={st.moneda}
                  onChange={(e) => setField('moneda', e.target.value)}
                  style={{ ...inputBase, marginTop: 8 }}
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
            </div>
            <label style={{ fontWeight: 700, fontSize: 14, color: '#334155' }}>
              Google Maps URL
              <input
                type="url"
                value={st.google_maps_url}
                onChange={(e) => setField('google_maps_url', e.target.value)}
                placeholder="https://maps.google.com/..."
                style={{ ...inputBase, marginTop: 8 }}
              />
            </label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ fontWeight: 700, fontSize: 14, color: '#334155', flex: 1, minWidth: 0 }}>
                Latitud (opcional)
                <input
                  type="text"
                  inputMode="decimal"
                  value={st.latitud}
                  onChange={(e) => setField('latitud', e.target.value)}
                  placeholder="-34.60"
                  style={{ ...inputBase, marginTop: 8 }}
                />
              </label>
              <label style={{ fontWeight: 700, fontSize: 14, color: '#334155', flex: 1, minWidth: 0 }}>
                Longitud (opcional)
                <input
                  type="text"
                  inputMode="decimal"
                  value={st.longitud}
                  onChange={(e) => setField('longitud', e.target.value)}
                  placeholder="-58.38"
                  style={{ ...inputBase, marginTop: 8 }}
                />
              </label>
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          flexShrink: 0,
          padding: '12px 16px calc(14px + env(safe-area-inset-bottom, 0px))',
          borderTop: '1px solid #e2e8f0',
          background: '#f8fafc',
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
                background: '#fff',
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
                background: saving ? '#94a3b8' : '#4f46e5',
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
                background: saving ? '#94a3b8' : '#16a34a',
                color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Creando…' : 'Crear sede'}
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
