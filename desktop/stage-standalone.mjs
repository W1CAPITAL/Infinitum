import {cpSync,existsSync,mkdirSync,rmSync,readdirSync} from 'node:fs';
import {resolve,join,basename} from 'node:path';
const repo=resolve(import.meta.dirname,'..');
const standalone=join(repo,'.next','standalone');
const target=join(repo,'desktop','app-server');
if(!existsSync(join(standalone,'server.js')))throw Error('Execute KILLA_DESKTOP_STANDALONE=1 npm run build antes de empacotar.');
rmSync(target,{recursive:true,force:true});
mkdirSync(target,{recursive:true});
const privateFile=path=>/(^|[/\\])\.env(?:\.|$)|service[_-]?role|private[_-]?key|\.pem$/i.test(path);
cpSync(standalone,target,{recursive:true,filter:source=>!privateFile(source)});
const pub=join(repo,'public'),stat=join(repo,'.next','static');
if(existsSync(pub))cpSync(pub,join(target,'public'),{recursive:true});
if(existsSync(stat)){
 mkdirSync(join(target,'.next'),{recursive:true});
 cpSync(stat,join(target,'.next','static'),{recursive:true});
}
if(!existsSync(join(target,'server.js')))throw Error('Empacotamento não contém server.js.');
const nextPackage=join(target,'node_modules','next','package.json');
const nextServer=join(target,'node_modules','next','dist','server','lib','start-server.js');
if(!existsSync(nextPackage)||!existsSync(nextServer))
 throw Error('Standalone incompleto: dependências Next.js não foram incluídas no staging.');
// Defense in depth: do not ever bundle local private configuration.
for(const file of readdirSync(target)){
 if(privateFile(file))throw Error('Arquivo privado identificado no pacote: '+basename(file));
}
console.log('Standalone Next preparado para instalar localmente, sem Vercel.');
