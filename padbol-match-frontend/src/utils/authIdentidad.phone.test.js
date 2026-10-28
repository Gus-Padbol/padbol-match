jest.mock('../supabaseClient',()=>({supabase:{}}));
import {buildFullWhatsDigits,formatWhatsAppE164,splitStoredWhatsapp,whatsappNacionalValido} from './authIdentidad';

test.each(['636415160','+34 636 415 160','0034 636415160','34636415160'])('Spanish input %s has exactly one country code', input=>{
 expect(whatsappNacionalValido(input,'+34')).toBe(true);
 expect(buildFullWhatsDigits('+34',input)).toBe('34636415160');
 expect(formatWhatsAppE164('+34',input)).toBe('+34636415160');
});
test('Spain accepts nine national digits without requiring 0034',()=>{
 expect(whatsappNacionalValido('636415160','+34')).toBe(true);
 expect(whatsappNacionalValido('63641516','+34')).toBe(false);
 expect(whatsappNacionalValido('6364151600','+34')).toBe(false);
});
test.each([
 ['+54','2213032019','+542213032019'],['+54','9 11 2345 6789','+5491123456789'],
 ['+1','2025550123','+12025550123'],['+33','06 12 34 56 78','+33612345678'],['+44','7700900123','+447700900123']
])('national input for %s respects the numbering plan',(code,local,expected)=>expect(formatWhatsAppE164(code,local)).toBe(expected));
test('an explicit number from another country is rejected instead of silently rewritten',()=>expect(formatWhatsAppE164('+34','+44 7700900123')).toBe(''));
test.each(['+34 636415160','0034636415160','+340034636415160'])('historical input %s displays the Spanish national number',value=>expect(splitStoredWhatsapp(value)).toEqual({codigo:'+34',local:'636415160'}));
