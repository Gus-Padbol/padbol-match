import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PasswordRecovery from './PasswordRecovery';

test('cada campo de contraseña se muestra y oculta de forma independiente', () => {
  render(<MemoryRouter><PasswordRecovery /></MemoryRouter>);

  const password = screen.getByLabelText('Nueva contraseña');
  const confirmation = screen.getByLabelText('Repetir contraseña');
  expect(password).toHaveAttribute('type', 'password');
  expect(confirmation).toHaveAttribute('type', 'password');

  fireEvent.click(screen.getByRole('button', { name: 'Mostrar nueva contraseña' }));
  expect(password).toHaveAttribute('type', 'text');
  expect(confirmation).toHaveAttribute('type', 'password');
  expect(screen.getByRole('button', { name: 'Ocultar nueva contraseña' })).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña repetida' }));
  expect(password).toHaveAttribute('type', 'text');
  expect(confirmation).toHaveAttribute('type', 'text');

  fireEvent.click(screen.getByRole('button', { name: 'Ocultar nueva contraseña' }));
  expect(password).toHaveAttribute('type', 'password');
  expect(confirmation).toHaveAttribute('type', 'text');
});
