import { resolveOAuthPostLoginPath } from './AuthOAuthCallback';
import { resolvePostLoginNavigatePath } from '../utils/reservaReturnUrl';

describe('retorno OAuth', () => {
  it('no obliga a completar el perfil deportivo antes de la Biblioteca FIPA', () => {
    const destination = '/fipa/documentos?document=reglamento-oficial';
    expect(resolveOAuthPostLoginPath(destination, true)).toBe(destination);
  });

  it('conserva el documento FIPA tras resolver un retorno OAuth con actividad deportiva guardada', () => {
    const destination = '/fipa/documentos?document=reglamento-oficial';
    sessionStorage.setItem('padbol_partidos_buscar_return', '/jugar/buscar');
    try {
      const resolved = resolvePostLoginNavigatePath(`?redirect=${encodeURIComponent(destination)}`);
      expect(resolveOAuthPostLoginPath(resolved, true)).toBe(destination);
      expect(sessionStorage.getItem('padbol_partidos_buscar_return')).toBe('/jugar/buscar');
    } finally {
      sessionStorage.removeItem('padbol_partidos_buscar_return');
    }
  });

  it('mantiene el gate de perfil para los demás destinos', () => {
    expect(resolveOAuthPostLoginPath('/hub', true)).toBe(
      '/completar-perfil?redirect=%2Fhub',
    );
  });
});

test('exact Napoli return reaches its essential player form flow without the generic sports form; other events keep normal onboarding',()=>{
 const event='/nations-cup/nations-cup-napoli-2026/inscripcion';expect(resolveOAuthPostLoginPath(event,true)).toBe(event);
 expect(resolveOAuthPostLoginPath('/nations-cup/other/inscripcion',true)).toBe('/completar-perfil?redirect=%2Fnations-cup%2Fother%2Finscripcion');
});
