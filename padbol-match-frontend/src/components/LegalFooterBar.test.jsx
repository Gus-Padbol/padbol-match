import { render, screen } from '@testing-library/react';
import LegalFooterBar from './LegalFooterBar';
jest.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/admin' }), Link: ({ children, to }) => <a href={to}>{children}</a> }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('../context/HubNavLayoutContext', () => ({ useHubNavLayout: () => ({ navDock: 'bottom' }) }));
jest.mock('../i18n/tSafe', () => ({ useSafeTranslation: () => ({ t: key => key === 'publicSite.footer.legalOwner' ? 'Operado por ENTERTAINMENT SPORT SERVICE LLC.' : key }) }));
test('el pie conserva una sola puntuación tras el nombre legal', () => {
 const { container } = render(<LegalFooterBar />);
 expect(screen.getByText('Operado por ENTERTAINMENT SPORT SERVICE LLC.')).toBeInTheDocument();
 expect(container.textContent).not.toContain('LLC..');
 expect(container.querySelector('p').textContent.trim()).toMatch(/LLC\.$/);
});
