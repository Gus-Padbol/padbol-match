import {
  getScoreboardJerseyLabel,
  listVisibleScoreboardJugadores,
  hasScoreboardPlayerName,
  hasRealScoreboardPlayerIdentity,
  isPlaceholderScoreboardPlayerName,
} from './scoreboardPlayers';
import fs from 'fs';
import path from 'path';

describe('listVisibleScoreboardJugadores', () => {
  it('filtra null, undefined y sin nombre; no rellena plazas', () => {
    const input = [
      null,
      undefined,
      {},
      { nombre: '  ' },
      { name: 'Ana', jersey: 7 },
      { nombre: 'Luis', numero: 12 },
      { nombre: 'Extra3' },
      { nombre: 'Extra4' },
      { nombre: 'Extra5' },
    ];
    const visible = listVisibleScoreboardJugadores(input, 4);
    expect(visible.map((j) => j.nombre || j.name)).toEqual(['Ana', 'Luis', 'Extra3', 'Extra4']);
    expect(visible).toHaveLength(4);
  });

  it('devuelve exactamente 2 o 3 cuando hay esos registrados', () => {
    expect(listVisibleScoreboardJugadores([{ nombre: 'A' }, { nombre: 'B' }])).toHaveLength(2);
    expect(
      listVisibleScoreboardJugadores([{ nombre: 'A' }, { nombre: 'B' }, { nombre: 'C' }]),
    ).toHaveLength(3);
  });

  it('no inventa dorsales: getScoreboardJerseyLabel solo si hay número válido', () => {
    expect(getScoreboardJerseyLabel({ nombre: 'Ana', jersey: 7 })).toBe('7');
    expect(getScoreboardJerseyLabel({ nombre: 'Ana' })).toBeNull();
    expect(getScoreboardJerseyLabel({ nombre: 'Ana', numero: 0 })).toBeNull();
  });

  it('identidad válida = nombre real (no placeholder)', () => {
    expect(hasScoreboardPlayerName({ nombre: 'X' })).toBe(true);
    expect(hasScoreboardPlayerName({ jersey: 9 })).toBe(false);
    expect(hasScoreboardPlayerName({ nombre: '—' })).toBe(false);
  });
});

describe('regresión slots residuales (3 — / 4 —)', () => {
  it('rechaza { numero: 3, nombre: "—" }', () => {
    expect(isPlaceholderScoreboardPlayerName('—')).toBe(true);
    expect(hasRealScoreboardPlayerIdentity({ numero: 3, nombre: '—' })).toBe(false);
    expect(listVisibleScoreboardJugadores([{ numero: 3, nombre: '—' }])).toEqual([]);
  });

  it('rechaza { dorsal: 4 } sin jugador', () => {
    expect(hasRealScoreboardPlayerIdentity({ dorsal: 4 })).toBe(false);
    expect(listVisibleScoreboardJugadores([{ dorsal: 4, numero: 4, jersey: 4 }])).toEqual([]);
  });

  it('rechaza nombre vacío o solo espacios', () => {
    expect(listVisibleScoreboardJugadores([{ nombre: '' }])).toEqual([]);
    expect(listVisibleScoreboardJugadores([{ name: '   ' }])).toEqual([]);
  });

  it('rechaza slots backend con jersey de posición y nombre vacío', () => {
    const residual = [
      { slot: 1, nombre: 'Juan', jersey: 7, numero: 7 },
      { slot: 2, nombre: 'Pedro', jersey: 12, numero: 12 },
      { slot: 3, nombre: '', jersey: 3, numero: 3 },
      { slot: 4, nombre: '', jersey: 4, numero: 4 },
    ];
    const visible = listVisibleScoreboardJugadores(residual);
    expect(visible).toHaveLength(2);
    expect(visible.map((j) => j.nombre)).toEqual(['Juan', 'Pedro']);
    expect(visible.every((j) => !['—', '-', ''].includes(String(j.nombre || '').trim()))).toBe(true);
  });

  it('acepta jugador real con id o nombre; dorsal solo tras identidad', () => {
    expect(hasRealScoreboardPlayerIdentity({ jugador_id: 'abc-123-def', nombre: '' })).toBe(true);
    expect(hasRealScoreboardPlayerIdentity({ nombre: 'María', jersey: 9 })).toBe(true);
    expect(getScoreboardJerseyLabel({ nombre: 'María', jersey: 9 })).toBe('9');
    expect(getScoreboardJerseyLabel({ numero: 3, nombre: '—' })).toBe('3'); // label existe…
    expect(hasRealScoreboardPlayerIdentity({ numero: 3, nombre: '—' })).toBe(false); // …pero no se lista
  });

  it('no trata id/slot 1–4 como identidad sin nombre real', () => {
    expect(hasRealScoreboardPlayerIdentity({ id: 3, numero: 3 })).toBe(false);
    expect(hasRealScoreboardPlayerIdentity({ id: 3, nombre: '—' })).toBe(false);
  });
});

describe('marcador — sin placeholders de jugadores vacíos', () => {
  const boardSrc = fs.readFileSync(
    path.join(__dirname, '../components/scoreboard/ScoreboardBoard.jsx'),
    'utf8',
  );
  const controlSrc = fs.readFileSync(
    path.join(__dirname, '../pages/ScoreboardControl.jsx'),
    'utf8',
  );
  const previewSrc = fs.readFileSync(
    path.join(__dirname, '../components/admin/AdminScoreboardPartidoPreview.jsx'),
    'utf8',
  );

  it('ScoreboardBoard no rellena a 4 ni renderiza sb-player--empty', () => {
    expect(boardSrc).toMatch(/listVisibleScoreboardJugadores/);
    expect(boardSrc).not.toMatch(/while\s*\(\s*list\.length\s*<\s*4\s*\)/);
    expect(boardSrc).not.toMatch(/sb-player--empty/);
    expect(boardSrc).not.toMatch(/sb-player__name--placeholder/);
  });

  it('ScoreboardControl no fuerza 2 slots vacíos', () => {
    expect(controlSrc).toMatch(/listVisibleScoreboardJugadores/);
    expect(controlSrc).not.toMatch(/sc-player--empty/);
    expect(controlSrc).not.toMatch(/\[0,\s*1\]\.map/);
  });

  it('AdminScoreboardPartidoPreview usa el mismo filtro y no inventa "—"', () => {
    expect(previewSrc).toMatch(/listVisibleScoreboardJugadores/);
    expect(previewSrc).not.toMatch(/nombre:\s*nombre\s*\|\|\s*['"]—['"]/);
  });
});
