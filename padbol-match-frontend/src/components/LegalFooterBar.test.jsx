import { render, screen } from '@testing-library/react';
import LegalFooterBar from './LegalFooterBar';
jest.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/admin' }), Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a> }));
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
jest.mock('../context/HubNavLayoutContext', () => ({ useHubNavLayout: () => ({ navDock: 'bottom' }) }));
jest.mock('../i18n/tSafe', () => ({ useSafeTranslation: () => ({ t: key => key === 'publicSite.footer.legalOwner' ? 'Operado por ENTERTAINMENT SPORT SERVICE LLC.' : key }) }));
test('el pie conserva una sola puntuación tras el nombre legal', () => {
 const { container } = render(<LegalFooterBar />);
 expect(screen.getByText('Operado por ENTERTAINMENT SPORT SERVICE LLC.')).toBeInTheDocument();
 expect(container.textContent).not.toContain('LLC..');
 expect(container.querySelector('p').textContent.trim()).toMatch(/LLC\.$/);
});

test('dark footer legal links remain readable and large enough to touch', () => {
 const {container}=render(<LegalFooterBar/>);
 const link=container.querySelector('nav a');
 const rgb=link.style.color.match(/\d+/g).map(Number);
 const luminance=values=>values.map(c=>{const s=c/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
 expect((luminance(rgb)+.05)/(luminance([15,23,42])+.05)).toBeGreaterThanOrEqual(4.5);
 expect(parseInt(link.style.minHeight,10)).toBeGreaterThanOrEqual(44);
});
