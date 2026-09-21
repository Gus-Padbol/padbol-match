import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import FipaDocuments, {
  canAccessFipaDocument,
  formFromProfile,
  memberRequestBodyFromProfile,
  profileHasVenue,
} from './FipaDocuments';
import {
  FIPA_DOCUMENT_CATALOG,
  fetchFipaAccountEligibility,
  fetchFipaDocuments,
  fetchFipaLibraryState,
  fetchOfficialFipaVenues,
  mergeFipaDocumentCatalog,
  normalizeFipaLibraryState,
} from '../utils/fipaDocumentsApi';

jest.mock('../components/AppHeader', () => () => null);
let mockSession;
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ session: mockSession, userProfile: null, loading: false }),
}));
jest.mock('../i18n/tSafe', () => ({
  useSafeTranslation: () => ({ t: (key, fallback) => fallback || key }),
}));
jest.mock('../utils/legalDocuments', () => ({
  registerCurrentAccountEligibility: jest.fn(),
}));
jest.mock('../utils/fipaDocumentsApi', () => {
  const actual = jest.requireActual('../utils/fipaDocumentsApi');
  return {
    ...actual,
    fetchFipaAccountEligibility: jest.fn(),
    fetchFipaDocuments: jest.fn(),
    fetchFipaLibraryState: jest.fn(),
    fetchOfficialFipaVenues: jest.fn(),
    submitFipaAccessRequest: jest.fn(),
    submitFipaInterestProfile: jest.fn(),
    downloadFipaDocument: jest.fn(),
  };
});

describe('Biblioteca FIPA', () => {
  const publicDocument = { accessLevel: 'authenticated' };
  const memberDocument = { accessLevel: 'member' };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockSession = { access_token: 'test-token', user: { email: 'persona@example.com' } };
    fetchFipaAccountEligibility.mockResolvedValue({ allowed: true });
    fetchFipaDocuments.mockResolvedValue(mergeFipaDocumentCatalog(
      FIPA_DOCUMENT_CATALOG.map((documentItem, index) => ({
        id: `document-${index}`,
        slug: documentItem.slug,
        status: 'published',
      })),
    ));
    fetchOfficialFipaVenues.mockResolvedValue([]);
  });

  function CurrentLocation() {
    const location = useLocation();
    return <output data-testid="current-location">{location.pathname}{location.search}</output>;
  }

  function renderProtectedLibrary() {
    return render(
      <MemoryRouter initialEntries={['/fipa/documentos?document=reglamento-oficial']}>
        <Routes>
          <Route path="/fipa/documentos" element={<ProtectedRoute><FipaDocuments /><CurrentLocation /></ProtectedRoute>} />
          <Route path="/login" element={<CurrentLocation />} />
          <Route path="*" element={<div>Destino inesperado</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('el router anónimo conserva el documento exacto al enviar al login', async () => {
    mockSession = null;
    renderProtectedLibrary();
    await waitFor(() => expect(screen.getByTestId('current-location')).toHaveTextContent('/login?redirect=%2Ffipa%2Fdocumentos%3Fdocument%3Dreglamento-oficial'));
    expect(screen.queryByText('Destino inesperado')).not.toBeInTheDocument();
  });

  it.each(['user', 'super_admin'])('el router autenticado abre FIPA sin gate deportivo para %s', async (role) => {
    mockSession = { access_token: 'test-token', user: { email: 'persona@example.com', app_metadata: { role } } };
    fetchFipaLibraryState.mockResolvedValue(normalizeFipaLibraryState({}));
    sessionStorage.setItem('padbol_partidos_buscar_return', '/jugar/buscar');
    renderProtectedLibrary();
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Acceso restringido' })).toHaveLength(9));
    expect(screen.getByTestId('current-location')).toHaveTextContent('/fipa/documentos?document=reglamento-oficial');
    expect(sessionStorage.getItem('padbol_partidos_buscar_return')).toBe('/jugar/buscar');
    expect(screen.queryByText('Destino inesperado')).not.toBeInTheDocument();
  });

  it('bloquea todos los documentos hasta guardar la ficha de interés', () => {
    const state = { interestCompleted: false, grantActive: true };
    expect(canAccessFipaDocument(publicDocument, state)).toBe(false);
    expect(canAccessFipaDocument(memberDocument, state)).toBe(false);
  });

  it('habilita dos documentos con ficha y mantiene los otros siete sujetos a membresía', () => {
    expect(canAccessFipaDocument(publicDocument, { interestCompleted: true, grantActive: false })).toBe(true);
    expect(canAccessFipaDocument(memberDocument, { interestCompleted: true, grantActive: false })).toBe(false);
    expect(canAccessFipaDocument(memberDocument, { interestCompleted: true, grantActive: true })).toBe(true);
  });

  it('reutiliza la sede de la ficha para la solicitud de miembro', () => {
    const profile = {
      linked_to_club: 'yes',
      venue_not_listed: true,
      club_name: 'Cancha Norte',
      country: 'Argentina',
      city: 'Córdoba',
      address: 'Calle 10',
    };
    expect(profileHasVenue(profile)).toBe(true);
    expect(memberRequestBodyFromProfile(profile)).toEqual({
      sede_id: null,
      cancha_no_encontrada: true,
      nombre_cancha: 'Cancha Norte',
      pais: 'Argentina',
      ciudad: 'Córdoba',
      direccion_ubicacion: 'Calle 10',
    });
  });

  it('no permite pedir membresía sin vínculo de sede y permite actualizar la ficha', () => {
    const profile = {
      purpose: 'aprender_jugar',
      plays_padbol: 'prefer_not',
      linked_to_club: 'no',
    };
    expect(profileHasVenue(profile)).toBe(false);
    expect(formFromProfile(profile)).toEqual(expect.objectContaining({
      purpose: 'aprender_jugar',
      playsPadbol: 'prefer_not',
      clubLink: 'no',
      purposeAcknowledged: true,
    }));
  });

  it('presenta los nueve documentos bloqueados antes de completar la ficha', async () => {
    fetchFipaLibraryState.mockResolvedValue(normalizeFipaLibraryState({}));
    render(<MemoryRouter initialEntries={['/fipa/documentos']}><FipaDocuments /></MemoryRouter>);

    await waitFor(() => expect(fetchFipaDocuments).toHaveBeenCalled());
    expect(screen.getByText('¿Para qué quieres consultar la Biblioteca?')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Acceso restringido' })).toHaveLength(9);
  });

  it('muestra dos descargas con ficha y siete bloqueos sin membresía', async () => {
    fetchFipaLibraryState.mockResolvedValue(normalizeFipaLibraryState({
      authenticated_access: true,
      member_access: false,
      profile: { completed_at: '2026-09-08T10:00:00Z', linked_to_club: 'no' },
    }));
    render(<MemoryRouter initialEntries={['/fipa/documentos']}><FipaDocuments /></MemoryRouter>);

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Descargar PDF' })).toHaveLength(2));
    expect(screen.getAllByRole('button', { name: 'Acceso restringido' })).toHaveLength(7);
  });
});
