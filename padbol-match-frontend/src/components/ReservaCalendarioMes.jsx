import React, { useMemo, useState, useEffect } from 'react';

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

/**
 * Calendario mensual (Lun–Dom), sin input date.
 * @param {{ selectedIso: string; minIso: string; maxIso: string; todayIso: string; onSelectDay: (iso: string) => void; disabled?: boolean }} props
 */
export default function ReservaCalendarioMes({ selectedIso, minIso, maxIso, todayIso, onSelectDay, disabled }) {
  const minD = useMemo(() => startOfDay(parseIsoLocal(minIso) || new Date()), [minIso]);
  const maxD = useMemo(() => startOfDay(parseIsoLocal(maxIso) || new Date()), [maxIso]);
  const hoyStr = todayIso || minIso;

  const [viewY, setViewY] = useState(() => minD.getFullYear());
  const [viewM, setViewM] = useState(() => minD.getMonth());

  useEffect(() => {
    const sel = parseIsoLocal(selectedIso);
    if (!sel) return;
    setViewY(sel.getFullYear());
    setViewM(sel.getMonth());
  }, [selectedIso]);

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
      const isSelected = selectedIso && iso === selectedIso;
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
  }, [viewY, viewM, minD, maxD, minIso, selectedIso, disabled]);

  const title = `${MESES[viewM]} ${viewY}`;

  return (
    <div className="w-full max-w-md mx-auto rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ←
        </button>
        <div className="min-w-0 flex-1 text-center text-sm font-bold capitalize text-slate-800 sm:text-base">
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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c) =>
          c.empty ? (
            <div key={c.key} className="aspect-square min-h-[2.25rem] sm:min-h-[2.5rem]" aria-hidden />
          ) : (
            <button
              key={c.key}
              type="button"
              disabled={!c.selectable}
              onClick={() => c.selectable && onSelectDay(c.iso)}
              className={[
                'aspect-square min-h-[2.25rem] rounded-lg text-sm font-semibold transition sm:min-h-[2.5rem] sm:text-base',
                c.past ? 'cursor-not-allowed bg-slate-100 text-slate-400' : '',
                !c.past && !c.isSelected && !c.isToday && c.selectable
                  ? 'border border-slate-200 bg-white text-slate-800 hover:border-green-500 hover:bg-green-50'
                  : '',
                c.isToday && !c.isSelected && c.selectable
                  ? 'border-2 border-green-600 bg-white text-slate-900'
                  : '',
                c.isToday && !c.selectable ? 'border border-slate-200 bg-slate-100 text-slate-400 line-through' : '',
                c.isSelected ? 'bg-green-600 text-white shadow-md ring-2 ring-green-600 ring-offset-1' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {c.day}
            </button>
          )
        )}
      </div>
    </div>
  );
}
