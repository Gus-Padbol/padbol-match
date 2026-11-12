import {parseIdentidadFromApi, identidadToForm, buildIdentidadPutPayload} from './jugadorIdentidad';

// Exact public own-identity DTO names from BE buildIdentidadPropiaResponse.
const actualDto = {
  identidad_estado: 'pendiente_revision', fecha_nacimiento: '2000-01-01',
  tipo_documento: 'otro', pais_documento: 'AR', nacionalidad: 'AR',
  numero_documento_masked: '********1234', numero_documento_last4: '1234',
  genero: 'otro', categoria_deportiva: 'Elite', telefono: '+540000000000',
  completitud: {documento_completo: true, identidad_minima_completa: true},
};

test.each(['pendiente_revision', 'verificada', 'rechazada'])('actual BE identity DTO retains %s and the saved mask', estado => {
  const parsed = parseIdentidadFromApi({...actualDto, identidad_estado: estado});
  expect(parsed.estado).toBe(estado);
  expect(parsed.numero_documento_mascarado).toBe('********1234');
  expect(parsed.tiene_documento).toBe(true);
  expect(parsed.categoria_deportiva).toBe('Elite');
});

test('legacy aliases and nested identity response remain compatible', () => {
  expect(parseIdentidadFromApi({identidad:{estado:'pendiente',numero_documento_mascarado:'****1234'}})).toMatchObject({estado:'pendiente_revision',tiene_documento:true,numero_documento_mascarado:'****1234'});
  expect(parseIdentidadFromApi({estado_verificacion:'aprobada',documento_mascarado:'****5678'})).toMatchObject({estado:'verificada',tiene_documento:true,numero_documento_mascarado:'****5678'});
});

test('raw document, hash, ciphertext and technical completeness never populate form or parsed data', () => {
  const parsed = parseIdentidadFromApi({...actualDto, numero_documento:'PRIVATE-DOCUMENT',numero_documento_hash:'PRIVATE-HASH',numero_documento_cifrado:'PRIVATE-CIPHER'});
  const form = identidadToForm(parsed);
  expect(form.numero_documento).toBe('');
  expect(JSON.stringify({parsed,form})).not.toMatch(/PRIVATE-|numero_documento_last4|completitud/);
  expect(parseIdentidadFromApi({completitud:{documento_completo:true},numero_documento:'PRIVATE-DOCUMENT'})).toMatchObject({estado:'incompleta',tiene_documento:false,numero_documento_mascarado:''});
});

test('saving unchanged identity omits the stored document; replacing requires the explicit new value', () => {
  const parsed = parseIdentidadFromApi(actualDto), form = identidadToForm(parsed);
  const options = {hasExistingDocument:parsed.tiene_documento,replaceDocument:false};
  expect(buildIdentidadPutPayload(form,options)).not.toHaveProperty('numero_documento');
  expect(buildIdentidadPutPayload({...form,numero_documento:'NEW-FIXTURE-1234'},{...options,replaceDocument:true}).numero_documento).toBe('NEW-FIXTURE-1234');
});
