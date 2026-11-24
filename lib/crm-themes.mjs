// Dois temas oficiais do Infinitum. Light é o padrão; Dark mantém a mesma estrutura com superfícies noturnas.
const theme = values => Object.freeze(values);
export const CRM_THEMES=Object.freeze([
 theme({
  id:'infinitum',mode:'light',label:'Infinitum Light',description:'Fundo cinza frio, superfícies brancas e navegação grafite.',
  page:'#f5f7fa',surface:'#ffffff',ink:'#20242d',muted:'#56606e',
  accent:'#6f2232',accentInk:'#ffffff',nav:'#161b22',navInk:'#f3f4f6',
  border:'#e5e7eb',tint:'#f1e8eb',tintInk:'#6f2232',
  warningBg:'#fff3e8',warningInk:'#835322',successBg:'#eaf4ed',successInk:'#24613e',
  dangerBg:'#fae9eb',dangerInk:'#9b3544',neutralBg:'#edf0f4',neutralInk:'#46505e'
 }),
 theme({
  id:'infinitum-dark',mode:'dark',label:'Infinitum Dark',description:'Grafite sólido, superfícies escuras e detalhes vinho.',
  page:'#111418',surface:'#1c222b',ink:'#f3f4f6',muted:'#bac2ce',
  accent:'#e9a8b8',accentInk:'#2c151c',nav:'#161b22',navInk:'#f3f4f6',
  border:'#353d48',tint:'#382831',tintInk:'#f0c5d0',
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
