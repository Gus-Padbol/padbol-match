import {validateIdentidadForm} from './jugadorIdentidad';

const form = {
  fecha_nacimiento: '1990-01-01', tipo_documento: 'dni', pais_documento: 'AR',
  nacionalidad: 'AR', genero: 'masculino', categoria_deportiva: '',
  telefono: '1123456789', contacto_emergencia_nombre: '', contacto_emergencia_telefono: '', contacto_emergencia_relacion: '',
};
const opts = {hasExistingDocument: true, perfil: {nombre: 'Ana', apellido: 'Paz', genero: 'masculino', whatsapp: '1123456789'}, whatsappFallback: '1123456789'};

test('categoría no es obligatoria global en la ficha existente', () => {
  expect(validateIdentidadForm(form, opts).some((e) => /categoría deportiva/.test(e))).toBe(false);
});
test('categoría es obligatoria sólo cuando el contexto Napoli lo pide', () => {
  expect(validateIdentidadForm(form, {...opts, requireCategoria: true}).some((e) => /categoría deportiva/.test(e))).toBe(true);
});
