import React from 'react';

const DEPORTE_LABEL = {
  padbol: 'Padbol',
  padel: 'Pádel',
  pickleball: 'Pickleball',
  futbol_5: 'Fútbol 5',
  futbol_7: 'Fútbol 7',
};

function fechaPartidoLabel(fecha) {
  if (!fecha) return 'Fecha a confirmar';
  const d = new Date(`${String(fecha).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(fecha).slice(0, 10);
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

function horaPartidoLabel(hora) {
  const h = String(hora || '').trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(h);
  return m ? `${String(parseInt(m[1], 10)).padStart(2, '0')}:${m[2]}` : h || '--:--';
}

export default function PartidoAbiertoCard({ partido, onJoin, joining = false, compact = false }) {
  const confirmados = Array.isArray(partido?.jugadores_confirmados) ? partido.jugadores_confirmados : [];
  const requeridos = Math.max(2, parseInt(String(partido?.jugadores_requeridos || '4'), 10) || 4);
  const faltan = Math.max(0, requeridos - confirmados.length);
  const capitanFoto = String(partido?.capitan_foto_url || '').trim();
  const capitanNombre = String(partido?.capitan_nombre || '').trim() || 'Capitán';

  return (
    <article
      style={{
        width: '100%',
        borderRadius: '18px',
        background: '#fff',
        color: '#0f172a',
        boxShadow: compact ? '0 10px 24px rgba(15,23,42,0.14)' : '0 16px 35px rgba(15,23,42,0.18)',
        border: '1px solid rgba(226,232,240,0.9)',
        padding: compact ? '14px' : '16px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        {capitanFoto ? (
          <img
            src={capitanFoto}
            alt={capitanNombre}
            style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', background: '#e2e8f0' }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'linear-gradient(135deg,#667eea,#764ba2)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 900,
            }}
          >
            {capitanNombre.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong style={{ display: 'block', fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {capitanNombre}
          </strong>
          <span style={{ display: 'block', color: '#64748b', fontSize: '12px', fontWeight: 700 }}>
            Capitán del partido
          </span>
        </div>
        <span
          style={{
            borderRadius: '999px',
            padding: '6px 9px',
            background: faltan > 0 ? '#ecfdf5' : '#eef2ff',
            color: faltan > 0 ? '#047857' : '#4338ca',
            fontSize: '12px',
            fontWeight: 900,
            whiteSpace: 'nowrap',
          }}
        >
          {faltan > 0 ? `Faltan ${faltan}` : 'Completo'}
        </span>
      </div>

      <h3 style={{ margin: '0 0 8px', fontSize: compact ? '17px' : '19px', lineHeight: 1.2 }}>
        {DEPORTE_LABEL[partido?.deporte] || partido?.deporte || 'Partido'} en {partido?.sede_nombre || 'sede'}
      </h3>
      <p style={{ margin: '0 0 12px', color: '#475569', fontSize: '13px', lineHeight: 1.5 }}>
        {fechaPartidoLabel(partido?.fecha)} · {horaPartidoLabel(partido?.hora)} · Cancha {partido?.cancha || '—'} ·{' '}
        {partido?.duracion_minutos || 90} min · Nivel {partido?.nivel || 'Principiante'}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', marginBottom: onJoin ? '14px' : 0 }}>
        {Array.from({ length: requeridos }, (_, idx) => {
          const jugador = confirmados[idx];
          const foto = String(jugador?.foto_url || '').trim();
          const nombre = String(jugador?.nombre || '').trim() || 'Jugador';
          return foto ? (
            <img
              key={idx}
              src={foto}
              alt={nombre}
              title={nombre}
              style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }}
            />
          ) : (
            <span
              key={idx}
              title={jugador ? nombre : 'Slot disponible'}
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                border: jugador ? '2px solid #c4b5fd' : '2px dashed #cbd5e1',
                background: jugador ? '#ede9fe' : '#f8fafc',
                color: jugador ? '#5b21b6' : '#94a3b8',
                display: 'inline-grid',
                placeItems: 'center',
                fontSize: '12px',
                fontWeight: 900,
              }}
            >
              {jugador ? nombre.charAt(0).toUpperCase() : '+'}
            </span>
          );
        })}
      </div>

      {onJoin ? (
        <button
          type="button"
          onClick={() => onJoin(partido)}
          disabled={joining || faltan <= 0}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 14px',
            background: joining || faltan <= 0 ? '#cbd5e1' : 'linear-gradient(135deg,#22c55e,#16a34a)',
            color: '#fff',
            fontWeight: 900,
            fontSize: '14px',
            cursor: joining || faltan <= 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {joining ? 'Enviando...' : faltan <= 0 ? 'Partido completo' : 'Quiero jugar'}
        </button>
      ) : null}
    </article>
  );
}
