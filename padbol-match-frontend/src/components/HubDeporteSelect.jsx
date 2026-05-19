import React from 'react';
import { DEPORTES_CANCHA_SEDE_OPTIONS } from '../constants/deportesCanchaSede';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { usePadbolLangVersion } from '../hooks/usePadbolLang';

/**
 * Selector «Elegir deporte» del hub (UserHome, Jugar, etc.).
 * La persistencia en sessionStorage la maneja el padre si hace falta.
 */
export default function HubDeporteSelect({ value, onChange, id = 'hub-deporte-select', compact = false }) {
  const { t } = useTranslation();
  usePadbolLangVersion();
  const labelGap = compact ? 4 : 10;
  const blockGap = compact ? 4 : 10;
  return (
    <label style={{ display: 'block', width: '100%', marginBottom: 0, marginTop: 0, flexShrink: 0 }} htmlFor={id}>
      <span
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          marginBottom: labelGap,
        }}
      >
        {t('hub.chooseSport')}
      </span>
      <div style={{ position: 'relative', marginBottom: blockGap }}>
        <select
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            appearance: 'none',
            WebkitAppearance: 'none',
            padding: '10px 40px 10px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            fontSize: 15,
            fontWeight: 400,
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          <option value="">{t('hub.allSports')}</option>
          {DEPORTES_CANCHA_SEDE_OPTIONS.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: 'var(--text-secondary)',
            fontSize: 12,
          }}
        >
          ▼
        </span>
      </div>
    </label>
  );
}
