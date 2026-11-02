import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import UnirsePage from './UnirsePage';
import PublicSiteFooter from './publicSite/PublicSiteFooter';
import {LEGAL_CONTACT_HREF} from '../constants/legalIdentity';
import i18n from '../i18n';
jest.mock('../components/AppHeader',()=>({onBack})=><button type="button" onClick={onBack}>Back</button>);
jest.mock('../components/LanguageSwitcher',()=>()=>null);
jest.mock('../context/HubNavLayoutContext',()=>({useHubNavLayout:()=>({navDock:'top'})}));
function Location(){const loc=useLocation();return <output data-testid="location">{loc.pathname+loc.search}</output>;}
beforeEach(()=>{window.scrollTo=jest.fn();global.fetch=jest.fn(()=>{throw Error('No network or submission allowed');});});
afterEach(()=>jest.restoreAllMocks());
for(const [language,url,name] of [['es','https://padbol.com/contacto','Formulario de contacto (se abre en una pestaña nueva)'],['en','https://padbol.com/en/contacto','Contact form (opens in a new tab)'],['sv','https://padbol.com/en/contacto','Contact form (opens in a new tab)']]){
 test(`commercial residual uses supported form language ${language}, keeps draft and current tab`,async()=>{
  await i18n.changeLanguage(language);const {container}=render(<MemoryRouter initialEntries={['/planes','/unirse?plan=starter']} initialIndex={1}><UnirsePage/><Location/></MemoryRouter>);
  expect(container.querySelector('a[href^="mailto:info@padbol.com"]')).toBeNull();
  const link=container.querySelector(`a[href="${url}"]`);expect(link).toBeTruthy();expect(link).toHaveAttribute('aria-label',name);expect(link).toHaveAttribute('target','_blank');expect(link.rel.split(' ')).toEqual(expect.arrayContaining(['noopener','noreferrer']));
  // It was inherited hidden markup; do not accidentally expose a new product CTA.
  expect(link.closest('section[aria-hidden="true"]')).toHaveStyle({display:'none'});
  expect(screen.queryByRole('link',{name})).toBeNull();
  const input=container.querySelector('#join-club_nombre');fireEvent.change(input,{target:{value:'Local unsent draft'}});
  link.addEventListener('click',e=>e.preventDefault(),{once:true});fireEvent.click(link);
  expect(input).toHaveValue('Local unsent draft');expect(screen.getByTestId('location')).toHaveTextContent('/unirse?plan=starter');expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Back'}));expect(screen.getByTestId('location')).toHaveTextContent('/planes');
 });
}
test('published Match footer keeps contact routing and legal mail identity intact',async()=>{
 await i18n.changeLanguage('en');const {container}=render(<MemoryRouter><PublicSiteFooter/></MemoryRouter>);
 expect(container.querySelector('footer a[href="/contacto"]')).toBeTruthy();expect(container.querySelector('footer a[href^="mailto:info@"]')).toBeNull();expect(LEGAL_CONTACT_HREF).toBe('mailto:padbolmatch@padbol.com');expect(fetch).not.toHaveBeenCalled();
});
