/** Original synthesized camp motif; no downloaded music or autoplay requirement. */
export class CampAudio {
 constructor(preferences){this.preferences=preferences;this.context=null;this.active=true;this.timer=null;this.voices=new Set();this.note=0;}
 unlock(){try{const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;if(!this.context)this.context=new Audio();void this.context.resume().then(()=>this.sync()).catch(()=>{});}catch{}}
 play(frequency,duration=.08,volume=.025,music=false){const c=this.context;if(!c||c.state!=='running'||!this.active||!(music?this.preferences.music:this.preferences.effects))return;const o=c.createOscillator(),g=c.createGain(),t=c.currentTime;o.type=music?'triangle':'sine';o.frequency.value=frequency;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+duration+.02);const v={o,g,music};this.voices.add(v);o.onended=()=>{this.voices.delete(v);o.disconnect();g.disconnect();};}
 sync(){clearInterval(this.timer);this.timer=null;for(const v of this.voices)if(!this.active||(v.music?!this.preferences.music:!this.preferences.effects)){try{v.o.stop();}catch{}}
 if(this.active&&this.preferences.music&&this.context?.state==='running'){const notes=[261.63,329.63,392,329.63,293.66,349.23,440,392,329.63,392,523.25,440,349.23,329.63,293.66,196];this.timer=setInterval(()=>{if(!document.hidden)this.play(notes[this.note++%notes.length],.8,.009,true);},650);}}
 setActive(active){this.active=active;this.sync();}
 dispose(){this.setActive(false);void this.context?.close();}
}
