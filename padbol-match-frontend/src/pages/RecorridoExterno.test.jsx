import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen } from '@testing-library/react';
import RecorridoExterno from './RecorridoExterno';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ session: null }),
}));

jest.mock('../components/AppHeader', () => function AppHeaderMock({ title, onBack }) {
  return <header><button type="button" onClick={onBack}>Volver</button>{title}</header>;
});

describe('recorrido externo público', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    window.scrollTo = jest.fn();
    window.requestAnimationFrame = (callback) => {
      callback();
      return 1;
    };
    window.cancelAnimationFrame = jest.fn();
  });

  it('explica las tres capturas antes de solicitar una cuenta', () => {
    render(<RecorridoExterno />);

    expect(screen.getByRole('heading', { name: 'Trae tu nivel. Lo reconocemos.' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Tu perfil y nivel actual')).toBeInTheDocument();
    expect(screen.getByText('Resultados recientes')).toBeInTheDocument();
    expect(screen.getByText('Ranking, torneo o logro')).toBeInTheDocument();
    expect(screen.queryByLabelText('Sube tus tres capturas')).not.toBeInTheDocument();
  });

  it('solicita el registro recién al elegir subir las capturas', () => {
    render(<RecorridoExterno />);

    fireEvent.click(screen.getByRole('button', { name: 'Subirlas ahora' }));
    expect(mockNavigate).toHaveBeenCalledWith('/acceso?modo=registro&redirect=%2Fmi-perfil%2Frecorrido');
  });

  it('vuelve a la sección exacta de la plataforma desde el único botón superior', () => {
    render(<RecorridoExterno />);

    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(mockNavigate).toHaveBeenCalledWith('/plataforma#tu-recorrido');
    expect(screen.queryByText('Volver a la plataforma')).not.toBeInTheDocument();
  });

  it('mantiene pública la explicación en el enrutador', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
    expect(source).toContain('path="/mi-perfil/recorrido" element={<RecorridoExterno />}');
    expect(source).not.toContain('path="/mi-perfil/recorrido" element={<ProtectedRoute><RecorridoExterno /></ProtectedRoute>}');
  });
});
