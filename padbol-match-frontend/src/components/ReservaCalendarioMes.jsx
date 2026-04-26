import React, { useMemo, useState, useEffect } from 'react';
import styles from './ReservaCalendarioMes.module.css';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function parseIsoLocal(iso) {
  const [y, m, d] = String(iso || '').split('-').map((x) => parseInt(x, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function toIsoLocal(d) {
  if (!d || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Lunes = 0 … Domingo = 6 (columna en grid Lun–Dom) */
function mondayIndexFromDate(d) {
  const dow = d.getDay();
  return dow === 0 ? 6 : dow - 1;
}

function dayButtonClass(c) {
  if (c.isSelected) return `${styles.dayBtn} ${styles.daySelected}`;
  if (!c.selectable) {
    if (c.isToday) return `${styles.dayBtn} ${styles.dayTodayPast}`;
    return `${styles.dayBtn} ${styles.dayPast}`;
  }
  if (c.isToday) return `${styles.dayBtn} ${styles.dayToday}`;
  return `${styles.dayBtn} ${styles.dayAvailable}`;
}

/**
 * Calendario mensual (Lun–Dom), sin input date.
 * @param {{ selectedIso: string; minIso: string; maxIso: string; todayIso: string; onSelectDay: (iso: string) => void; disabled?: boolean }} props
 */
export default function ReservaCalendarioMes({ selectedIso, minIso, maxIso, todayIso, onSelectDay, disabled }) {
  const minD = useMemo(() => startOfDay(parseIsoLocal(minIso) || new Date()), [minIso]);
  const maxD = useMemo(() => startOfDay(parseIsoLocal(maxIso) || new Date()), [maxIso]);
  const hoyStr = todayIso || minIso;

  /** Si aún no hay fecha en el padre, el calendario muestra hoy con el mismo estilo que “seleccionado”. */
  const effectiveSelectedIso = (selectedIso && String(selectedIso).trim()) || hoyStr;

  const [viewY, setViewY] = useState(() => minD.getFullYear());
  const [viewM, setViewM] = useState(() => minD.getMonth());

  useEffect(() => {
    const sel = parseIsoLocal(effectiveSelectedIso);
    if (!sel) return;
    setViewY(sel.getFullYear());
    setViewM(sel.getMonth());
  }, [effectiveSelectedIso]);

  const firstNextMonth = useMemo(() => new Date(viewY, viewM + 1, 1), [viewY, viewM]);
  const prevDisabled = useMemo(() => {
    const firstThis = new Date(viewY, viewM, 1);
    const firstMinMonth = new Date(minD.getFullYear(), minD.getMonth(), 1);
    return firstThis.getTime() <= firstMinMonth.getTime();
  }, [viewY, viewM, minD]);

  const nextDisabled = useMemo(() => firstNextMonth > maxD, [firstNextMonth, maxD]);

  const cells = useMemo(() => {
    const first = new Date(viewY, viewM, 1, 12, 0, 0, 0);
    const lead = mondayIndexFromDate(first);
    const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
    const list = [];
    for (let i = 0; i < lead; i += 1) list.push({ key: `e-${i}`, empty: true });
    for (let day = 1; day <= daysInMonth; day += 1) {
      const cellDate = new Date(viewY, viewM, day, 12, 0, 0, 0);
      const iso = toIsoLocal(cellDate);
      const sod = startOfDay(cellDate);
      const past = sod < minD;
      const afterMax = sod > maxD;
      const selectable = !past && !afterMax && !disabled;
      const isToday = iso === hoyStr;
      const isSelected = iso === effectiveSelectedIso;
      list.push({
        key: iso,
        empty: false,
        day,
        iso,
        selectable,
        past: past || afterMax,
        isToday,
        isSelected,
      });
    }
    return list;
  }, [viewY, viewM, minD, maxD, effectiveSelectedIso, disabled, hoyStr]);

  const title = `${MESES[viewM]} ${viewY}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.navRow}>
        <button
          type="button"
          aria-label="Mes anterior"
          disabled={prevDisabled}
          onClick={() => {
            if (prevDisabled) return;
            setViewM((m) => {
              if (m === 0) {
                setViewY((y) => y - 1);
                return 11;
              }
              return m - 1;
            });
          }}
          className={styles.navBtn}
        >
          ←
        </button>
        <div className={styles.title}>
          {title}
        </div>
        <button
          type="button"
          aria-label="Mes siguiente"
          disabled={nextDisabled}
          onClick={() => {
            if (nextDisabled) return;
            setViewM((m) => {
              if (m === 11) {
                setViewY((y) => y + 1);
                return 0;
              }
              return m + 1;
            });
          }}
          className={styles.navBtn}
        >
          →
        </button>
      </div>
      <div className={styles.weekHeader}>
        {DIAS_SEMANA.map((d) => (
          <div key={d} className={styles.weekHeaderCell}>
            {d}
          </div>
        ))}
      </div>
      <div className={styles.grid}>
        {cells.map((c) =>
          c.empty ? (
            <div key={c.key} className={styles.cellEmpty} aria-hidden />
          ) : (
            <button
              key={c.key}
              type="button"
              disabled={!c.selectable}
              onClick={() => c.selectable && onSelectDay(c.iso)}
              className={dayButtonClass(c)}
            >
              {c.day}
            </button>
          )
        )}
      </div>
    </div>
  );
}
