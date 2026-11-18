// Original synthesized PCM assets. No samples from another game.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(root,'assets/resources/color-clear-audio');fs.mkdirSync(dir,{recursive:true});
for(const [name,freqs,duration] of [['won',[660,830,990],.32],['lost',[240,180],.24]]){
 const rate=22050,n=Math.floor(rate*duration),out=Buffer.alloc(44+n*2);
 out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(n*2,40);
 for(let i=0;i<n;i++){const t=i/rate,env=Math.min(1,t/.004)*Math.pow(1-i/n,2);const value=freqs.reduce((a,f)=>a+Math.sin(2*Math.PI*f*(t-.15*t*t)),0)/freqs.length;out.writeInt16LE(Math.round(value*env*.32*32767),44+i*2);}
 fs.writeFileSync(path.join(dir,name+'.wav'),out);
}
function effect(name, seconds, sample) {
    const rate = 22050;
    const n = Math.round(rate * seconds);
    const out = Buffer.alloc(44 + n * 2);
    out.write('RIFF'); out.writeUInt32LE(out.length - 8, 4); out.write('WAVEfmt ', 8);
    out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
    out.writeUInt32LE(rate, 24); out.writeUInt32LE(rate * 2, 28);
    out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write('data', 36);
    out.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) {
        const t = i / rate;
        const fade = Math.max(0, Math.min(1, (seconds - t) / .009));
        out.writeInt16LE(Math.round(sample(t) * fade * 32767), 44 + i * 2);
    }
    fs.writeFileSync(path.join(dir, name + '.wav'), out);
}

function pluck(t, frequency, decay) {
    if (t < 0) return 0;
    const phase = Math.PI * 2 * frequency * t;
    const attack = Math.min(1, t / .0035);
    return (Math.sin(phase) + .31 * Math.sin(2.02 * phase) + .16 * Math.sin(3.84 * phase))
        * attack * Math.exp(-decay * t);
}

effect('load', .102, t => .31 * pluck(t, 183, 62) + .24 * pluck(t - .032, 406, 81));
for (const [suffix, frequency] of [['',392],['-lift',494],['-peak',587]]) {
    effect('hit' + suffix, .075, t => .33 * pluck(t, frequency, 54) + .087 * pluck(t, 155, 89));
}
effect('chain', .24, t => .24 * pluck(t, 523.25, 17) + .19 * pluck(t - .036, 659.25, 17) + .17 * pluck(t - .075, 783.99, 20));
effect('surge', .34, t => .19 * pluck(t, 349.23, 13) + .18 * pluck(t, 523.25, 14)
    + .17 * pluck(t - .057, 659.25, 13) + .18 * pluck(t - .102, 1046.50, 15));
console.log('Generated original load, hit, combo and result WAV clips.');

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
