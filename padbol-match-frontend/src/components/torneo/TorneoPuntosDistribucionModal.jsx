import React, {useEffect,useState} from 'react';
import {getApiBaseUrl} from '../../utils/apiPublicBaseUrl';
import {readPointsConfig,readTournamentPointsPolicy,pointsBaseForLevel} from '../../utils/pointsConfigApi';
import {useSafeTranslation} from '../../i18n/tSafe';
import {
  calcularDistribucionPuntosTorneo,
  formatPorcentajeDistribucion,
} from '../../utils/torneoPuntosDistribucion';

export default function TorneoPuntosDistribucionModal({ open, onClose, torneo, apiBaseUrl = getApiBaseUrl() }) {
  const {i18n}=useSafeTranslation();const en=String(i18n.language).startsWith('en');const text=(es,english)=>en?english:es;
  const [data,setData]=useState(null);const [error,setError]=useState('');const [loading,setLoading]=useState(false);const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!open)return undefined;
    const controller=new AbortController();setLoading(true);setError('');setData(null);
    (async()=>{
      try{
        const next=torneo?.id?await readTournamentPointsPolicy({apiBaseUrl,torneoId:torneo.id,signal:controller.signal}):await readPointsConfig({apiBaseUrl,signal:controller.signal}).then(policy=>({policy,base_points:pointsBaseForLevel(policy,torneo?.nivel_torneo),source:'draft'}));
        if(!Number.isFinite(next.base_points))throw new Error(text('No se confirmó la base para este nivel.','The base for this level was not confirmed.'));
        if(!controller.signal.aborted)setData(next);
      }catch(err){if(!controller.signal.aborted)setError(err.message);}
      finally{if(!controller.signal.aborted)setLoading(false);}
    })();return()=>controller.abort();
  // Language only changes copy, not the persisted policy request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[open,torneo?.id,torneo?.nivel_torneo,apiBaseUrl,retry]);
  if(!open)return null;
  const rows=data?calcularDistribucionPuntosTorneo(data.base_points,torneo,data.policy):[];
  const formato=String(torneo?.tipo_torneo || '').trim();
  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 20000,
        background: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '18px',
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={text('Puntos por posición del torneo','Tournament points by place')}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'var(--bg-card)',
          borderRadius: '14px',
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.35)',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>{text('Puntos por posición','Points by place')}</h3>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {data?<>{text('Base del nivel:','Level base:')} <strong>{data.base_points}</strong> {text('puntos','points')} · {formato}</>:text('Consultando política guardada…','Loading saved policy…')}
          </p>
        </div>
        <div style={{ padding: '14px 18px' }}>
          {loading?<p role="status">{text('Consultando…','Loading…')}</p>:null}
          {error?<div role="alert"><p>{error}</p><button onClick={()=>setRetry(value=>value+1)}>{text('Reintentar','Retry')}</button></div>:null}
          {data?<><p>{data.source==='approved_snapshot'?text('Política aprobada conservada para este torneo.','Approved policy retained for this tournament.'):text('Política actual consultada. Esta vista previa no aprueba ni publica puntos oficiales FIPA.','Current policy loaded. This preview does not approve or publish official FIPA points.')}</p><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>{text('Posición','Place')}</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>%</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>{text('Puntos','Points')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.posicion}>
                  <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f5f9' }}>{row.posicion}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                    {Number.isFinite(row.porcentaje)?formatPorcentajeDistribucion(row.porcentaje):text('No configurado','Not configured')}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>
                    {row.puntos??text('No configurado','Not configured')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ margin: '12px 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {text('Cada porcentaje se aplica individualmente a la base del nivel; no es un fondo a repartir ni debe sumar 100%.','Each percentage applies independently to the level base; this is not a shared pool and percentages need not total 100%.')}
          </p></>:null}
        </div>
        <div style={{ padding: '12px 18px 16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: 'none',
              background: '#E11B22',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {text('Cerrar','Close')}
          </button>
        </div>
      </div>
    </div>
  );
}
