import React from 'react';
import { useSafeTranslation } from '../../i18n/tSafe';
import { countryLabelFromIso } from '../../utils/countryRankingDisplay';

const MEDAL = ['🥇', '🥈', '🥉'];

const thStyle = (narrow) => ({
  padding: narrow ? '8px 6px' : '11px 14px',
  fontSize: narrow ? '10px' : '11px',
  fontWeight: '700',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: narrow ? '0.04em' : '0.06em',
  background: 'var(--pm-color-muted-bg)',
  borderBottom: '2px solid var(--border)',
  whiteSpace: 'nowrap',
});

const tdStyle = (narrow) => ({ padding: narrow ? '8px 6px' : '11px 14px', verticalAlign: 'middle' });

const stateStyle = {
  padding: '60px 20px',
  textAlign: 'center',
  color: 'var(--text-secondary)',
  fontSize: '15px',
  fontWeight: '600',
};

function positionBadge(position, narrow) {
  if (position == null) return <span style={{ color: 'var(--text-secondary)' }}>—</span>;
  if (position <= 3) {
    return <span style={{ fontSize: narrow ? '17px' : '20px' }}>{MEDAL[position - 1]}</span>;
  }
  return <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>{position}</span>;
}

/**
 * Country ranking table. The backend already resolved positions with shared
 * ties, so this component never re-sorts or invents a tie-break.
 */
export default function CountryRankingTable({
  items = [],
  loading = false,
  error = false,
  onRetry,
  narrow = false,
}) {
  const { t, i18n } = useSafeTranslation();
  const locale = i18n?.resolvedLanguage || i18n?.language || 'en';

  if (loading) {
    return (
      <div role="status" aria-live="polite" style={stateStyle}>
        {t('ranking.countriesLoading')}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" style={stateStyle}>
        <div>{t('ranking.countriesError')}</div>
        {typeof onRetry === 'function' ? (
          <button
            type="button"
            onClick={onRetry}
            style={{
              marginTop: '14px',
              minHeight: '44px',
              padding: '10px 18px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            {t('ranking.countriesRetry')}
          </button>
        ) : null}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div role="status" style={{ ...stateStyle, fontWeight: '400' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🌍</div>
        <div style={{ fontWeight: '600' }}>{t('ranking.countriesEmpty')}</div>
        <div style={{ fontSize: '12px', marginTop: '6px', lineHeight: 1.5 }}>
          {t('ranking.countriesEmptyHint')}
        </div>
      </div>
    );
  }

  const pendingTournaments = items.reduce((total, row) => total + (row.torneos_pendientes || 0), 0);

  return (
    <>
      <table
        aria-label={t('ranking.countriesTableAria')}
        style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}
      >
        <colgroup>
          <col style={{ width: narrow ? '44px' : '56px' }} />
          <col />
          {narrow ? null : <col style={{ width: '22%' }} />}
          <col style={{ width: narrow ? '34%' : '24%' }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" style={{ ...thStyle(narrow), textAlign: 'center' }}>#</th>
            <th scope="col" style={{ ...thStyle(narrow), textAlign: 'left' }}>{t('ranking.country')}</th>
            {narrow ? null : (
              <th scope="col" style={{ ...thStyle(narrow), textAlign: 'center' }}>{t('ranking.tournaments')}</th>
            )}
            <th scope="col" style={{ ...thStyle(narrow), textAlign: 'center', color: 'var(--accent)' }}>
              {t('ranking.points')}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, index) => (
            <tr
              key={row.pais}
              style={{
                background: index === 0 ? 'rgba(217, 119, 6, 0.14)' : index === 1 ? 'var(--pm-color-muted-bg)' : index === 2 ? 'rgba(217, 119, 6, 0.08)' : 'var(--bg-card)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <td style={{ ...tdStyle(narrow), textAlign: 'center' }}>{positionBadge(row.posicion, narrow)}</td>
              <td style={{ ...tdStyle(narrow), minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: narrow ? '13px' : '14px', fontWeight: '600' }}>
                {countryLabelFromIso(row.pais, locale) || row.pais}
              </td>
              {narrow ? null : (
                <td style={{ ...tdStyle(narrow), textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {row.torneos_count}
                </td>
              )}
              <td style={{ ...tdStyle(narrow), textAlign: 'center' }}>
                {row.pendiente ? (
                  <span style={{ fontSize: narrow ? '10px' : '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                    {t('ranking.countriesPending')}
                  </span>
                ) : (
                  <span
                    style={{
                      background: 'rgba(139, 92, 246, 0.18)',
                      color: 'var(--accent)',
                      borderRadius: '10px',
                      padding: narrow ? '2px 8px' : '3px 12px',
                      fontSize: narrow ? '12px' : '14px',
                      fontWeight: '800',
                      display: 'inline-block',
                    }}
                  >
                    {row.puntos_total}
                    {row.torneos_pendientes > 0 ? (
                      <span title={t('ranking.countriesPendingNote', { count: row.torneos_pendientes })}> *</span>
                    ) : null}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: 'var(--text-secondary)', padding: '0 12px 16px' }}>
        <div>{t('ranking.countriesShown', { count: items.length })}</div>
        {pendingTournaments > 0 ? (
          <div style={{ marginTop: '4px' }}>{t('ranking.countriesPendingNote', { count: pendingTournaments })}</div>
        ) : null}
        <div style={{ marginTop: '4px', opacity: 0.9 }}>{t('ranking.countriesTieNote')}</div>
      </div>
    </>
  );
}
