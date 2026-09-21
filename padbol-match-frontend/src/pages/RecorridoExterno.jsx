import { getApiBaseUrl } from '../utils/apiPublicBaseUrl';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import './RecorridoExterno.css';

// En la copia de pruebas, nunca caer por defecto en el backend de producción.
const API_BASE = getApiBaseUrl({ fallback: 'http://127.0.0.1:3001' });
const SPORTS = ['Padbol', 'Pádel', 'Pickleball', 'Tenis', 'Otro'];
const LEVELS = ['Principiante', '6ta', '5ta', '4ta', '3ra', '2da', '1ra', 'Elite'];
const ENDORSEMENTS = [['ninguno', 'No hace falta'], ['club', 'Un club'], ['entrenador', 'Un entrenador/a'], ['companero', 'Un jugador/a compañero/a']];

const STATUS = {
  recibido: 'Recibido',
  en_revision: 'En revisión',
  requiere_informacion: 'Necesitamos otra captura',
  aprobado: 'Nivel reconocido',
  rechazado: 'No verificado',
};

const CATEGORY_LABELS = { categoria_nivel: 'Nivel de jugador' };
const recognizedEntries = (item) => Object.entries(item?.datos_reconocidos || {}).filter(([, value]) => value !== '' && value != null);

export default function RecorridoExterno() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [origen, setOrigen] = useState('');
  const [deporte, setDeporte] = useState('Padbol');
  const [nivel, setNivel] = useState('');
  const [perfilUrl, setPerfilUrl] = useState('');
  const [avalTipo, setAvalTipo] = useState('ninguno');
  const [avalNombre, setAvalNombre] = useState('');
  const [avalContacto, setAvalContacto] = useState('');
  const categorias = ['categoria_nivel'];
  const [comentario, setComentario] = useState('');
  const [files, setFiles] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const token = session?.access_token;

  useLayoutEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const raf = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
    return () => {
      window.cancelAnimationFrame(raf);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  const goBack = () => {
    navigate(token ? '/mi-perfil' : '/plataforma#tu-recorrido');
  };

  const startUpload = () => {
    const redirect = encodeURIComponent('/mi-perfil/recorrido');
    navigate(`/acceso?modo=registro&redirect=${redirect}`);
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/recorrido-externo/mio`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No pudimos cargar tus solicitudes.');
      setSolicitudes(data.solicitudes || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  const pending = useMemo(() => solicitudes.some((x) => ['recibido', 'en_revision'].includes(x.estado)), [solicitudes]);

  const submit = async (event) => {
    event.preventDefault();
    if (!origen.trim() || !deporte || !nivel || !categorias.length || files.length !== 3 || sending) return;
    setSending(true);
    setMessage('');
    try {
      const body = new FormData();
      body.append('origen', origen.trim());
      body.append('deporte', deporte);
      body.append('nivel_reclamado', nivel);
      body.append('perfil_url', perfilUrl.trim());
      body.append('aval_tipo', avalTipo);
      body.append('aval_nombre', avalNombre.trim());
      body.append('aval_contacto', avalContacto.trim());
      body.append('categorias', JSON.stringify(categorias));
      body.append('comentario', comentario.trim());
      files.forEach((file) => body.append('capturas', file));
      const response = await fetch(`${API_BASE}/api/recorrido-externo`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No pudimos enviar tu recorrido.');
      setOrigen(''); setDeporte('Padbol'); setNivel(''); setPerfilUrl(''); setAvalTipo('ninguno'); setAvalNombre(''); setAvalContacto(''); setComentario(''); setFiles([]);
      setMessage('¡Nivel reconocido! Ya lo incorporamos como tu punto de partida en Padbol Match.');
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="external-history-page">
      <AppHeader title="Trae tu nivel" onBack={goBack} />
      <div className="external-history-wrap">
        <section className="external-history-hero">
          <span>Tu juego no empieza de cero</span>
          <h1>Trae tu nivel. Lo reconocemos.</h1>
          <p>No necesitas abandonar ninguna plataforma. Comparte tres capturas y reconoceremos tu nivel inicial para ayudarte a empezar a jugar.</p>
          <small>Nunca te pediremos la contraseña de otra plataforma. Este proceso reconoce tu punto de partida; no transfiere puntos ni crea un historial oficial.</small>
        </section>

        {!token && (
          <section className="external-history-guide" aria-labelledby="external-history-guide-title">
            <div className="external-history-guide__heading">
              <span>Solo necesitas tres capturas</span>
              <h2 id="external-history-guide-title">Prepara estas imágenes</h2>
              <p>Procura que el nombre de la plataforma y los datos sean legibles.</p>
            </div>
            <ol className="external-history-guide__steps">
              <li><strong>01</strong><div><h3>Tu perfil y nivel actual</h3><p>Una captura donde se vean tu nombre de usuario, categoría o nivel.</p></div></li>
              <li><strong>02</strong><div><h3>Resultados recientes</h3><p>Una captura de tus últimos partidos o resultados registrados.</p></div></li>
              <li><strong>03</strong><div><h3>Ranking, torneo o logro</h3><p>Una captura que respalde tu posición, participación o evolución.</p></div></li>
            </ol>
            <div className="external-history-guide__action">
              <button className="external-history-submit" type="button" onClick={startUpload}>Subirlas ahora</button>
              <small>En este punto te pediremos crear una cuenta o iniciar sesión para vincular las capturas de forma segura con tu perfil.</small>
            </div>
          </section>
        )}

        {token && !pending && <form className="external-history-form" onSubmit={submit}>
          <label>¿De dónde viene tu recorrido?
            <input value={origen} onChange={(e) => setOrigen(e.target.value)} placeholder="Ej.: Playtomic, una liga, federación o club" maxLength={160} required />
          </label>
          <div className="external-history-row"><label>Deporte<select value={deporte} onChange={(e) => setDeporte(e.target.value)}>{SPORTS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Tu nivel actual<select value={nivel} onChange={(e) => setNivel(e.target.value)} required><option value="">Elige tu nivel</option>{LEVELS.map((item) => <option key={item}>{item}</option>)}</select></label></div>
          <label>Sube tus tres capturas
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 3))} required />
            <small>Selecciona exactamente 3 imágenes o archivos PDF: perfil y nivel, resultados recientes, y ranking, torneo o logro. Máximo 8 MB por archivo.</small>
          </label>
          {files.length > 0 && <p className="external-history-files">{files.length} archivo{files.length === 1 ? '' : 's'} listo{files.length === 1 ? '' : 's'} para enviar.</p>}
          <label>Enlace a tu perfil (opcional)<input type="url" value={perfilUrl} onChange={(e) => setPerfilUrl(e.target.value)} placeholder="https://…" maxLength={500} /></label>
          <fieldset><legend>¿Quién puede respaldar este nivel? <small>Opcional.</small></legend><div className="external-history-row"><label>Respaldo<select value={avalTipo} onChange={(e) => setAvalTipo(e.target.value)}>{ENDORSEMENTS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>{avalTipo !== 'ninguno' && <label>Nombre<input value={avalNombre} onChange={(e) => setAvalNombre(e.target.value)} placeholder="Nombre" maxLength={160} /></label>}</div>{avalTipo !== 'ninguno' && <input value={avalContacto} onChange={(e) => setAvalContacto(e.target.value)} placeholder="Teléfono, email o perfil (opcional)" maxLength={240} />}</fieldset>
          <label>Comentario opcional
            <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Cuéntanos algo que ayude a identificar los datos" maxLength={1000} rows={3} />
          </label>
          <button className="external-history-submit" disabled={sending || !origen.trim() || !nivel || !categorias.length || files.length !== 3}>{sending ? 'Reconociendo…' : 'Reconocer mi nivel'}</button>
        </form>}

        {token && message && <div className="external-history-message">{message}</div>}
        {token && <section className="external-history-status">
          <h2>Estado de tu solicitud</h2>
          {loading ? <p>Cargando…</p> : solicitudes.length === 0 ? <p>Todavía no enviaste un recorrido.</p> : solicitudes.map((item) => (
            <article key={item.id}>
              <div><strong>{STATUS[item.estado] || item.estado}</strong><span>{new Date(item.created_at).toLocaleDateString('es-AR')}</span></div>
              <p>{item.origen}{item.deporte ? ` · ${item.deporte}` : ''}{item.nivel_reclamado ? ` · ${item.nivel_reclamado}` : ''}</p>
              {item.nota_revision && <p className="external-history-note">{item.nota_revision}</p>}
              {item.estado === 'aprobado' && <>
                <small>Nivel externo reconocido como punto de partida. Tus próximos partidos ajustarán tu nivel; no suma puntos al ranking oficial.</small>
                {recognizedEntries(item).length > 0 && <div className="external-history-recognized" aria-label="Datos reconocidos">
                  {recognizedEntries(item).map(([key, value]) => <span key={key}>
                    <strong>{CATEGORY_LABELS[key] || key.replaceAll('_', ' ')}</strong> {String(value)}
                  </span>)}
                </div>}
              </>}
            </article>
          ))}
        </section>}
      </div>
    </main>
  );
}
