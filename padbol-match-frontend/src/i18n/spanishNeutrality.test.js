import fs from 'fs';
import path from 'path';
import i18n from './index';
import { commercialFlowCopy } from '../pages/commercialFlowCopy';
import { venuePlansCopy } from '../pages/adminLanding/venuePlansCopy';

const FORBIDDEN_VOSEO = [
  'vos', 'sos', 'tenés', 'podés', 'querés', 'sabés', 'hacés', 'decís', 'venís',
  'elegís', 'seguís', 'vivís', 'residís', 'usás', 'necesitás', 'construís',
  'traés', 'llevás', 'aceptás', 'activás', 'aparecés', 'aprobás', 'bajás',
  'cancelás', 'cerrás', 'comprás', 'conservás', 'debés', 'decidís', 'definís',
  'desactivás', 'empezás',
  'escribís', 'figurás', 'jugás', 'preferís', 'publicás', 'quitás', 'rechazás',
  'invitás', 'mostrás', 'pagás', 'recibís', 'registrás', 'reservás', 'revisás',
  'seleccionás', 'solicitás', 'subís', 'tocás',
  'contanos', 'escribinos', 'inscribite', 'seguinos', 'sumate', 'conectalos',
  'renovalo', 'renovala', 'guardalo', 'guardala', 'compartilo', 'compartila',
  'preguntale', 'decile', 'anotate', 'conectate', 'contame', 'decime',
  'enterate', 'escribime', 'fijate', 'mostralo', 'preparate', 'probalo',
  'quedate', 'registrate', 'seguime', 'unite',
  'tomá', 'respondé', 'dejá', 'abrí', 'aceptá', 'accedé', 'activá', 'actualizá',
  'agregá', 'administrá', 'anotá', 'aparecé', 'aprobá', 'aprovechá', 'armá',
  'asigná', 'ayudá', 'bloqueá', 'buscá', 'cambiá', 'cancelá', 'cargá',
  'cerrá', 'comprá', 'compartí', 'completá', 'comunicá', 'configurá',
  'confirmá', 'conectá', 'conocé', 'consultá', 'contactá', 'continuá',
  'controlá', 'convertí', 'copiá', 'cotizá', 'creá', 'construí', 'decidí',
  'definí', 'desactivá', 'descargá', 'deslizá',
  'descubrí', 'disfrutá', 'editá', 'elegí', 'eliminá', 'empezá', 'encontrá',
  'entrá', 'enviá', 'escaneá', 'escribí', 'estimá', 'explicá', 'explorá',
  'fidelizá', 'filtrá', 'generá', 'gestioná', 'guardá', 'hablá', 'hacé',
  'ignorá', 'imprimí', 'indicá', 'ingresá', 'iniciá', 'instalá', 'intentá',
  'invitá', 'jugá', 'llevá', 'marcá', 'mirá', 'mostrá', 'mové', 'operá',
  'ordená', 'organizá',
  'pagá', 'participá', 'pasá', 'pausá', 'personalizá', 'preguntá', 'prepará',
  'probá', 'publicá', 'quitá', 'recargá', 'recibí', 'rechazá', 'reconocé',
  'reducí', 'registrá', 'reintentá', 'renová', 'reservá', 'restaurá', 'revisá',
  'seguí', 'seleccioná', 'solicitá', 'subí', 'sumá', 'supervisá', 'tocá',
  'traé', 'usá', 'validá', 'verificá', 'vinculá', 'visitá', 'volvé',
];

const escapedWords = FORBIDDEN_VOSEO
  .sort((a, b) => b.length - a.length)
  .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const VOSEO_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}_])(?:${escapedWords.join('|')})(?![\\p{L}\\p{N}_])`,
  'iu',
);

const flattenStrings = (value, prefix = 'root', result = []) => {
  if (typeof value === 'string') result.push([prefix, value]);
  else if (Array.isArray(value)) value.forEach((item, index) => flattenStrings(item, `${prefix}[${index}]`, result));
  else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => flattenStrings(item, `${prefix}.${key}`, result));
  }
  return result;
};

const walkRuntimeFiles = (directory, result = []) => {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walkRuntimeFiles(fullPath, result);
    else if (/\.(?:js|jsx|json)$/.test(entry.name) && !/\.test\.(?:js|jsx)$/.test(entry.name)) result.push(fullPath);
  });
  return result;
};

const sourceRoot = path.join(__dirname, '..');
const PARALLEL_WORK_EXCLUSIONS = new Set([]);
const MIXED_LOCALE_COPY_FILES = new Set([
  path.join(sourceRoot, 'pages', 'commercialFlowCopy.js'),
  path.join(sourceRoot, 'pages', 'adminLanding', 'venuePlansCopy.js'),
]);

const sourceFiles = [
  path.join(sourceRoot, 'App.js'),
  ...['components', 'pages', 'constants', 'content', 'config']
    .flatMap((directory) => walkRuntimeFiles(path.join(sourceRoot, directory))),
].filter((file) => !PARALLEL_WORK_EXCLUSIONS.has(file) && !MIXED_LOCALE_COPY_FILES.has(file));

const withoutStandaloneComments = (source) => source
  .split('\n')
  .filter((line) => !/^\s*(?:\/\/|\/\*|\*|\*\/)/.test(line))
  .join('\n');

describe('neutral Latin American Spanish', () => {
  it('does not expose voseo through the resolved Spanish catalogs', () => {
    const catalogs = {
      i18n: i18n.getResourceBundle('es', 'translation'),
      commercialFlow: commercialFlowCopy('es'),
      venuePlans: venuePlansCopy('es'),
    };
    const failures = flattenStrings(catalogs)
      .filter(([, value]) => VOSEO_PATTERN.test(value))
      .map(([key, value]) => `${key}: ${value}`);

    expect(failures).toEqual([]);
  });

  it('does not hardcode voseo in visible runtime copy', () => {
    const failures = sourceFiles.flatMap((file) => {
      const source = withoutStandaloneComments(fs.readFileSync(file, 'utf8'));
      const match = source.match(VOSEO_PATTERN);
      return match ? [`${path.relative(sourceRoot, file)}: ${match[0]}`] : [];
    });

    expect(failures).toEqual([]);
  });
});
