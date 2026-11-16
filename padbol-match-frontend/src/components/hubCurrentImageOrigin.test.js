import {PRACTICE_IMAGE_ORIGIN} from './AdminHubPersonalizarSection';
test('allows exact custom public hub-images host and rejects other/redirect-like URLs',()=>{
 const ok='https://auth.padbolmatch.com/storage/v1/object/public/hub-images/deporte/padbol/torneos/a.jpg';
 expect(PRACTICE_IMAGE_ORIGIN(ok)?.hostname).toBe('auth.padbolmatch.com');
 expect(PRACTICE_IMAGE_ORIGIN(ok.replace('auth.padbolmatch.com','evil.padbolmatch.com'))).toBeNull();
 expect(PRACTICE_IMAGE_ORIGIN('https://auth.padbolmatch.com/storage/v1/object/private/hub-images/a.jpg')).toBeNull();
 expect(PRACTICE_IMAGE_ORIGIN('https://www.padbolmatch.com/brand/next-generation-youth.png')?.pathname).toBe('/brand/next-generation-youth.png');
});
