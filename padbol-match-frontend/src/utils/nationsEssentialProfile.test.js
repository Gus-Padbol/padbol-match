import {isNationsEssentialPurpose,NATIONS_RETURN_PATH,nationsRequestId,nationsRequestKey,nationsProfileDraft,storeNationsSelection,storedNationsSelection} from './nationsEssentialProfile';
beforeEach(()=>sessionStorage.clear());
test('only the exact event return purpose selects the minimal profile; general and other event purposes remain general',()=>{
 expect(isNationsEssentialPurpose(new URLSearchParams({purpose:'nations',redirect:NATIONS_RETURN_PATH}))).toBe(true);
 expect(isNationsEssentialPurpose(new URLSearchParams({redirect:NATIONS_RETURN_PATH}))).toBe(true);
 for(const params of [{},{redirect:'/home'},{purpose:'nations',redirect:'/nations-cup/other/inscripcion'},{purpose:'other',redirect:NATIONS_RETURN_PATH},{redirect:`${NATIONS_RETURN_PATH}/other`}])expect(isNationsEssentialPurpose(new URLSearchParams(params))).toBe(false);
});
test('a rejected ID is replaced once, then reused on retry; names retain their original case and diacritics',()=>{
 sessionStorage.setItem(nationsRequestKey('actor'),'rejected');const fresh=nationsRequestId('actor',{rejectedRequestId:'rejected'});expect(fresh).not.toBe('rejected');expect(nationsRequestId('actor',{rejectedRequestId:'rejected'})).toBe(fresh);
 expect(nationsProfileDraft({}, {name:'de la Cruz María',country:'MX'})).toEqual({nombre:'de',apellido:'la Cruz María',pais:'MX',genero:'',telefono:''});
});

test('blocked browser storage keeps a stable per-actor attempt and public selection intent in memory',()=>{
 const storage={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');},removeItem:()=>{throw Error('blocked');}};
 const first=nationsRequestId('blocked-a',{storage});expect(nationsRequestId('blocked-a',{storage})).toBe(first);expect(nationsRequestId('blocked-b',{storage})).not.toBe(first);
 storeNationsSelection({selectionId:'public-intent',name:'Public name',country:'IT'},storage);expect(storedNationsSelection(storage)).toBe('public-intent');storeNationsSelection(null,storage);expect(storedNationsSelection(storage)).toBeNull();
});

test('fresh signup placeholder is replaced by declared selection prefill while a complete own name is reused',()=>{
 expect(nationsProfileDraft({nombre:'Jugador',apellido:null},{name:'Gustavo Miguens',country:'AR'})).toMatchObject({nombre:'Gustavo',apellido:'Miguens'});
 expect(nationsProfileDraft({nombre:'Own',apellido:'Existing'},{name:'Public Selected',country:'IT'})).toMatchObject({nombre:'Own',apellido:'Existing'});
});

 test('complete draft preserves existing compound given names matching canonical selection',()=>{const {nationsCompleteDraft}=require('./nationsEssentialProfile');expect(nationsCompleteDraft({nombre:'Juan Pablo',apellido:'García'},{name:'JUAN PABLO GARCIA',country:'AR'})).toMatchObject({nombre:'Juan Pablo',apellido:'García',pais:'AR'});});
test('complete draft reuses an already saved private contact without inventing private fields',()=>{const {nationsCompleteDraft}=require('./nationsEssentialProfile');expect(nationsCompleteDraft({},null,{telefono:'+39123456789'})).toMatchObject({telefono:'+39123456789',fecha_nacimiento:'',tipo_documento:'',nacionalidad:'',numero_documento:''});});

test('complete ficha uses the same bounded phone/document contract as identity service',()=>{
 const {nationsCompleteError}=require('./nationsEssentialProfile');
 const form={nombre:'Juan',apellido:'García',pais:'AR',genero:'masculino',ciudad:'City',nivel:'Elite',lateralidad:'Diestro',posicion_cancha:'derecha',fecha_nacimiento:'1980-01-01',tipo_documento:'pasaporte',pais_documento:'AR',nacionalidad:'AR',categoria_deportiva:'Elite',telefono:'+54 (11) 1234-5678',numero_documento:'ab.12-34/56'};
 expect(nationsCompleteError(form)).toBe('');expect(nationsCompleteError({...form,telefono:'+54.1112345678'})).toMatch(/contact number/);expect(nationsCompleteError({...form,telefono:'1'.repeat(33)})).toMatch(/contact number/);expect(nationsCompleteError({...form,numero_documento:'A'.repeat(33)})).toMatch(/document number/);expect(nationsCompleteError({...form,numero_documento:'AB@123'})).toMatch(/document number/);
});
