import i18n from './index';
test('Elite stays a distinct stored category with direct supported-language display labels',()=>{
 const labels={es:'Élite',en:'Elite',pt:'Elite',ro:'Elită',cs:'Elitní',de:'Eliteklasse',ar:'النخبة','fa-IR':'نخبگان','nl-BE':'Eliteklasse',fr:'Élite',it:'Élite','nl-NL':'Eliteklasse',sv:'Elit','pt-BR':'Elite','pt-PT':'Elite',el:'Ελίτ',hu:'Elit',he:'עילית',pl:'Elita',uk:'Еліта',af:'Eliteklas'};
 for(const [lng,label]of Object.entries(labels))expect(i18n.getFixedT(lng)('torneos.vista.categoriaNivel.Elite')).toBe(label);
});
