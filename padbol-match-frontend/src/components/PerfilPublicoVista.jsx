import { useNavigate } from 'react-router-dom';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { formatAliasConArroba, esCategoriaPendienteValidacion } from '../utils/jugadorPerfil';
import { DEPORTES_PREFERIDOS_OPCIONES } from '../constants/deportesPreferidos';
import { etiquetaDeporteTorneo } from '../utils/torneoDeporteFormato';
import SportIcon from './common/SportIcon';
import ShareLinkButton from './ShareLinkButton';
import './PerfilPublicoVista.css';

const CATEGORIA_COLOR = {
  Principiante: '#78909c',
  '5ta': '#43a047',
  '4ta': '#039be5',
  '3ra': '#8e24aa',
  '2da': '#e53935',
  '1ra': '#f57c00',
  Elite: '#212121',
};

function torneoBadgeClass(posicion) {
  const n = Number(posicion);
  if (n === 1) return 'pp-publico__torneo-badge pp-publico__torneo-badge--gold';
  if (n === 2) return 'pp-publico__torneo-badge pp-publico__torneo-badge--silver';
  if (n === 3) return 'pp-publico__torneo-badge pp-publico__torneo-badge--bronze';
  return 'pp-publico__torneo-badge pp-publico__torneo-badge--gray';
}

function torneoBadgeLabel(t, posicion) {
  const n = Number(posicion);
  if (n === 1) return t('perfilPublico.badgeWinner');
  if (n === 2) return t('perfilPublico.badgeSecond');
  if (n === 3) return t('perfilPublico.badgeThird');
  if (Number.isFinite(n) && n > 0) return t('perfilPublico.badgeParticipant', { pos: n });
  return t('perfilPublico.badgeParticipantGeneric');
}

function deporteLabel(key) {
  const k = String(key || '').trim().toLowerCase();
  return DEPORTES_PREFERIDOS_OPCIONES.find((o) => o.key === k)?.label || etiquetaDeporteTorneo(k) || k;
}

export default function PerfilPublicoVista({
  data,
  shareMeta,
  shareUrl,
  onOpenQr,
  perfilRow,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!data) return null;

  const avatarUrl = String(data.avatar_url || data.foto_url || '').trim();
  const displayName = String(data.display_name || '').trim() || t('perfilPublico.playerFallback');
  const username = String(data.username || '').trim();
  const nivel = String(data.nivel || '').trim();
  const lateralidad = String(data.lateralidad || '').trim();
  const categoriaColor = CATEGORIA_COLOR[nivel] || '#64748b';
  const stats = data.estadisticas || {};
  const deportes = Array.isArray(data.deportes) ? data.deportes : [];
  const torneos = Array.isArray(data.torneos_recientes)
    ? data.torneos_recientes
    : Array.isArray(data.historial_torneos)
      ? data.historial_torneos
      : [];
  const ini = displayName.charAt(0).toUpperCase() || '?';

  return (
    <>
      <section className="pp-publico__header">
        <div className="pp-publico__avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <div className="pp-publico__avatar-fallback" aria-hidden>
              {ini}
            </div>
          )}
        </div>

        <h1 className="pp-publico__display-name">{displayName}</h1>
        {username ? (
          <p className="pp-publico__username">{formatAliasConArroba(username)}</p>
        ) : null}

        <div className="pp-publico__meta-row">
          {data.pais_flag || data.pais_nombre ? (
            <span className="pp-publico__chip">
              {data.pais_flag ? <span aria-hidden>{data.pais_flag}</span> : null}
              {data.pais_nombre || data.pais || ''}
            </span>
          ) : null}
          {nivel ? (
            <span className="pp-publico__chip pp-publico__chip--nivel" style={{ background: categoriaColor }}>
              {nivel}
              {esCategoriaPendienteValidacion(perfilRow || data.perfil) ? ' ⏳' : ''}
            </span>
          ) : null}
          {lateralidad ? <span className="pp-publico__chip">{lateralidad}</span> : null}
        </div>

        <div className="pp-publico__actions">
          {shareUrl ? (
            <ShareLinkButton shareTitle={shareMeta.title} shareText={shareMeta.text} url={shareMeta.url} style={{ width: '100%' }}>
              {t('perfilPublico.shareProfile')}
            </ShareLinkButton>
          ) : null}
          {onOpenQr ? (
            <button
              type="button"
              onClick={onOpenQr}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 12px',
                background: 'var(--accent)',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t('perfilPublico.myQr')}
            </button>
          ) : null}
        </div>
      </section>

      <section className="pp-publico__section">
        <h2 className="pp-publico__section-title">{t('perfilPublico.statsTitle')}</h2>
        <div className="pp-publico__stats-grid">
          <div className="pp-publico__stat-card">
            <div className="pp-publico__stat-label">{t('perfilPublico.tournamentsPlayed')}</div>
            <div className="pp-publico__stat-value">{Number(stats.torneos_jugados) || 0}</div>
          </div>
          <div className="pp-publico__stat-card">
            <div className="pp-publico__stat-label">{t('perfilPublico.tournamentsWon')}</div>
            <div className="pp-publico__stat-value">{Number(stats.torneos_ganados) || 0}</div>
          </div>
          <div className="pp-publico__stat-card">
            <div className="pp-publico__stat-label">{t('perfilPublico.matchesPlayed')}</div>
            <div className="pp-publico__stat-value">{Number(stats.partidos_jugados) || 0}</div>
          </div>
          <div className="pp-publico__stat-card">
            <div className="pp-publico__stat-label">{t('perfilPublico.matchesWon')}</div>
            <div className="pp-publico__stat-value">{Number(stats.partidos_ganados) || 0}</div>
          </div>
        </div>
      </section>

      {deportes.length > 0 ? (
        <section className="pp-publico__section">
          <h2 className="pp-publico__section-title">{t('perfilPublico.sportsTitle')}</h2>
          <div className="pp-publico__deportes">
            {deportes.map((key) => (
              <span key={key} className="pp-publico__deporte-chip">
                <SportIcon deporte={key} size={18} color="var(--text-primary)" />
                {deporteLabel(key)}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="pp-publico__section">
        <h2 className="pp-publico__section-title">{t('perfilPublico.recentTournamentsTitle')}</h2>
        {torneos.length === 0 ? (
          <p className="pp-publico__empty">{t('perfilPublico.noRecentTournaments')}</p>
        ) : (
          <div className="pp-publico__torneos-list">
            {torneos.map((row) => (
              <button
                key={`${row.torneo_id}-${row.posicion}`}
                type="button"
                className="pp-publico__torneo-item"
                onClick={() => navigate(`/torneo/${row.torneo_id}`)}
              >
                <div className="pp-publico__torneo-body">
                  <p className="pp-publico__torneo-name">{row.nombre}</p>
                  <p className="pp-publico__torneo-meta">
                    {[row.sede, row.deporte, row.fecha].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className={torneoBadgeClass(row.posicion)}>{torneoBadgeLabel(t, row.posicion)}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
