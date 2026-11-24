// Dois temas oficiais do Infinitum. Light é o padrão; Dark mantém a mesma estrutura com superfícies noturnas.
const theme = values => Object.freeze(values);
export const CRM_THEMES=Object.freeze([
 theme({
  id:'infinitum',mode:'light',label:'Infinitum Light',description:'Fundo prata quente, superfícies brancas e navegação grafite com vinho.',
  page:'#f0eeeb',surface:'#ffffff',ink:'#222127',muted:'#625c65',
  accent:'#792840',accentInk:'#ffffff',nav:'#211b23',navInk:'#f4edf3',
  border:'#ded9df',tint:'#f5e8ed',tintInk:'#792840',
  warningBg:'#fff3e8',warningInk:'#835322',successBg:'#eaf4ed',successInk:'#24613e',
  dangerBg:'#fae9eb',dangerInk:'#9b3544',neutralBg:'#edf0f4',neutralInk:'#46505e'
 }),
 theme({
  id:'infinitum-dark',mode:'dark',label:'Infinitum Dark',description:'Grafite sólido, superfícies escuras e detalhes vinho.',
  page:'#17171c',surface:'#23232b',ink:'#f5f0f4',muted:'#c2bac4',
  accent:'#f0acc4',accentInk:'#27151e',nav:'#17141b',navInk:'#f5edf4',
  border:'#42404a',tint:'#402b3a',tintInk:'#f0acc4',
  warningBg:'#49331f',warningInk:'#f3c58b',successBg:'#1e3c30',successInk:'#9bd8b0',
  dangerBg:'#4a252e',dangerInk:'#ffb2ba',neutralBg:'#303844',neutralInk:'#dbe1ea'
 })
]);
export function resolveTheme(value){
 const selected=String(value||'').trim().toLowerCase();
 if(['blackhole','dark','infinitum-dark'].includes(selected))return 'infinitum-dark';
 if(['light','infinitum-light','prestige'].includes(selected))return 'infinitum';
 return CRM_THEMES.some(t=>t.id===selected)?selected:'infinitum';
}
export function contrastRatio(foreground,background){
 function luminance(hex){
  const m=/^#([a-f\d]{6})$/i.exec(hex);
  if(!m)throw new Error('Cor hexadecimal inválida: '+hex);
  const rgb=[0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16)/255)
   .map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
  return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
 }
 const a=luminance(foreground),b=luminance(background);
 return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}
