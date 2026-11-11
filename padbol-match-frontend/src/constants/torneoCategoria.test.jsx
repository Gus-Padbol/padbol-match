import React from 'react';
import { render, screen } from '@testing-library/react';
import { CATEGORIA_TORNEO_DEFAULT, TORNEO_CATEGORIA_OPTIONS } from './torneoCategoria';
import { formatCategoriaTorneo } from '../utils/torneoFormatters';
import { filtrarTorneos } from '../utils/torneoProgramaUI';
import es from '../i18n/locales/es.json';
import en from '../i18n/locales/en.json';
import pt from '../i18n/locales/pt.json';

test('shared editor choices retain stored Elite and public category filter distinguishes Libre', () => {
  render(<select aria-label="Tournament category" value="Elite" onChange={() => {}}>
    {TORNEO_CATEGORIA_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
  </select>);
  expect(screen.getByRole('combobox').value).toBe('Elite');
  expect(screen.getByRole('option', { name: 'Elite' }).selected).toBe(true);
  expect(TORNEO_CATEGORIA_OPTIONS.filter(({ value }) => value === 'Elite')).toHaveLength(1);
  expect(CATEGORIA_TORNEO_DEFAULT).toBe('Libre');
  expect(formatCategoriaTorneo('Elite')).toBe('Elite');
  expect(filtrarTorneos([{ id: 57, categoria: 'Elite' }, { id: 23, categoria: 'Libre' }], { nivel: 'Elite' }).map(t => t.id)).toEqual([57]);
  [es, en, pt].forEach(locale => expect(locale.torneos.vista.categoriaNivel.Elite).toBe('Elite'));
});
