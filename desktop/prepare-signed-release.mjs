import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const version=String(process.argv[2]||'').trim();
if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Versão semântica obrigatória (x.y.z).');
const base=resolve(import.meta.dirname),packageFile=join(base,'package.json');
const pkg=JSON.parse(readFileSync(packageFile,'utf8'));
pkg.version=version;
pkg.build.publish=[{provider:'github',owner:'ProjectW1SC',repo:'INFINITUM'}];
pkg.build.win.verifyUpdateCodeSignature=true;
pkg.build.forceCodeSigning=true; // Fail release builds that cannot Authenticode-sign.
// This script is only called by the signed release workflow after it verifies
// that a Windows certificate is available from repository secrets.
writeFileSync(packageFile,JSON.stringify(pkg,null,2)+'\n');
writeFileSync(join(base,'signed-updates.json'),JSON.stringify({
 enabled:true,version,source:'signed-github-release'
},null,2)+'\n');
console.log('Release signed updater prepared for '+version+' (no certificate bytes in package).');
