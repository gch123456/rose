// Original synthesized PCM assets. No samples from another game.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
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

// Finger-plucked camp melody and soft bass, with a full phrase to loop.
const beat = .54;
const sampleRate = 22050;
const melody = [60, 64, 67, 64, 62, 65, 69, 67, 64, 67, 72, 69, 67, 64, 62, 55];
const bass = [48, 50, 45, 43];
const track = Buffer.alloc(Math.round(16 * beat * sampleRate) * 2);
for (let i = 0; i < track.length / 2; i++) {
    const time = i / sampleRate;
    const step = Math.floor(time / beat);
    const next = time - step * beat;
    const lower = time - Math.floor(step / 4) * 4 * beat;
    const note = (midi, t, decay) => {
        const phase = 2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) * t;
        return (Math.sin(phase) + .26 * Math.sin(phase * 2) + .1 * Math.sin(phase * 3))
            * Math.min(t / .018, 1) * Math.exp(-t * decay);
    };
    const envelope = Math.min((16 * beat - time) / .13, 1);
    const sample = .43 * note(melody[step], next, 8) + .17 * note(bass[Math.floor(step / 4)], lower, 2.9);
    track.writeInt16LE(Math.round(sample * envelope * 32767), i * 2);
}
const music = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', String(sampleRate), '-ac', '1',
    '-i', 'pipe:0', '-b:a', '24k', path.join(dir, 'camp.mp3'),
], {input: track, stdio: ['pipe', 'inherit', 'inherit']});
if (music.error || music.status !== 0) throw music.error ?? new Error('Camp music conversion failed');
