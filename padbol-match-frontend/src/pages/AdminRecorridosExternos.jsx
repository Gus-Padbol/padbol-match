import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useAuth } from '../context/AuthContext';
import './RecorridoExterno.css';

const API_BASE = (process.env.REACT_APP_API_BASE_URL || 'https://padbol-backend.onrender.com').replace(/\/$/, '');

export default function AdminRecorridosExternos() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState({});
  const [recognized, setRecognized] = useState({});

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API_BASE}/api/admin/recorridos-externos`, { headers: { Authorization: `Bearer ${session?.access_token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No pudimos cargar las solicitudes.');
      setRows(data.solicitudes || []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [session?.access_token]);
  useEffect(() => { void load(); }, [load]);

  const resolve = async (row, estado) => {
    setError('');
    try {
      let datos = {};
      const raw = String(recognized[row.id] || '').trim();
      if (raw) { try { datos = JSON.parse(raw); } catch { throw new Error('Los datos reconocidos deben tener formato JSON válido.'); } }
      const response = await fetch(`${API_BASE}/api/admin/recorridos-externos/${row.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, nota_revision: notes[row.id] || '', datos_reconocidos: datos }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No pudimos actualizar la solicitud.');
      await load();
    } catch (e) { setError(e.message); }
  };

  return <main className="external-history-page"><AppHeader title="Recorridos externos" /><div className="external-history-wrap" style={{width:'min(1100px,calc(100% - 28px))'}}>
    <button className="external-history-back" type="button" onClick={() => navigate('/admin')}>← Volver al panel</button>
    <section className="external-history-hero"><span>Revisión en hasta 24 horas</span><h1>Recorridos pendientes</h1><p>Revisá las evidencias, reconocé únicamente datos verificables y explicá cualquier pedido o rechazo.</p></section>
    {error && <div className="external-history-message" style={{borderColor:'#fecaca',background:'#fef2f2',color:'#991b1b'}}>{error}</div>}
    <section className="external-history-status">
      {loading ? <p>Cargando…</p> : rows.length === 0 ? <p>No hay solicitudes.</p> : rows.map((row) => <article key={row.id}>
        <div><strong>{row.estado.replaceAll('_',' ')}</strong><span>{row.email} · vence {new Date(row.revisar_antes_de).toLocaleString('es-AR')}</span></div>
        <h3>{row.origen}</h3><p>{(row.categorias || []).join(' · ')}</p>{row.comentario && <p>{row.comentario}</p>}
        <div style={{display:'flex',gap:10,flexWrap:'wrap',justifyContent:'flex-start',margin:'12px 0'}}>{(row.capturas || []).map((file,index)=><a key={file.path} href={file.url} target="_blank" rel="noreferrer" style={{color:'#e11b22',fontWeight:850}}>Ver captura {index+1}</a>)}</div>
        <label style={{display:'block',fontWeight:800}}>Datos reconocidos (JSON)
          <textarea rows={3} value={recognized[row.id] || ''} onChange={(e)=>setRecognized((x)=>({...x,[row.id]:e.target.value}))} placeholder={'{"nivel":"Intermedio","ranking":24}'} style={{width:'100%',boxSizing:'border-box',marginTop:6,padding:10,border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-page)',color:'var(--text-primary)'}} />
        </label>
        <label style={{display:'block',fontWeight:800,marginTop:10}}>Nota para el jugador
          <textarea rows={2} value={notes[row.id] || ''} onChange={(e)=>setNotes((x)=>({...x,[row.id]:e.target.value}))} style={{width:'100%',boxSizing:'border-box',marginTop:6,padding:10,border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-page)',color:'var(--text-primary)'}} />
        </label>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-start',marginTop:12}}>
          <button type="button" onClick={()=>resolve(row,'en_revision')}>Marcar en revisión</button>
          <button type="button" onClick={()=>resolve(row,'requiere_informacion')}>Pedir otra captura</button>
          <button type="button" onClick={()=>resolve(row,'rechazado')}>Rechazar</button>
          <button className="external-history-submit" style={{width:'auto'}} type="button" onClick={()=>resolve(row,'aprobado')}>Aprobar</button>
        </div>
      </article>)}
    </section>
  </div></main>;
}
