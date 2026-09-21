import React from 'react';
import { useSafeTranslation as useTranslation } from '../i18n/tSafe';
import { DEPORTES_PREFERIDOS_OPCIONES, normalizeDeportesPreferidosArray } from '../constants/deportesPreferidos';
import SportIcon from './common/SportIcon';

/**
 * Chips multi-selección para `jugadores_perfil.deportes_preferidos` (claves canónicas).
 * @param {{ value: string[]; onChange: (next: string[]) => void; disabled?: boolean }} props
 */
export default function DeportesPreferidosChips({ value, onChange, disabled }) {
  const { t } = useTranslation();
  const list = normalizeDeportesPreferidosArray(value);
  const set = new Set(list);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {DEPORTES_PREFERIDOS_OPCIONES.map(({ key }) => {
        const on = set.has(key);
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              const next = on ? list.filter((k) => k !== key) : [...list, key];
              onChange(next);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 9999,
              border: on ? '2px solid #E11B22' : '1px solid #cbd5e1',
              background: on ? '#eef2ff' : '#fff',
              color: on ? '#312e81' : '#475569',
              fontWeight: 700,
              fontSize: 13,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <SportIcon deporte={key} size={18} color={on ? '#312e81' : '#475569'} />
            {t(`torneos.deporte.${key}`)}
          </button>
        );
      })}
    </div>
  );
}
