import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'apiPublicBaseUrl.js'), 'utf8');

test('API environment uses build-time REACT_APP reads, not a browser process guard', () => {
  for (const key of ['REACT_APP_APP_VARIANT','REACT_APP_API_BASE_URL','REACT_APP_API_URL','REACT_APP_SUPABASE_URL','REACT_APP_SUPABASE_ANON_KEY']) {
    expect(source).toContain(`process.env.${key}`);
  }
  expect(source).not.toContain("typeof process === 'undefined'");
  expect(source).not.toContain('? {} : process.env');
});
