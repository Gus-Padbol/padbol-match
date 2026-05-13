import React from 'react';
import {
  calcularDistribucionPuntosTorneo,
  formatPorcentajeDistribucion,
} from '../../utils/torneoPuntosDistribucion';

export default function TorneoPuntosDistribucionModal({ open, onClose, torneo }) {
  if (!open) return null;

  const puntosTotal = torneo?.puntos_total ?? torneo?.puntosTotal ?? '';
  const rows = calcularDistribucionPuntosTorneo(puntosTotal, torneo);
  const formato = String(torneo?.tipo_torneo || '').trim() || 'formato del torneo';

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
        aria-label="Distribución de puntos del torneo"
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
          <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>Distribución de puntos</h3>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Total: <strong>{Number(puntosTotal) || 0}</strong> puntos · {formato}
          </p>
        </div>
        <div style={{ padding: '14px 18px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Posición</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>%</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>Puntos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.posicion}>
                  <td style={{ padding: '8px 6px', borderBottom: '1px solid #f1f5f9' }}>{row.posicion}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                    {formatPorcentajeDistribucion(row.porcentaje)}
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>
                    {row.puntos}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ margin: '12px 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Por defecto: 1ro 40%, 2do 25%, 3ro 15%, 4to 10%; el 10% restante se reparte entre las demás posiciones.
          </p>
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
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
