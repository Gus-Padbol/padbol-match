const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', 'build');
const media = path.join(root, 'static/media');
if (fs.existsSync(media) && fs.readdirSync(media).some(name => /^nationsPostmatchPure\..*\.cjs$/.test(name))) throw new Error('Nations API helper was emitted as a downloadable asset');
const js = path.join(root, 'static/js');
const bundled = fs.readdirSync(js).filter(name => name.endsWith('.js')).map(name => fs.readFileSync(path.join(js, name), 'utf8')).join('\n');
for (const marker of ['/api/nations/partidos/', 'NATIONS_POSTMATCH_NOT_QUEUED']) if (!bundled.includes(marker)) throw new Error('Nations runtime missing from JavaScript bundle: ' + marker);
console.log('Nations postmatch runtime verified in executable JavaScript bundle.');
