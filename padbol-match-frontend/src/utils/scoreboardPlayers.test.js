import {
  getScoreboardJerseyLabel,
  listVisibleScoreboardJugadores,
  hasScoreboardPlayerName,
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

  it('identidad válida = nombre no vacío', () => {
    expect(hasScoreboardPlayerName({ nombre: 'X' })).toBe(true);
    expect(hasScoreboardPlayerName({ jersey: 9 })).toBe(false);
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
});
