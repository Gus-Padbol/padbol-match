import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import JugadorFichaTorneosSection from './JugadorFichaTorneosSection';

jest.mock('../supabaseClient', () => ({supabase: {auth: {onAuthStateChange: () => ({data: {subscription: {unsubscribe(){}}}})}}}));
jest.mock('../utils/scoreboardApi', () => ({API_BASE: 'https://qa.example.invalid', getAuthHeaders: async () => ({Authorization: 'Bearer jwt'})}));

const identidad = {
  fecha_nacimiento: '1990-01-01', tipo_documento: 'dni', pais_documento: 'AR', nacionalidad: 'AR',
  genero: 'masculino', categoria_deportiva: '2da', telefono: '1123456789',
  numero_documento_mascarado: '****1234', estado: 'verificada',
};
test('identidad guardada invoca onSaved para recheck Napoli', async () => {
  const onSaved = jest.fn();
  global.fetch = jest.fn(async (url, opts) => {
    if (opts?.method === 'PUT') return {ok: true, json: async () => ({ok: true})};
    return {ok: true, json: async () => identidad};
  });
  render(<JugadorFichaTorneosSection perfil={{nombre: 'Ana', apellido: 'Paz', genero: 'masculino'}} whatsappFallback="1123456789" requireCategoriaDeportiva onSaved={onSaved} />);
  await screen.findByRole('button', {name: 'Guardar ficha'});
  await waitFor(() => expect(screen.getByDisplayValue('1990-01-01')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', {name: 'Guardar ficha'}));
  await waitFor(() => expect(global.fetch.mock.calls.some(([, o]) => o?.method === 'PUT')).toBe(true));
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  expect(global.fetch.mock.calls.some(([, o]) => o?.method === 'PUT')).toBe(true);
});
