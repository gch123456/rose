// Original synthesized PCM assets. No samples from another game.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'assets/resources/color-clear-audio');fs.mkdirSync(dir,{recursive:true});
for(const [name,freqs,duration] of [['load',[520],.065],['hit',[740],.045],['chain',[880,1100],.16],['won',[660,830,990],.32],['lost',[240,180],.24]]){
 const rate=22050,n=Math.floor(rate*duration),out=Buffer.alloc(44+n*2);
 out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(n*2,40);
 for(let i=0;i<n;i++){const t=i/rate,env=Math.min(1,t/.004)*Math.pow(1-i/n,2);const value=freqs.reduce((a,f)=>a+Math.sin(2*Math.PI*f*(t-.15*t*t)),0)/freqs.length;out.writeInt16LE(Math.round(value*env*.32*32767),44+i*2);}
 fs.writeFileSync(path.join(dir,name+'.wav'),out);
}
console.log('Generated 5 original short WAV clips.');
