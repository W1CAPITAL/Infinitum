import {deflateSync} from 'node:zlib';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

// Deterministic original infinity mark, no copied cryptocurrency imagery.
// Generates a Windows ICO containing a 256x256 lossless PNG using Node alone.
const S=256;
function crc32(buf){
 let crc=0xffffffff;
 for(const byte of buf){
  crc^=byte;
  for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
 }
 return (crc^0xffffffff)>>>0;
}
function pngChunk(name,data){
 const type=Buffer.from(name,'ascii');
 const len=Buffer.alloc(4);len.writeUInt32BE(data.length);
 const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));
 return Buffer.concat([len,type,data,crc]);
}
function pixel(x,y){
 const px=(x-S/2)/(S/2),py=(y-S/2)/(S/2);
 const q=Math.max(Math.abs(px),Math.abs(py));
 const edge=Math.max(0,1-Math.max(0,q-.77)*12);
 if(edge<=0)return [0,0,0,0];
 const r=Math.hypot(px,py);
 const bg=[34+Math.round(38*(1-r)),7+Math.round(10*(1-r)),26+Math.round(24*(1-r)),255];
 // Lemniscate of Bernoulli: continuous double loop rather than a polygonal Ethereum mark.
 const xx=px*1.10,yy=py*1.26,r2=xx*xx+yy*yy;
 const f=r2*r2-0.86*(xx*xx-yy*yy);
 const gx=4*xx*r2-1.72*xx,gy=4*yy*r2+1.72*yy;
 const distance=Math.abs(f)/Math.max(.18,Math.hypot(gx,gy));
 const mark=Math.max(0,Math.min(1,(.095-distance)*27));
 const glow=Math.max(0,Math.min(1,(.18-distance)*6));
 return [
  Math.round((bg[0]+glow*54)*(1-mark)+mark*242),
  Math.round((bg[1]+glow*22)*(1-mark)+mark*235),
  Math.round((bg[2]+glow*42)*(1-mark)+mark*244),
  Math.round(255*edge)
 ];
}
export function createInfinitumIco(){
 const raw=Buffer.alloc(S*(S*4+1));
 for(let y=0;y<S;y++){
  const base=y*(S*4+1);
  raw[base]=0;
  for(let x=0;x<S;x++){
   const a=pixel(x,y);
   for(let k=0;k<4;k++)raw[base+1+x*4+k]=a[k];
  }
 }
 const ihdr=Buffer.alloc(13);
 ihdr.writeUInt32BE(S,0);ihdr.writeUInt32BE(S,4);
 ihdr[8]=8;ihdr[9]=6;
 const png=Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]),
  pngChunk('IHDR',ihdr),
  pngChunk('IDAT',deflateSync(raw,{level:9})),
  pngChunk('IEND',Buffer.alloc(0))
 ]);
 const directory=Buffer.alloc(22);
 directory.writeUInt16LE(0,0);
 directory.writeUInt16LE(1,2);
 directory.writeUInt16LE(1,4);
 directory[6]=0;directory[7]=0;
 directory[8]=0;directory[9]=0;
 directory.writeUInt16LE(1,10);
 directory.writeUInt16LE(32,12);
 directory.writeUInt32LE(png.length,14);
 directory.writeUInt32LE(22,18);
 return Buffer.concat([directory,png]);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const out=join(import.meta.dirname,'branding','infinitum-app.ico');
 mkdirSync(join(import.meta.dirname,'branding'),{recursive:true});
 writeFileSync(out,createInfinitumIco());
 console.log('INFINITUM original infinity Windows icon generated.');
}
