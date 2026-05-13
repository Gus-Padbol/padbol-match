import React, { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_PLACEHOLDER = 'Buscar sede por nombre, ciudad o país...';

function normalizeSearchText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function defaultSedeLabel(sede) {
  return String(sede?.nombre || '').trim();
}

function defaultSedeDetail(sede) {
  return [sede?.ciudad, sede?.pais].map((x) => String(x || '').trim()).filter(Boolean).join(' · ');
}

export default function SedeSearchInput({
  sedes,
  valueId,
  onChangeId,
  placeholder = DEFAULT_PLACEHOLDER,
  disabled = false,
  inputStyle = {},
  dropdownStyle = {},
  formatLabel = defaultSedeLabel,
  formatDetail = defaultSedeDetail,
  maxResults = 8,
  minChars = 2,
  allowClear = true,
  ariaLabel = 'Buscar sede',
}) {
  const allSedes = useMemo(() => (Array.isArray(sedes) ? sedes : []), [sedes]);
  const selectedSede = useMemo(
    () => allSedes.find((sede) => String(sede.id) === String(valueId || '')) || null,
    [allSedes, valueId]
  );
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const blurTimerRef = useRef(null);
  const skipNextEmptySyncRef = useRef(false);

  useEffect(() => {
    if (!valueId && skipNextEmptySyncRef.current) {
      skipNextEmptySyncRef.current = false;
      return;
    }
    setQuery(selectedSede ? formatLabel(selectedSede) : '');
  }, [selectedSede, valueId]); // eslint-disable-line react-hooks/exhaustive-deps

  const normalizedQuery = normalizeSearchText(query);
  const showAllOnFocus = allSedes.length > 0 && allSedes.length < maxResults;

  const results = useMemo(() => {
    if (disabled) return [];
    const shouldShowAll = open && showAllOnFocus;
    if (!shouldShowAll && normalizedQuery.length < minChars) return [];

    const filtered = shouldShowAll
      ? allSedes
      : allSedes.filter((sede) => {
          const haystack = normalizeSearchText([sede?.nombre, sede?.ciudad, sede?.pais].join(' '));
          return haystack.includes(normalizedQuery);
        });

    return filtered.slice(0, maxResults);
  }, [allSedes, disabled, maxResults, minChars, normalizedQuery, open, showAllOnFocus]);

  const showDropdown = open && results.length > 0 && !disabled;

  const selectSede = (sede) => {
    if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    onChangeId?.(String(sede.id));
    setQuery(formatLabel(sede));
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimerRef.current = window.setTimeout(() => setOpen(false), 140);
        }}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          if (allowClear && String(valueId || '').trim()) {
            skipNextEmptySyncRef.current = true;
            onChangeId?.('');
          }
        }}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          ...inputStyle,
        }}
      />

      {showDropdown ? (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            zIndex: 80,
            left: 0,
            right: 0,
            top: '100%',
            margin: '4px 0 0',
            padding: '6px 0',
            listStyle: 'none',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)',
            maxHeight: '280px',
            overflowY: 'auto',
            ...dropdownStyle,
          }}
        >
          {results.map((sede) => {
            const label = formatLabel(sede);
            const detail = formatDetail(sede);
            return (
              <li key={String(sede.id)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={String(sede.id) === String(valueId || '')}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSede(sede)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    padding: '9px 12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span style={{ display: 'block', fontSize: '14px', fontWeight: 800 }}>{label}</span>
                  {detail ? (
                    <span style={{ display: 'block', marginTop: '2px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {detail}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
