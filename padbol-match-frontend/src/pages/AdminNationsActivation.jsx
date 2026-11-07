/**
 * Importación privada de nómina para Nations Cup.
 * Usa la API nationsActivation ya desplegada: configure -> preview -> confirm.
 * No publica nombres: roster_publication_approved se envía siempre en false.
 */
import React, {useCallback, useMemo, useRef, useState} from 'react';
import {useAuth} from '../context/AuthContext';
import useUserRole from '../hooks/useUserRole';
import {getApiBaseUrl} from '../utils/apiPublicBaseUrl';
import {getAuthHeaders} from '../utils/scoreboardApi';
import {
  configureEvent, confirmImport, newBatchId, parseRows, previewImport, readTournamentVenue, rowsFingerprint,
} from '../utils/nationsActivationApi';

export default function AdminNationsActivation() {
  const {session} = useAuth();
  const currentCliente = useMemo(() => (session?.user
    ? {id: session.user.id, email: session.user.email, accessToken: session.access_token}
    : null), [session]);
  const {rol} = useUserRole(currentCliente);
  const apiBaseUrl = getApiBaseUrl();
  const puedeOperar = rol === 'super_admin';

  const [slug, setSlug] = useState('');
  const [torneoId, setTorneoId] = useState('');
  const [title, setTitle] = useState('');
  const [configurado, setConfigurado] = useState(false);
  const [torneoConfigurado, setTorneoConfigurado] = useState(null);
  const [previewInvalidado, setPreviewInvalidado] = useState(false);
  const huboPreview = useRef(false);
  const [texto, setTexto] = useState('');
  const [preview, setPreview] = useState(null);
  const [canConfirm, setCanConfirm] = useState(false);
  const [selloPreview, setSelloPreview] = useState('');
  const [slugPreview, setSlugPreview] = useState('');
  const [lote, setLote] = useState(null);
  const [recibo, setRecibo] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const filas = useMemo(() => parseRows(texto), [texto]);
  const erroresFilas = filas.errores || [];
  const selloActual = useMemo(() => rowsFingerprint(filas), [filas]);
  // El preview vale solo si las filas y el evento no cambiaron desde que se generó.
  const previewVigente = Boolean(preview) && selloPreview === selloActual && slugPreview === String(slug).trim();

  // Si el contenido cambia, el preview anterior deja de valer y el lote se descarta.
  const invalidarPreview = () => {
    if (huboPreview.current) setPreviewInvalidado(true);
    setPreview(null);
    setCanConfirm(false);
    setSelloPreview('');
    setSlugPreview('');
    setLote(null);
  };

  const cambiarTexto = (valor) => {
    setTexto(valor);
    invalidarPreview();
    setRecibo(null);
    setError('');
  };

  const cambiarSlug = (valor) => {
    setSlug(valor);
    invalidarPreview();
    setConfigurado(false);
    setTorneoConfigurado(null);
    setRecibo(null);
    setError('');
  };

  // El torneo queda fijado por la respuesta del backend: cambiarlo exige reconfigurar.
  const cambiarTorneo = (valor) => {
    setTorneoId(valor);
    invalidarPreview();
    setConfigurado(false);
    setTorneoConfigurado(null);
    setRecibo(null);
    setError('');
  };

  const ejecutar = useCallback(async (fn) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e?.message || 'La operación no se confirmó.'); }
    finally { setBusy(false); }
  }, []);

  const configurar = (e) => {
    e.preventDefault();
    return ejecutar(async () => {
      const data = await configureEvent({apiBaseUrl, getAuthHeaders}, {slug, torneoId, title});
      const torneoDelEvento = Number(data?.event?.torneoId ?? torneoId);
      setConfigurado(true);
      setTorneoConfigurado(Number.isSafeInteger(torneoDelEvento) ? torneoDelEvento : Number(torneoId));
      setRecibo({tipo: 'configure', event: data?.event});
    });
  };

  // Solo confirmar exige sede: la vista previa es de lectura y sirve sin sede.
  const verificarSede = async () => {
    const idEvento = torneoConfigurado ?? Number(torneoId);
    const {known, hasVenue} = await readTournamentVenue({apiBaseUrl, getAuthHeaders}, idEvento);
    if (!known) {
      throw Object.assign(
        new Error('No se pudo comprobar la sede del torneo del evento. Vuelve a cargar la página antes de confirmar.'),
        {code: 'VENUE_UNKNOWN'},
      );
    }
    if (!hasVenue) {
      throw Object.assign(
        new Error('El torneo no tiene sede asignada. La nómina no puede confirmarse hasta asignar una sede: la tabla de participantes la exige.'),
        {code: 'VENUE_REQUIRED'},
      );
    }
  };

  const previsualizar = () => ejecutar(async () => {
    huboPreview.current = true;
    setPreviewInvalidado(false);
    const slugEnviado = String(slug).trim();
    const data = await previewImport({apiBaseUrl, getAuthHeaders}, {slug: slugEnviado, rows: filas});
    const filasPreview = Array.isArray(data?.rows) ? data.rows : [];
    setPreview(filasPreview);
    setCanConfirm(data?.canConfirm === true);
    setSelloPreview(selloActual);
    setSlugPreview(slugEnviado);
    setLote(newBatchId());
    setRecibo(null);
  });

  const confirmar = () => ejecutar(async () => {
    await verificarSede();
    const loteEnviado = lote;
    const huellaEnviada = selloActual;
    const data = await confirmImport({apiBaseUrl, getAuthHeaders}, {slug, batchId: loteEnviado, rows: filas});
    // El recibo guarda su lote y su huella: si luego cambian las filas, se muestra
    // igual pero marcado como anterior, sin inventar un lote vacío.
    setRecibo({tipo: 'confirm', data, batchId: loteEnviado, fingerprint: huellaEnviada});
  });

  if (!puedeOperar) {
    return (
      <section className="p-6">
        <h1>Importación de nómina</h1>
        <p role="alert">Esta pantalla requiere una cuenta de super administrador verificada.</p>
      </section>
    );
  }

  return (
    <section className="p-6" style={{maxWidth: 860, margin: '0 auto'}}>
      <h1 style={{marginBottom: 8}}>Importación privada de nómina</h1>
      <p style={{color: '#4c5158', marginTop: 0}}>
        La nómina queda privada: no se publica el nombre de los jugadores ni de las selecciones.
      </p>

      <form onSubmit={configurar} style={{display: 'grid', gap: 10, marginBottom: 20}}>
        <label>Identificador del evento
          <input value={slug} onChange={(e) => cambiarSlug(e.target.value)} placeholder="nations-cup-2026" required />
        </label>
        <label>Torneo (id)
          <input value={torneoId} onChange={(e) => cambiarTorneo(e.target.value)} inputMode="numeric"
            disabled={configurado} required />
        </label>
        <label>Título interno
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <button type="submit" disabled={busy}>Configurar evento</button>
        {configurado ? <p role="status">Evento configurado. Continúa con las filas.</p> : null}
      </form>

      <label style={{display: 'block', marginBottom: 8}}>
        Filas (una por línea: Nombre, PAÍS[, menor|adulto])
        <textarea
          value={texto}
          onChange={(e) => cambiarTexto(e.target.value)}
          rows={8}
          style={{width: '100%', fontFamily: 'monospace'}}
          placeholder={'Jugador de prueba, XX\nJugador adulto, YY, adulto\nMenor de prueba, ZZ, menor'}
        />
      </label>

      {erroresFilas.length ? (
        <ul role="alert" style={{color: '#b91c1c', margin: '0 0 12px', paddingLeft: 18}}>
          {erroresFilas.map((e) => <li key={`${e.linea}-${e.motivo}`}>Línea {e.linea || '—'}: {e.motivo}</li>)}
        </ul>
      ) : null}

      <div style={{display: 'flex', gap: 10, marginBottom: 12}}>
        <button type="button" onClick={previsualizar} disabled={busy || filas.length === 0 || erroresFilas.length > 0 || !configurado}>
          Ver vista previa
        </button>
        <button type="button" onClick={confirmar} disabled={busy || !previewVigente || !lote || !canConfirm}>
          Confirmar importación
        </button>
      </div>

      {error ? <p role="alert" style={{color: '#b91c1c', fontWeight: 600}}>{error}</p> : null}

      {previewInvalidado && !previewVigente ? (
        <p role="status" style={{color: '#b45309'}}>Las filas cambiaron: vuelve a generar la vista previa.</p>
      ) : null}

      {previewVigente && Array.isArray(preview) ? (
        <>
          {!canConfirm ? (
            <p role="alert" style={{color: '#b91c1c', fontWeight: 600}}>
              La vista previa tiene conflictos: corrige las filas marcadas antes de confirmar.
            </p>
          ) : null}
          <table style={{width: '100%', borderCollapse: 'collapse', marginBottom: 16}}>
            <thead><tr><th align="left">Fila</th><th align="left">Nombre</th><th align="left">País</th><th align="left">Edad</th><th align="left">Coincidencia</th><th align="left">Problema</th></tr></thead>
            <tbody>
              {preview.map((row) => (
                <tr key={row.rowKey}>
                  <td>{row.rowKey}</td>
                  <td>{row.name}</td>
                  <td>{row.country}</td>
                  <td>{({adulto: 'Adulto', menor: 'Menor', desconocido: 'Desconocida'})[row.age_status || row.ageStatus || (row.minor ? 'menor' : 'desconocido')] || 'Desconocida'}</td>
                  <td>{row.matchedParticipantId || row.existingParticipantId ? `Existente (${row.matchedParticipantId || row.existingParticipantId})` : 'Nueva'}</td>
                  <td>{Array.isArray(row.errors) && row.errors.length ? row.errors.join(', ') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {recibo ? (
        <div role="status" style={{background: '#f1f2f4', borderRadius: 10, padding: 12}}>
          <strong>Recibo</strong>
          {recibo.tipo === 'confirm' ? (
            <>
            <ul style={{margin: '8px 0 0'}}>
              <li>Lote: {recibo.batchId}</li>
              <li>Reintento idempotente: {recibo.data?.idempotent ? 'sí' : 'no'}</li>
              <li>Nombres publicados: no</li>
            </ul>
            {recibo.fingerprint && recibo.fingerprint !== selloActual ? (
              <p role="alert" style={{color: '#b45309', margin: '8px 0 0'}}>
                Este recibo corresponde a las filas anteriores: vuelve a previsualizar antes de confirmar de nuevo.
              </p>
            ) : null}
            </>
          ) : <p style={{margin: '8px 0 0'}}>Evento: {recibo.event?.slug}</p>}
        </div>
      ) : null}
    </section>
  );
}
