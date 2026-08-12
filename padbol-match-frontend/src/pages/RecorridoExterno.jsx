import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import './RecorridoExterno.css';

const API_BASE = (process.env.REACT_APP_API_BASE_URL || 'https://padbol-backend.onrender.com').replace(/\/$/, '');
const OPTIONS = [
  ['categoria_nivel', 'Categoría o nivel'],
  ['ranking', 'Ranking'],
  ['puntos', 'Puntos'],
  ['partidos', 'Partidos y resultados'],
  ['torneos_posiciones', 'Torneos y posiciones'],
  ['estadisticas', 'Estadísticas'],
  ['logros', 'Logros o títulos'],
];

const STATUS = {
  recibido: 'Recibido',
  en_revision: 'En revisión',
  requiere_informacion: 'Necesitamos otra captura',
  aprobado: 'Verificado',
  rechazado: 'No verificado',
};

const CATEGORY_LABELS = Object.fromEntries(OPTIONS);
const recognizedEntries = (item) => Object.entries(item?.datos_reconocidos || {}).filter(([, value]) => value !== '' && value != null);

export default function RecorridoExterno() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [origen, setOrigen] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [comentario, setComentario] = useState('');
  const [files, setFiles] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const token = session?.access_token;

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

  const toggle = (key) => setCategorias((current) => current.includes(key) ? current.filter((x) => x !== key) : [...current, key]);
  const submit = async (event) => {
    event.preventDefault();
    if (!origen.trim() || !categorias.length || !files.length || sending) return;
    setSending(true);
    setMessage('');
    try {
      const body = new FormData();
      body.append('origen', origen.trim());
      body.append('categorias', JSON.stringify(categorias));
      body.append('comentario', comentario.trim());
      files.forEach((file) => body.append('capturas', file));
      const response = await fetch(`${API_BASE}/api/recorrido-externo`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No pudimos enviar tu recorrido.');
      setOrigen(''); setCategorias([]); setComentario(''); setFiles([]);
      setMessage('¡Recibimos tu recorrido! Te avisaremos dentro de las próximas 24 horas.');
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="external-history-page">
      <AppHeader title="Traé tu recorrido" />
      <div className="external-history-wrap">
        <button className="external-history-back" type="button" onClick={() => navigate('/mi-perfil')}>← Volver a mi perfil</button>
        <section className="external-history-hero">
          <span>Tu juego no empieza de cero</span>
          <h1>Traé tu recorrido. Lo reconocemos.</h1>
          <p>Subí capturas donde se vean tu perfil y los datos que querés reconocer. Las revisaremos y te avisaremos dentro de las próximas 24 horas.</p>
          <small>Nunca te pediremos la contraseña de otra plataforma. Tus datos son tuyos y podrás llevarte todo tu recorrido cuando quieras.</small>
        </section>

        {!pending && <form className="external-history-form" onSubmit={submit}>
          <label>¿De dónde viene tu recorrido?
            <input value={origen} onChange={(e) => setOrigen(e.target.value)} placeholder="Plataforma, liga, federación o club" maxLength={160} required />
          </label>
          <fieldset>
            <legend>¿Qué querés que reconozcamos?</legend>
            <div className="external-history-options">
              {OPTIONS.map(([key, label]) => <label key={key}><input type="checkbox" checked={categorias.includes(key)} onChange={() => toggle(key)} />{label}</label>)}
            </div>
          </fieldset>
          <label>Subí tus capturas
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))} required />
            <small>Entre 1 y 5 imágenes o PDF. Máximo 8 MB por archivo.</small>
          </label>
          {files.length > 0 && <p className="external-history-files">{files.length} archivo{files.length === 1 ? '' : 's'} listo{files.length === 1 ? '' : 's'} para enviar.</p>}
          <label>Comentario opcional
            <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Contanos algo que ayude a identificar los datos" maxLength={1000} rows={3} />
          </label>
          <button className="external-history-submit" disabled={sending || !origen.trim() || !categorias.length || !files.length}>{sending ? 'Enviando…' : 'Enviar mi recorrido'}</button>
        </form>}

        {message && <div className="external-history-message">{message}</div>}
        <section className="external-history-status">
          <h2>Estado de tu solicitud</h2>
          {loading ? <p>Cargando…</p> : solicitudes.length === 0 ? <p>Todavía no enviaste un recorrido.</p> : solicitudes.map((item) => (
            <article key={item.id}>
              <div><strong>{STATUS[item.estado] || item.estado}</strong><span>{new Date(item.created_at).toLocaleDateString('es-AR')}</span></div>
              <p>{item.origen}</p>
              {item.nota_revision && <p className="external-history-note">{item.nota_revision}</p>}
              {item.estado === 'aprobado' && <>
                <small>Recorrido externo verificado. Tu nivel puede ajustarse con tus próximos partidos.</small>
                {recognizedEntries(item).length > 0 && <div className="external-history-recognized" aria-label="Datos reconocidos">
                  {recognizedEntries(item).map(([key, value]) => <span key={key}>
                    <strong>{CATEGORY_LABELS[key] || key.replaceAll('_', ' ')}</strong> {String(value)}
                  </span>)}
                </div>}
              </>}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
