import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { API_BASE, getAuthHeaders } from '../utils/scoreboardApi';
import {
  TIPO_DOCUMENTO_OPTIONS,
  GENERO_OPTIONS,
  PAISES_ISO_OPTIONS,
  parseIdentidadFromApi,
  identidadEstadoDisplay,
  emptyIdentidadForm,
  identidadToForm,
  buildIdentidadPutPayload,
  validateIdentidadForm,
  formatDocumentoGuardadoDisplay,
} from '../utils/jugadorIdentidad';
import './JugadorFichaTorneosSection.css';

export default function JugadorFichaTorneosSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [parsed, setParsed] = useState(null);
  const [form, setForm] = useState(emptyIdentidadForm);
  const [replaceDocument, setReplaceDocument] = useState(false);
  const [authMissing, setAuthMissing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadIdentidad = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        setAuthMissing(true);
        setParsed(null);
        setForm(emptyIdentidadForm());
        return;
      }
      setAuthMissing(false);
      const res = await fetch(`${API_BASE}/api/jugador/identidad`, { headers });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'No se pudo cargar la ficha para torneos');
      }
      const nextParsed = parseIdentidadFromApi(body);
      setParsed(nextParsed);
      setForm(identidadToForm(nextParsed));
      setReplaceDocument(false);
    } catch (e) {
      setLoadError(e.message || 'Error al cargar la ficha');
      setParsed(null);
      setForm(emptyIdentidadForm());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIdentidad();
  }, [loadIdentidad]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void loadIdentidad();
    });
    return () => subscription.unsubscribe();
  }, [loadIdentidad]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const hasExistingDocument = Boolean(parsed?.tiene_documento);
    const errors = validateIdentidadForm(form, { hasExistingDocument, replaceDocument });
    if (errors.length) {
      setErrorMsg(errors[0]);
      return;
    }

    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        setAuthMissing(true);
        setErrorMsg('Volvé a iniciar sesión para guardar la ficha.');
        return;
      }
      const payload = buildIdentidadPutPayload(form, { replaceDocument, hasExistingDocument });
      const res = await fetch(`${API_BASE}/api/jugador/identidad`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'No se pudo guardar la ficha');
      }
      setSuccessMsg('✅ Ficha guardada correctamente');
      setReplaceDocument(false);
      await loadIdentidad();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const estadoUi = identidadEstadoDisplay(parsed?.estado || 'incompleta');
  const maskedDoc = parsed?.numero_documento_mascarado || '';
  const hasSavedDocument = Boolean(parsed?.tiene_documento);
  const showDocumentInput = !hasSavedDocument || replaceDocument;
  const documentoGuardadoLabel = formatDocumentoGuardadoDisplay(maskedDoc) || 'Documento guardado: ****';
  const formDisabled = saving;

  return (
    <div id="ficha-torneos" className="jugador-ficha-torneos">
      <div className="jugador-ficha-torneos__head">
        <h4 className="jugador-ficha-torneos__title">Ficha para torneos</h4>
        {!loading ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '11px',
              fontWeight: 700,
              color: estadoUi.color,
              background: estadoUi.bg,
              border: `1px solid ${estadoUi.color}33`,
            }}
          >
            {estadoUi.label}
          </span>
        ) : null}
      </div>

      <p className="jugador-ficha-torneos__intro">
        Estos datos ayudan a validar identidad y categorías en torneos. Solo vos podés verlos desde tu perfil.
      </p>

      {loading ? (
        <p className="jugador-ficha-torneos__loading">Cargando ficha…</p>
      ) : null}

      {authMissing ? (
        <p className="jugador-ficha-torneos__warn">
          Tu sesión no está lista para sincronizar con el servidor. Podés completar la ficha abajo; si no podés guardar, volvé a iniciar sesión.
        </p>
      ) : null}

      {loadError ? (
        <p className="jugador-ficha-torneos__error">
          No se pudieron cargar datos guardados ({loadError}). Completá la ficha y guardala.
        </p>
      ) : null}

      <form onSubmit={handleGuardar}>
        <div className="jugador-ficha-torneos__section">
          <h5 className="jugador-ficha-torneos__section-title">Documento de identidad</h5>

          <div className="jugador-ficha-torneos__field">
            <label className="jugador-ficha-torneos__label" htmlFor="ficha-tipo-documento">Tipo de documento</label>
            <select
              id="ficha-tipo-documento"
              name="tipo_documento"
              value={form.tipo_documento}
              onChange={handleChange}
              disabled={formDisabled}
              className="jugador-ficha-torneos__select"
            >
              {TIPO_DOCUMENTO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="jugador-ficha-torneos__field">
            <label className="jugador-ficha-torneos__label" htmlFor="ficha-pais-documento">País del documento</label>
            <select
              id="ficha-pais-documento"
              name="pais_documento"
              value={form.pais_documento}
              onChange={handleChange}
              disabled={formDisabled}
              className="jugador-ficha-torneos__select"
            >
              {PAISES_ISO_OPTIONS.map((p) => (
                <option key={p.code} value={p.code}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="jugador-ficha-torneos__field jugador-ficha-torneos__field--last">
            <label className="jugador-ficha-torneos__label" htmlFor="ficha-numero-documento">
              {showDocumentInput && replaceDocument ? 'Nuevo número de documento' : 'Número de documento'}
            </label>

            {showDocumentInput ? (
              <>
                <input
                  id="ficha-numero-documento"
                  type="text"
                  name="numero_documento"
                  value={form.numero_documento}
                  onChange={handleChange}
                  placeholder="Ingresá tu número de documento"
                  autoComplete="off"
                  disabled={formDisabled}
                  className="jugador-ficha-torneos__input jugador-ficha-torneos__input--document"
                />
                <p className="jugador-ficha-torneos__hint">
                  Este dato es privado y se usa solo para validar identidad en torneos.
                </p>
                {replaceDocument ? (
                  <button
                    type="button"
                    onClick={() => {
                      setReplaceDocument(false);
                      setForm((prev) => ({ ...prev, numero_documento: '' }));
                    }}
                    className="jugador-ficha-torneos__btn-secondary jugador-ficha-torneos__btn-secondary--sm"
                  >
                    Cancelar cambio
                  </button>
                ) : null}
              </>
            ) : (
              <div>
                <div className="jugador-ficha-torneos__doc-mask">
                  {documentoGuardadoLabel}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReplaceDocument(true);
                    setForm((prev) => ({ ...prev, numero_documento: '' }));
                  }}
                  className="jugador-ficha-torneos__btn-secondary"
                >
                  Cambiar documento
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="jugador-ficha-torneos__section">
          <h5 className="jugador-ficha-torneos__section-title">Datos personales</h5>

          <div className="jugador-ficha-torneos__field">
            <label className="jugador-ficha-torneos__label" htmlFor="ficha-fecha-nacimiento">Fecha de nacimiento</label>
            <input
              id="ficha-fecha-nacimiento"
              type="date"
              name="fecha_nacimiento"
              value={form.fecha_nacimiento}
              onChange={handleChange}
              disabled={formDisabled}
              className="jugador-ficha-torneos__input"
            />
          </div>

          <div className="jugador-ficha-torneos__field">
            <label className="jugador-ficha-torneos__label" htmlFor="ficha-nacionalidad">Nacionalidad</label>
            <select
              id="ficha-nacionalidad"
              name="nacionalidad"
              value={form.nacionalidad}
              onChange={handleChange}
              disabled={formDisabled}
              className="jugador-ficha-torneos__select"
            >
              {PAISES_ISO_OPTIONS.map((p) => (
                <option key={p.code} value={p.code}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="jugador-ficha-torneos__field">
            <label className="jugador-ficha-torneos__label" htmlFor="ficha-genero">Género</label>
            <select
              id="ficha-genero"
              name="genero"
              value={form.genero}
              onChange={handleChange}
              disabled={formDisabled}
              className="jugador-ficha-torneos__select"
            >
              <option value="">— Seleccionar —</option>
              {GENERO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="jugador-ficha-torneos__field jugador-ficha-torneos__field--last">
            <label className="jugador-ficha-torneos__label" htmlFor="ficha-telefono">Teléfono</label>
            <input
              id="ficha-telefono"
              type="tel"
              name="telefono"
              value={form.telefono}
              onChange={handleChange}
              placeholder="Ej: +5491112345678"
              disabled={formDisabled}
              className="jugador-ficha-torneos__input"
            />
          </div>
        </div>

        <div className="jugador-ficha-torneos__section">
          <h5 className="jugador-ficha-torneos__section-title">Contacto de emergencia</h5>

          <div className="jugador-ficha-torneos__field">
            <label className="jugador-ficha-torneos__label" htmlFor="ficha-emergencia-nombre">Nombre</label>
            <input
              id="ficha-emergencia-nombre"
              type="text"
              name="contacto_emergencia_nombre"
              value={form.contacto_emergencia_nombre}
              onChange={handleChange}
              disabled={formDisabled}
              className="jugador-ficha-torneos__input"
            />
          </div>

          <div className="jugador-ficha-torneos__field">
            <label className="jugador-ficha-torneos__label" htmlFor="ficha-emergencia-telefono">Teléfono</label>
            <input
              id="ficha-emergencia-telefono"
              type="tel"
              name="contacto_emergencia_telefono"
              value={form.contacto_emergencia_telefono}
              onChange={handleChange}
              disabled={formDisabled}
              className="jugador-ficha-torneos__input"
            />
          </div>

          <div className="jugador-ficha-torneos__field jugador-ficha-torneos__field--last">
            <label className="jugador-ficha-torneos__label" htmlFor="ficha-emergencia-relacion">Relación</label>
            <input
              id="ficha-emergencia-relacion"
              type="text"
              name="contacto_emergencia_relacion"
              value={form.contacto_emergencia_relacion}
              onChange={handleChange}
              placeholder="Ej: Madre, pareja, amigo"
              disabled={formDisabled}
              className="jugador-ficha-torneos__input"
            />
          </div>
        </div>

        {errorMsg ? (
          <p className="jugador-ficha-torneos__form-error">{errorMsg}</p>
        ) : null}
        {successMsg ? (
          <p className="jugador-ficha-torneos__form-success">{successMsg}</p>
        ) : null}

        <button
          type="submit"
          disabled={formDisabled}
          className="jugador-ficha-torneos__submit"
        >
          {saving ? 'Guardando…' : 'Guardar ficha'}
        </button>
      </form>
    </div>
  );
}
