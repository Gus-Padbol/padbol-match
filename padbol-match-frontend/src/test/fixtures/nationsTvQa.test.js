import {QA_NATIONS_BOARD_ID, QA_NATIONS_TV_FIXTURE, isQaNationsTvFixture} from './nationsTvQa';

test('QA fixture is enabled only for qa + exact scoreboard UUID + Nations mode', () => {
  expect(isQaNationsTvFixture({variant:'qa', mode:'nations', scoreboardId:QA_NATIONS_BOARD_ID})).toBe(true);
  for (const input of [
    {variant:'production', mode:'nations', scoreboardId:QA_NATIONS_BOARD_ID},
    {variant:'qa', mode:'legacy', scoreboardId:QA_NATIONS_BOARD_ID},
    {variant:'qa', mode:'nations', scoreboardId:'11111111-1111-4111-8111-111111111111'},
  ]) expect(isQaNationsTvFixture(input)).toBe(false);
  expect(QA_NATIONS_TV_FIXTURE.equipo_a_jugadores.map(p=>p.nombre)).toEqual(['Marco Rossi','Luca Bianchi','Paolo Conti','Andrea Ricci']);
  expect(QA_NATIONS_TV_FIXTURE.equipo_b_jugadores.map(p=>p.nombre)).toEqual(['Carlos Martín','Javier López','Pablo García','Diego Ruiz']);
});

import {canChangeQaPair, changeQaPair} from './nationsTvQa';

test('one-tap pair change requires exactly two active and two bench', () => {
  const team = {active: QA_NATIONS_TV_FIXTURE.equipo_a_jugadores.filter(p=>p.role==='on_court'), bench: QA_NATIONS_TV_FIXTURE.equipo_a_jugadores.filter(p=>p.role==='bench')};
  expect(canChangeQaPair(team)).toBe(true);
  expect(canChangeQaPair({active:team.active, bench:team.bench.slice(0,1)})).toBe(false);
  const changed = changeQaPair(team);
  expect(changed.active.map(p=>p.nombre)).toEqual(['Paolo Conti','Andrea Ricci']);
  expect(changed.bench.map(p=>p.nombre)).toEqual(['Marco Rossi','Luca Bianchi']);
});
